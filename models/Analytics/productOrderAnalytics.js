const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for product dimensions
const productDimensionsZodSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  thickness: z.number().optional(),
  bagType: z.string().optional()
});

// Zod schema for top material used
const topMaterialUsedZodSchema = z.object({
  materialId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialId format'),
  materialName: z.string(),
  totalWeight: z.number()
});

// Zod schema for creating ProductOrderAnalytics
const createProductOrderAnalyticsSchema = z.object({
  periodType: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.date(),
  endDate: z.date(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  productSpecId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid productSpecId format').optional(),
  productType: z.string().optional(),
  productName: z.string().optional(),
  dimensions: productDimensionsZodSchema.optional(),
  totalOrders: z.number().int().default(0),
  totalQuantity: z.number().default(0),
  totalWeight: z.number().default(0),
  completedOrders: z.number().int().default(0),
  inProgressOrders: z.number().int().default(0),
  pendingOrders: z.number().int().default(0),
  cancelledOrders: z.number().int().default(0),
  averageCompletionTime: z.number().default(0),
  averageProductionRate: z.number().default(0),
  averageMixingTime: z.number().default(0),
  uniqueCustomers: z.number().int().default(0),
  repeatCustomers: z.number().int().default(0),
  customerRetentionRate: z.number().default(0),
  rejectionRate: z.number().default(0),
  averageWastage: z.number().default(0),
  totalRevenue: z.number().optional(),
  averageOrderValue: z.number().optional(),
  popularityRank: z.number().int().optional(),
  revenueRank: z.number().int().optional(),
  topMaterialsUsed: z.array(topMaterialUsedZodSchema).optional(),
  calculatedAt: z.date().optional()
}).refine(data => data.endDate >= data.startDate, {
  message: 'End date must be after or equal to start date',
  path: ['endDate']
});

// Zod schema for updating ProductOrderAnalytics
const updateProductOrderAnalyticsSchema = z.object({
  periodType: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  productSpecId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid productSpecId format').optional(),
  productType: z.string().optional(),
  productName: z.string().optional(),
  dimensions: productDimensionsZodSchema.optional(),
  totalOrders: z.number().int().optional(),
  totalQuantity: z.number().optional(),
  totalWeight: z.number().optional(),
  completedOrders: z.number().int().optional(),
  inProgressOrders: z.number().int().optional(),
  pendingOrders: z.number().int().optional(),
  cancelledOrders: z.number().int().optional(),
  averageCompletionTime: z.number().optional(),
  averageProductionRate: z.number().optional(),
  averageMixingTime: z.number().optional(),
  uniqueCustomers: z.number().int().optional(),
  repeatCustomers: z.number().int().optional(),
  customerRetentionRate: z.number().optional(),
  rejectionRate: z.number().optional(),
  averageWastage: z.number().optional(),
  totalRevenue: z.number().optional(),
  averageOrderValue: z.number().optional(),
  popularityRank: z.number().int().optional(),
  revenueRank: z.number().int().optional(),
  topMaterialsUsed: z.array(topMaterialUsedZodSchema).optional(),
  calculatedAt: z.date().optional()
}).strict();

const productOrderAnalyticsSchema = new mongoose.Schema({
  // Time period
  periodType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },

  // Scope
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },

  // Product data
  productSpecId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductSpec'
  },
  productType: String,
  productName: String,

  // Product dimensions (for grouping similar products)
  dimensions: {
    width: Number,
    height: Number,
    thickness: Number,
    bagType: String
  },

  // Order statistics
  totalOrders: {
    type: Number,
    default: 0
  },
  totalQuantity: {
    type: Number,
    default: 0
  },
  totalWeight: {
    type: Number,
    default: 0
  },

  // Status breakdown
  completedOrders: {
    type: Number,
    default: 0
  },
  inProgressOrders: {
    type: Number,
    default: 0
  },
  pendingOrders: {
    type: Number,
    default: 0
  },
  cancelledOrders: {
    type: Number,
    default: 0
  },

  // Performance
  averageCompletionTime: {
    type: Number,  // hours
    default: 0
  },
  averageProductionRate: {
    type: Number,  // units per hour
    default: 0
  },
  averageMixingTime: {
    type: Number,  // minutes
    default: 0
  },

  // Customer data
  uniqueCustomers: {
    type: Number,
    default: 0
  },
  repeatCustomers: {
    type: Number,
    default: 0
  },
  customerRetentionRate: {
    type: Number,  // percentage
    default: 0
  },

  // Quality metrics
  rejectionRate: {
    type: Number,
    default: 0
  },
  averageWastage: {
    type: Number,
    default: 0
  },

  // Revenue (if tracked)
  totalRevenue: Number,
  averageOrderValue: Number,

  // Ranking
  popularityRank: Number,
  revenueRank: Number,

  // Material usage summary
  topMaterialsUsed: [{
    materialId: mongoose.Schema.Types.ObjectId,
    materialName: String,
    totalWeight: Number
  }],

  // Updated timestamp
  calculatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
