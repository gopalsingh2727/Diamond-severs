const connect = require('../../config/mongodb/db');
const MaterialUsageAnalytics = require('../../models/Analytics/materialUsageAnalytics');
const ProductOrderAnalytics = require('../../models/Analytics/productOrderAnalytics');
const Order = require('../../models/oders/oders');
const mongoose = require('mongoose');
const { withLogger } = require('../../middleware/logger');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  return apiKey === process.env.API_KEY;
};

/**
 * Get Material Usage Report
 * GET /api/analytics/material-usage
 * Query params: branchId, startDate, endDate, materialId (optional)
 */
module.exports.getMaterialUsageReport = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { branchId, startDate, endDate, materialId } = event.queryStringParameters || {};

    if (!branchId || !startDate || !endDate) {
      return respond(400, { message: 'branchId, startDate, and endDate are required' });
    }

    const filter = {
      branchId: mongoose.Types.ObjectId(branchId),
      'mixingTracking.startTime': {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      overallStatus: { $in: ['completed', 'dispatched'] }
    };

    // Aggregate material usage from orders
    const matchStage = materialId
      ? { ...filter, 'mixMaterial.materialId': mongoose.Types.ObjectId(materialId) }
      : filter;

    const pipeline = [
      { $match: matchStage },
      { $unwind: '$mixMaterial' },
      {
        $group: {
          _id: '$mixMaterial.materialId',
          materialName: { $first: '$mixMaterial.materialName' },
          totalPlannedWeight: { $sum: '$mixMaterial.plannedWeight' },
          totalActualWeight: { $sum: '$mixMaterial.actualWeight' },
          ordersCount: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          averageVariance: { $avg: '$mixMaterial.variance' },
          maxVariance: { $max: '$mixMaterial.variance' },
          minVariance: { $min: '$mixMaterial.variance' },
          averageMixingTime: { $avg: '$mixingTracking.actualMixingTime' },
          totalMixingTime: { $sum: '$mixingTracking.actualMixingTime' }
        }
      },
      {
        $addFields: {
          wastagePercentage: {
            $cond: {
              if: { $gt: ['$totalPlannedWeight', 0] },
              then: {
                $multiply: [
                  { $divide: [
                    { $subtract: ['$totalActualWeight', '$totalPlannedWeight'] },
                    '$totalPlannedWeight'
                  ]},
                  100
                ]
              },
              else: 0
            }
          },
          efficiencyScore: {
            $cond: {
              if: { $gt: ['$totalPlannedWeight', 0] },
              then: {
                $multiply: [
                  { $divide: ['$totalActualWeight', '$totalPlannedWeight'] },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      { $sort: { totalActualWeight: -1 } }
    ];

    const results = await Order.aggregate(pipeline);

    logger.info('Material usage report generated', {
      branchId,
      materialsCount: results.length,
      period: { startDate, endDate }
    });

    return respond(200, {
      period: { startDate, endDate },
      materials: results,
      totalMaterials: results.length
    });
  } catch (error) {
    logger.error('Material usage report error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Get Product Popularity Report
 * GET /api/analytics/product-popularity
 * Query params: branchId, startDate, endDate, limit (optional)
 */
module.exports.getProductPopularityReport = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { branchId, startDate, endDate, limit = '50' } = event.queryStringParameters || {};

    if (!branchId || !startDate || !endDate) {
      return respond(400, { message: 'branchId, startDate, and endDate are required' });
    }

    const filter = {
      branchId: mongoose.Types.ObjectId(branchId),
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Aggregate product orders
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: {
            productType: '$productType',
            bagType: '$bagType',
            width: '$width',
            height: '$height',
            thickness: '$thickness'
          },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalWeight: { $sum: '$totalWeight' },
          completedOrders: {
            $sum: {
              $cond: [
                { $in: ['$overallStatus', ['completed', 'dispatched']] },
                1,
                0
              ]
            }
          },
          inProgressOrders: {
            $sum: {
              $cond: [{ $eq: ['$overallStatus', 'in_progress'] }, 1, 0]
            }
          },
          pendingOrders: {
            $sum: {
              $cond: [{ $eq: ['$overallStatus', 'pending'] }, 1, 0]
            }
          },
          uniqueCustomers: { $addToSet: '$customerId' },
          averageCompletionTime: {
            $avg: {
              $cond: {
                if: { $and: ['$actualEndDate', '$actualStartDate'] },
                then: {
                  $divide: [
                    { $subtract: ['$actualEndDate', '$actualStartDate'] },
                    3600000  // Convert to hours
                  ]
                },
                else: null
              }
            }
          }
        }
      },
      {
        $addFields: {
          uniqueCustomerCount: { $size: '$uniqueCustomers' },
          productName: {
            $concat: [
              '$_id.productType',
              ' - ',
              { $ifNull: ['$_id.bagType', ''] },
              ' (',
              { $toString: '$_id.width' },
              'x',
              { $toString: '$_id.height' },
              ')'
            ]
          }
        }
      },
      {
        $project: {
          uniqueCustomers: 0
        }
      },
      { $sort: { totalOrders: -1 } },
      { $limit: parseInt(limit) }
    ];

    const results = await Order.aggregate(pipeline);

    // Add popularity rank
    results.forEach((r, index) => {
      r.popularityRank = index + 1;
    });

    logger.info('Product popularity report generated', {
      branchId,
      productsCount: results.length,
      period: { startDate, endDate }
    });

    return respond(200, {
      period: { startDate, endDate },
      products: results,
      totalProducts: results.length
    });
  } catch (error) {
    logger.error('Product popularity report error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Get Mixing Time Analytics
 * GET /api/analytics/mixing-time
 * Query params: branchId, startDate, endDate, machineId (optional)
 */
module.exports.getMixingTimeAnalytics = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { branchId, startDate, endDate, machineId } = event.queryStringParameters || {};

    if (!branchId || !startDate || !endDate) {
      return respond(400, { message: 'branchId, startDate, and endDate are required' });
    }

    const filter = {
      branchId: mongoose.Types.ObjectId(branchId),
      'mixingTracking.startTime': {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      'mixingTracking.endTime': { $exists: true }
    };

    if (machineId) {
      filter['steps.machines.machineId'] = mongoose.Types.ObjectId(machineId);
    }

    // Overall mixing statistics
    const overallPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          averageMixingTime: { $avg: '$mixingTracking.actualMixingTime' },
          minMixingTime: { $min: '$mixingTracking.actualMixingTime' },
          maxMixingTime: { $max: '$mixingTracking.actualMixingTime' },
          totalMixingTime: { $sum: '$mixingTracking.actualMixingTime' }
        }
      }
    ];

    const overallResult = await Order.aggregate(overallPipeline);

    // Mixing time by product type
    const byProductPipeline = [
      { $match: filter },
      {
        $group: {
          _id: '$productType',
          averageMixingTime: { $avg: '$mixingTracking.actualMixingTime' },
          ordersCount: { $sum: 1 },
          totalMixingTime: { $sum: '$mixingTracking.actualMixingTime' }
        }
      },
      { $sort: { averageMixingTime: -1 } }
    ];

    const byProduct = await Order.aggregate(byProductPipeline);

    // Mixing time by operator (if tracked)
    const byOperatorPipeline = [
      { $match: filter },
      {
        $group: {
          _id: '$mixingTracking.operatorId',
          averageMixingTime: { $avg: '$mixingTracking.actualMixingTime' },
          ordersCount: { $sum: 1 },
          totalMixingTime: { $sum: '$mixingTracking.actualMixingTime' }
        }
      },
      { $sort: { ordersCount: -1 } },
      { $limit: 20 }
    ];

    const byOperator = await Order.aggregate(byOperatorPipeline);

    logger.info('Mixing time analytics generated', {
      branchId,
      totalOrders: overallResult[0]?.totalOrders || 0,
      period: { startDate, endDate }
    });

    return respond(200, {
      period: { startDate, endDate },
      overall: overallResult[0] || {
        totalOrders: 0,
        averageMixingTime: 0,
        minMixingTime: 0,
        maxMixingTime: 0,
        totalMixingTime: 0
      },
      byProduct,
      byOperator
    });
  } catch (error) {
    logger.error('Mixing time analytics error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Get Comprehensive Dashboard Analytics
 * GET /api/analytics/dashboard
 * Query params: branchId, days (default 30)
 */
module.exports.getDashboardAnalytics = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { branchId, days = '30' } = event.queryStringParameters || {};

    if (!branchId) {
      return respond(400, { message: 'branchId is required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const endDate = new Date();

    // Get top materials
    const topMaterialsPipeline = [
      {
        $match: {
          branchId: mongoose.Types.ObjectId(branchId),
          createdAt: { $gte: startDate },
          overallStatus: { $in: ['completed', 'dispatched'] }
        }
      },
      { $unwind: '$mixMaterial' },
      {
        $group: {
          _id: '$mixMaterial.materialId',
          materialName: { $first: '$mixMaterial.materialName' },
          totalUsed: { $sum: '$mixMaterial.actualWeight' },
          ordersCount: { $sum: 1 }
        }
      },
      { $sort: { totalUsed: -1 } },
      { $limit: 10 }
    ];

    const topMaterials = await Order.aggregate(topMaterialsPipeline);

    // Get top products
    const topProductsPipeline = [
      {
        $match: {
          branchId: mongoose.Types.ObjectId(branchId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$productType',
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { totalOrders: -1 } },
      { $limit: 10 }
    ];

    const topProducts = await Order.aggregate(topProductsPipeline);

    // Get mixing statistics
    const mixingStatsPipeline = [
      {
        $match: {
          branchId: mongoose.Types.ObjectId(branchId),
          createdAt: { $gte: startDate },
          'mixingTracking.actualMixingTime': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          averageMixingTime: { $avg: '$mixingTracking.actualMixingTime' },
          totalMixingTime: { $sum: '$mixingTracking.actualMixingTime' },
          ordersWithMixing: { $sum: 1 }
        }
      }
    ];

    const mixingStatsResult = await Order.aggregate(mixingStatsPipeline);
    const mixingStats = mixingStatsResult[0] || {
      averageMixingTime: 0,
      totalMixingTime: 0,
      ordersWithMixing: 0
    };

    // Get order status breakdown
    const statusBreakdownPipeline = [
      {
        $match: {
          branchId: mongoose.Types.ObjectId(branchId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$overallStatus',
          count: { $sum: 1 }
        }
      }
    ];

    const statusBreakdown = await Order.aggregate(statusBreakdownPipeline);

    // Get material wastage summary
    const wastagePipeline = [
      {
        $match: {
          branchId: mongoose.Types.ObjectId(branchId),
          createdAt: { $gte: startDate },
          overallStatus: { $in: ['completed', 'dispatched'] }
        }
      },
      { $unwind: '$mixMaterial' },
      {
        $group: {
          _id: null,
          totalPlanned: { $sum: '$mixMaterial.plannedWeight' },
          totalActual: { $sum: '$mixMaterial.actualWeight' }
        }
      },
      {
        $addFields: {
          totalWastage: { $subtract: ['$totalActual', '$totalPlanned'] },
          wastagePercentage: {
            $multiply: [
              { $divide: [
                { $subtract: ['$totalActual', '$totalPlanned'] },
                '$totalPlanned'
              ]},
              100
            ]
          }
        }
      }
    ];

    const wastageResult = await Order.aggregate(wastagePipeline);
    const wastageStats = wastageResult[0] || {
      totalPlanned: 0,
      totalActual: 0,
      totalWastage: 0,
      wastagePercentage: 0
    };

    logger.info('Dashboard analytics generated', {
      branchId,
      days: parseInt(days),
      topMaterialsCount: topMaterials.length,
      topProductsCount: topProducts.length
    });

    return respond(200, {
      period: {
        days: parseInt(days),
        startDate,
        endDate
      },
      topMaterials,
      topProducts,
      mixingStats,
      statusBreakdown,
      wastageStats
    });
  } catch (error) {
    logger.error('Dashboard analytics error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Generate Analytics for Period (Background Job)
 * POST /api/analytics/generate
 * Body: { branchId, startDate, endDate, periodType }
 */
module.exports.generateAnalyticsForPeriod = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { branchId, startDate, endDate, periodType = 'monthly' } = JSON.parse(event.body);

    if (!branchId || !startDate || !endDate) {
      return respond(400, { message: 'branchId, startDate, and endDate are required' });
    }

    // Generate material usage analytics
    const materialAnalytics = await MaterialUsageAnalytics.generateForPeriod(
      branchId,
      startDate,
      endDate,
      periodType
    );

    // Generate product order analytics
    const productAnalytics = await ProductOrderAnalytics.generateForPeriod(
      branchId,
      startDate,
      endDate,
      periodType
    );

    logger.info('Analytics generated for period', {
      branchId,
      periodType,
      materialRecords: materialAnalytics.length,
      productRecords: productAnalytics.length
    });

    return respond(200, {
      message: 'Analytics generated successfully',
      materialAnalytics: {
        count: materialAnalytics.length
      },
      productAnalytics: {
        count: productAnalytics.length
      }
    });
  } catch (error) {
    logger.error('Generate analytics error', { error: error.message });
    return respond(500, { message: error.message });
  }
});
