const connect = require('../../config/mongodb/db');
const MasterAdmin = require('../../models/masterAdmin/masterAdmin');
const Branch = require('../../models/branch/branch');
const Manager = require('../../models/manager/manager');
const Operator = require('../../models/MachineOperator/MachineOperator');
const Machine = require('../../models/machine/machine');
const Order = require('../../models/oders/oders');
const Customer = require('../../models/Customer/customer');
const { withLogger } = require('../../middleware/logger');
const jwt = require('jsonwebtoken');

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

const verifyMasterAdmin = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.role !== 'master_admin') {
    throw new Error('Master admin access required');
  }

  return decoded;
};

/**
 * Get System-Wide Dashboard
 * GET /master-admin/dashboard
 */
module.exports.getSystemDashboard = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const admin = verifyMasterAdmin(authHeader);

    // Get counts in parallel
    const [
      totalBranches,
      activeBranches,
      totalManagers,
      activeManagers,
      totalOperators,
      totalMachines,
      activeMachines,
      totalCustomers,
      totalOrders,
      pendingOrders,
      inProgressOrders,
      completedOrders,
      todayOrders,
      todayCompletedOrders,
    ] = await Promise.all([
      Branch.countDocuments(),
      Branch.countDocuments({ isActive: true }),
      Manager.countDocuments(),
      Manager.countDocuments({ isActive: true }),
      Operator.countDocuments(),
      Machine.countDocuments(),
      Machine.countDocuments({ status: 'running' }),
      Customer.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'in_progress' }),
      Order.countDocuments({ status: 'completed' }),
      Order.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      Order.countDocuments({
        status: 'completed',
        completedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
    ]);

    // Get branch-wise summary
    const branchSummary = await Order.aggregate([
      {
        $group: {
          _id: '$branchId',
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          inProgressOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branchInfo',
        },
      },
      {
        $unwind: '$branchInfo',
      },
      {
        $project: {
          branchId: '$_id',
          branchName: '$branchInfo.branchName',
          totalOrders: 1,
          pendingOrders: 1,
          inProgressOrders: 1,
          completedOrders: 1,
        },
      },
      { $sort: { totalOrders: -1 } },
      { $limit: 10 },
    ]);

    logger.info('System dashboard accessed', { adminId: admin.id });

    return respond(200, {
      summary: {
        branches: {
          total: totalBranches,
          active: activeBranches,
          inactive: totalBranches - activeBranches,
        },
        users: {
          managers: {
            total: totalManagers,
            active: activeManagers,
          },
          operators: totalOperators,
        },
        machines: {
          total: totalMachines,
          active: activeMachines,
          inactive: totalMachines - activeMachines,
          utilization: totalMachines > 0 ? ((activeMachines / totalMachines) * 100).toFixed(2) : 0,
        },
        customers: totalCustomers,
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          inProgress: inProgressOrders,
          completed: completedOrders,
          today: todayOrders,
          completedToday: todayCompletedOrders,
          completionRate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(2) : 0,
        },
      },
      branchSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('System dashboard error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get All Branches Overview
 * GET /master-admin/branches/overview
 */
module.exports.getBranchesOverview = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const admin = verifyMasterAdmin(authHeader);

    const branches = await Branch.find()
      .select('branchName location contactNumber email isActive createdAt')
      .lean();

    // Get statistics for each branch
    const branchesWithStats = await Promise.all(
      branches.map(async (branch) => {
        const [managers, operators, machines, activeMachines, orders, pendingOrders, customers] =
          await Promise.all([
            Manager.countDocuments({ branchId: branch._id }),
            Operator.countDocuments({ branchId: branch._id }),
            Machine.countDocuments({ branchId: branch._id }),
            Machine.countDocuments({ branchId: branch._id, status: 'running' }),
            Order.countDocuments({ branchId: branch._id }),
            Order.countDocuments({ branchId: branch._id, status: 'pending' }),
            Customer.countDocuments({ branchId: branch._id }),
          ]);

        return {
          ...branch,
          stats: {
            managers,
            operators,
            machines: {
              total: machines,
              active: activeMachines,
            },
            orders: {
              total: orders,
              pending: pendingOrders,
            },
            customers,
          },
        };
      })
    );

    return respond(200, {
      branches: branchesWithStats,
      total: branches.length,
    });
  } catch (err) {
    logger.error('Branches overview error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get System Analytics
 * GET /master-admin/analytics
 */
module.exports.getSystemAnalytics = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const admin = verifyMasterAdmin(authHeader);

    const { days = 30 } = event.queryStringParameters || {};
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Orders over time
    const ordersOverTime = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count',
            },
          },
          total: { $sum: '$count' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Branch performance
    const branchPerformance = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$branchId',
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          avgCompletionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                { $subtract: ['$completedAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branch',
        },
      },
      {
        $unwind: '$branch',
      },
      {
        $project: {
          branchName: '$branch.branchName',
          totalOrders: 1,
          completedOrders: 1,
          completionRate: {
            $multiply: [{ $divide: ['$completedOrders', '$totalOrders'] }, 100],
          },
          avgCompletionTimeHours: {
            $divide: ['$avgCompletionTime', 1000 * 60 * 60],
          },
        },
      },
      { $sort: { totalOrders: -1 } },
    ]);

    // Machine utilization across all branches
    const machineUtilization = await Machine.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Top customers by orders
    const topCustomers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$customerId',
          orderCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $unwind: '$customer',
      },
      {
        $project: {
          customerName: '$customer.customerName',
          contactNumber: '$customer.contactNumber',
          orderCount: 1,
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 },
    ]);

    return respond(200, {
      period: {
        days: parseInt(days),
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      ordersOverTime,
      branchPerformance,
      machineUtilization,
      topCustomers,
    });
  } catch (err) {
    logger.error('System analytics error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get Activity Logs
 * GET /master-admin/activity-logs
 */
module.exports.getActivityLogs = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const admin = verifyMasterAdmin(authHeader);

    const { page = 1, limit = 50, days = 7 } = event.queryStringParameters || {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get recent master admin logins
    const recentLogins = await MasterAdmin.find({
      lastLogin: { $gte: startDate },
    })
      .select('username email lastLogin')
      .sort({ lastLogin: -1 })
      .limit(20)
      .lean();

    // Get recent order activities
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [recentOrders, totalOrders] = await Promise.all([
      Order.find({
        updatedAt: { $gte: startDate },
      })
        .select('orderNumber status branchId updatedAt customerId')
        .populate('branchId', 'branchName')
        .populate('customerId', 'customerName')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments({
        updatedAt: { $gte: startDate },
      }),
    ]);

    return respond(200, {
      recentLogins,
      recentOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalOrders,
        pages: Math.ceil(totalOrders / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('Activity logs error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get System Health Status
 * GET /master-admin/system-health
 */
module.exports.getSystemHealth = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const admin = verifyMasterAdmin(authHeader);

    const mongoose = require('mongoose');

    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';

    // Get database stats
    const dbStats = await mongoose.connection.db.stats();

    // Check for locked accounts
    const lockedAdmins = await MasterAdmin.countDocuments({
      lockUntil: { $gt: Date.now() },
    });

    // Check for inactive branches
    const inactiveBranches = await Branch.countDocuments({ isActive: false });

    // Check for offline machines
    const offlineMachines = await Machine.countDocuments({
      status: { $in: ['offline', 'maintenance'] },
    });

    // Check for overdue orders
    const overdueOrders = await Order.countDocuments({
      status: { $in: ['pending', 'in_progress'] },
      deliveryDate: { $lt: new Date() },
    });

    const health = {
      database: {
        status: dbStatus,
        size: (dbStats.dataSize / 1024 / 1024).toFixed(2) + ' MB',
        collections: dbStats.collections,
        indexes: dbStats.indexes,
      },
      alerts: {
        lockedAdmins,
        inactiveBranches,
        offlineMachines,
        overdueOrders,
      },
      timestamp: new Date().toISOString(),
      overallStatus: dbStatus === 'healthy' && overdueOrders < 5 ? 'healthy' : 'degraded',
    };

    return respond(200, health);
  } catch (err) {
    logger.error('System health error', { error: err.message });
    return respond(500, { message: err.message });
  }
});