productOrderAnalyticsSchema.index({ branchId: 1, periodType: 1, startDate: -1 });
productOrderAnalyticsSchema.index({ productSpecId: 1, startDate: -1 });
productOrderAnalyticsSchema.index({ productType: 1, branchId: 1, startDate: -1 });
productOrderAnalyticsSchema.index({ popularityRank: 1 });
productOrderAnalyticsSchema.index({ revenueRank: 1 });

// Calculate customer retention rate before saving
productOrderAnalyticsSchema.pre('save', function(next) {
  if (this.uniqueCustomers > 0) {
    this.customerRetentionRate = (this.repeatCustomers / this.uniqueCustomers) * 100;
  }
  next();
});

// Static method to generate analytics for a period
productOrderAnalyticsSchema.statics.generateForPeriod = async function(branchId, startDate, endDate, periodType = 'monthly') {
  const Order = mongoose.model('Order');

  // Aggregate product orders
  const pipeline = [
    {
      $match: {
        branchId: mongoose.Types.ObjectId(branchId),
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: {
          productType: '$productType',
          bagType: '$bagType',
          width: '$width',
          height: '$height',
          thickness: '$thickness'
        },
        productSpecId: { $first: '$productSpecId' },
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
        cancelledOrders: {
          $sum: {
            $cond: [{ $eq: ['$overallStatus', 'cancelled'] }, 1, 0]
          }
        },
        uniqueCustomers: { $addToSet: '$customerId' },
        avgCompletionTime: {
          $avg: {
            $divide: [
              { $subtract: ['$actualEndDate', '$actualStartDate'] },
              3600000  // Convert to hours
            ]
          }
        },
        avgMixingTime: { $avg: '$mixingTracking.actualMixingTime' }
      }
    },
    {
      $addFields: {
        uniqueCustomerCount: { $size: '$uniqueCustomers' },
        averageProductionRate: {
          $cond: {
            if: { $gt: ['$avgCompletionTime', 0] },
            then: { $divide: ['$totalQuantity', '$avgCompletionTime'] },
            else: 0
          }
        }
      }
    },
    {
      $project: {
        uniqueCustomers: 0
      }
    },
    { $sort: { totalOrders: -1 } }
  ];

  const results = await Order.aggregate(pipeline);

  // Calculate popularity rank
  results.forEach((r, index) => {
    r.popularityRank = index + 1;
  });

  // Delete existing analytics for this period
  await this.deleteMany({
    branchId,
    periodType,
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  });

  // Create new analytics records
  const analyticsRecords = results.map(r => ({
    periodType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    branchId,
    productSpecId: r.productSpecId,
    productType: r._id.productType,
    productName: `${r._id.productType} - ${r._id.bagType || ''} (${r._id.width}x${r._id.height})`,
    dimensions: {
      width: r._id.width,
      height: r._id.height,
      thickness: r._id.thickness,
      bagType: r._id.bagType
    },
    totalOrders: r.totalOrders,
    totalQuantity: r.totalQuantity,
    totalWeight: r.totalWeight,
    completedOrders: r.completedOrders,
    inProgressOrders: r.inProgressOrders,
    pendingOrders: r.pendingOrders,
    cancelledOrders: r.cancelledOrders,
    averageCompletionTime: r.avgCompletionTime,
    averageProductionRate: r.averageProductionRate,
    averageMixingTime: r.avgMixingTime,
    uniqueCustomers: r.uniqueCustomerCount,
    popularityRank: r.popularityRank,
    calculatedAt: new Date()
  }));

  if (analyticsRecords.length > 0) {
    await this.insertMany(analyticsRecords);
  }

  return analyticsRecords;
};

const ProductOrderAnalytics = mongoose.model('ProductOrderAnalytics', productOrderAnalyticsSchema);

module.exports = ProductOrderAnalytics;
module.exports.createProductOrderAnalyticsSchema = createProductOrderAnalyticsSchema;
module.exports.updateProductOrderAnalyticsSchema = updateProductOrderAnalyticsSchema;
module.exports.productDimensionsZodSchema = productDimensionsZodSchema;
module.exports.topMaterialUsedZodSchema = topMaterialUsedZodSchema;
