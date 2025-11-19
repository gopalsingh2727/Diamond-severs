const connect = require('../../config/mongodb/db');
const Manager = require('../../models/manager/manager');
const Machine = require('../../models/machine/machine');
const Order = require('../../models/oders/oders');
const Operator = require('../../models/MachineOperator/MachineOperator');
const { withLogger } = require('../../middleware/logger');
const { cacheWrapper } = require('../../middleware/cacheMiddleware');
const verifyToken = require('../../utiles/verifyToken');

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
 * Get manager dashboard overview (mobile)
 * GET /mobile/manager/dashboard
 */
module.exports.getManagerDashboard = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'manager') {
      return respond(403, { message: 'Manager access required' });
    }

    const branchId = user.branchId;

    // Get counts in parallel
    const [
      totalMachines,
      activeMachines,
      totalOperators,
      pendingOrders,
      inProgressOrders,
      completedTodayOrders,
    ] = await Promise.all([
      Machine.countDocuments({ branchId }),
      Machine.countDocuments({ branchId, status: 'running' }),
      Operator.countDocuments({ branchId }),
      Order.countDocuments({ branchId, status: 'pending' }),
      Order.countDocuments({ branchId, status: 'in_progress' }),
      Order.countDocuments({
        branchId,
        status: 'completed',
        completedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
    ]);

    // Get recent activity
    const recentOrders = await Order.find({ branchId })
      .select('orderNumber customerName status priority deliveryDate createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get machine status summary
    const machineStatuses = await Machine.aggregate([
      { $match: { branchId: user.branchId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    logger.info('Manager dashboard accessed', { managerId: user.id, branchId });

    return respond(200, {
      summary: {
        totalMachines,
        activeMachines,
        inactiveMachines: totalMachines - activeMachines,
        totalOperators,
        pendingOrders,
        inProgressOrders,
        completedToday: completedTodayOrders,
      },
      machineStatuses,
      recentOrders,
    });
  } catch (err) {
    logger.error('Get manager dashboard error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get real-time machine status (mobile)
 * GET /mobile/manager/machines/status
 */
module.exports.getMachinesStatus = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'manager') {
      return respond(403, { message: 'Manager access required' });
    }

    // Get machines with current orders
    const machines = await Machine.find({ branchId: user.branchId })
      .select('machineName machineType status capacity currentLoad')
      .populate('machineType', 'type')
      .lean();

    // Get current orders for each machine
    const machineIds = machines.map((m) => m._id);
    const activeOrders = await Order.find({
      'machines.machineId': { $in: machineIds },
      'machines.status': { $in: ['in_progress', 'paused'] },
    })
      .select('orderNumber machines')
      .lean();

    // Map orders to machines
    const machinesWithOrders = machines.map((machine) => {
      const machineOrders = activeOrders
        .filter((order) =>
          order.machines.some(
            (m) =>
              m.machineId.toString() === machine._id.toString() &&
              ['in_progress', 'paused'].includes(m.status)
          )
        )
        .map((order) => {
          const machineData = order.machines.find(
            (m) => m.machineId.toString() === machine._id.toString()
          );
          return {
            orderNumber: order.orderNumber,
            status: machineData.status,
            completedPercentage: machineData.completedPercentage || 0,
          };
        });

      return {
        id: machine._id,
        name: machine.machineName,
        type: machine.machineType?.type,
        status: machine.status,
        capacity: machine.capacity,
        currentLoad: machine.currentLoad,
        utilization: machine.capacity ? (machine.currentLoad / machine.capacity) * 100 : 0,
        activeOrders: machineOrders,
      };
    });

    return respond(200, {
      machines: machinesWithOrders,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Get machines status error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get orders overview (mobile)
 * GET /mobile/manager/orders/overview
 */
module.exports.getOrdersOverview = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'manager') {
      return respond(403, { message: 'Manager access required' });
    }

    const { status, priority, limit = 50 } = event.queryStringParameters || {};

    // Build filter
    const filter = { branchId: user.branchId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Get orders
    const orders = await Order.find(filter)
      .select(
        'orderNumber customerName deliveryDate priority status machines createdAt completedAt'
      )
      .populate('customerId', 'customerName contactNumber')
      .sort({ priority: -1, deliveryDate: 1 })
      .limit(parseInt(limit))
      .lean();

    // Format for mobile
    const mobileOrders = orders.map((order) => {
      // Calculate overall progress
      const totalProgress = order.machines.reduce(
        (sum, m) => sum + (m.completedPercentage || 0),
        0
      );
      const avgProgress = order.machines.length > 0 ? totalProgress / order.machines.length : 0;

      // Get machine statuses
      const machineStatuses = order.machines.map((m) => ({
        machineId: m.machineId,
        machineName: m.machineName,
        status: m.status,
        progress: m.completedPercentage || 0,
      }));

      return {
        id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerId?.customerName || order.customerName,
        contactNumber: order.customerId?.contactNumber,
        deliveryDate: order.deliveryDate,
        priority: order.priority,
        status: order.status,
        progress: Math.round(avgProgress),
        machines: machineStatuses,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
      };
    });

    return respond(200, {
      orders: mobileOrders,
      count: mobileOrders.length,
    });
  } catch (err) {
    logger.error('Get orders overview error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get operators status (mobile)
 * GET /mobile/manager/operators/status
 */
module.exports.getOperatorsStatus = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'manager') {
      return respond(403, { message: 'Manager access required' });
    }

    // Get operators with their machines
    const operators = await Operator.find({ branchId: user.branchId })
      .populate('machineId', 'machineName machineType status')
      .lean();

    // Get active orders for each operator
    const operatorIds = operators.map((o) => o._id);
    const activeOrders = await Order.find({
      'machines.operatorId': { $in: operatorIds },
      'machines.status': { $in: ['in_progress', 'paused'] },
    })
      .select('orderNumber machines')
      .lean();

    // Map operators with their current work
    const operatorsStatus = operators.map((operator) => {
      const currentWork = activeOrders
        .filter((order) =>
          order.machines.some(
            (m) =>
              m.operatorId &&
              m.operatorId.toString() === operator._id.toString() &&
              ['in_progress', 'paused'].includes(m.status)
          )
        )
        .map((order) => {
          const machineData = order.machines.find(
            (m) => m.operatorId && m.operatorId.toString() === operator._id.toString()
          );
          return {
            orderNumber: order.orderNumber,
            status: machineData.status,
            progress: machineData.completedPercentage || 0,
            startedAt: machineData.startedAt,
          };
        })[0]; // Get first active order

      return {
        id: operator._id,
        username: operator.username,
        machine: {
          id: operator.machineId?._id,
          name: operator.machineId?.machineName,
          type: operator.machineId?.machineType,
          status: operator.machineId?.status,
        },
        currentWork: currentWork || null,
        isActive: !!currentWork,
      };
    });

    return respond(200, {
      operators: operatorsStatus,
      activeCount: operatorsStatus.filter((o) => o.isActive).length,
      totalCount: operatorsStatus.length,
    });
  } catch (err) {
    logger.error('Get operators status error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get production analytics (mobile)
 * GET /mobile/manager/analytics/production
 */
module.exports.getProductionAnalytics = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'manager') {
      return respond(403, { message: 'Manager access required' });
    }

    const { days = 7 } = event.queryStringParameters || {};
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get orders analytics
    const ordersAnalytics = await Order.aggregate([
      {
        $match: {
          branchId: user.branchId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get machine utilization
    const machines = await Machine.find({ branchId: user.branchId })
      .select('machineName capacity currentLoad')
      .lean();

    const machineUtilization = machines.map((m) => ({
      name: m.machineName,
      utilization: m.capacity ? Math.round((m.currentLoad / m.capacity) * 100) : 0,
    }));

    return respond(200, {
      period: {
        days: parseInt(days),
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      orders: ordersAnalytics,
      machineUtilization,
    });
  } catch (err) {
    logger.error('Get production analytics error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Assign order to machine (mobile)
 * POST /mobile/manager/order/assign
 */
module.exports.assignOrderToMachine = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'manager') {
      return respond(403, { message: 'Manager access required' });
    }

    const { orderId, machineId, priority } = JSON.parse(event.body);

    if (!orderId || !machineId) {
      return respond(400, { message: 'orderId and machineId are required' });
    }

    // Verify machine belongs to manager's branch
    const machine = await Machine.findById(machineId);
    if (!machine || machine.branchId.toString() !== user.branchId) {
      return respond(403, { message: 'Machine not found or access denied' });
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order || order.branchId.toString() !== user.branchId) {
      return respond(403, { message: 'Order not found or access denied' });
    }

    // Check if machine already assigned
    const existingIndex = order.machines.findIndex(
      (m) => m.machineId.toString() === machineId
    );

    if (existingIndex >= 0) {
      return respond(400, { message: 'Machine already assigned to this order' });
    }

    // Add machine to order
    order.machines.push({
      machineId: machine._id,
      machineName: machine.machineName,
      machineType: machine.machineType,
      status: 'pending',
      assignedAt: new Date(),
    });

    // Update priority if provided
    if (priority) {
      order.priority = priority;
    }

    await order.save();

    logger.info('Order assigned to machine', {
      orderId,
      machineId,
      managerId: user.id,
    });

    return respond(200, {
      message: 'Order assigned successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        machines: order.machines,
      },
    });
  } catch (err) {
    logger.error('Assign order error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get alerts and notifications (mobile)
 * GET /mobile/manager/alerts
 */
module.exports.getAlerts = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'manager') {
      return respond(403, { message: 'Manager access required' });
    }

    const alerts = [];

    // Check for overdue orders
    const overdueOrders = await Order.countDocuments({
      branchId: user.branchId,
      status: { $in: ['pending', 'in_progress'] },
      deliveryDate: { $lt: new Date() },
    });

    if (overdueOrders > 0) {
      alerts.push({
        type: 'danger',
        title: 'Overdue Orders',
        message: `${overdueOrders} order(s) are past their delivery date`,
        count: overdueOrders,
      });
    }

    // Check for high priority pending orders
    const highPriorityPending = await Order.countDocuments({
      branchId: user.branchId,
      status: 'pending',
      priority: 'high',
    });

    if (highPriorityPending > 0) {
      alerts.push({
        type: 'warning',
        title: 'High Priority Pending',
        message: `${highPriorityPending} high priority order(s) waiting to start`,
        count: highPriorityPending,
      });
    }

    // Check for paused orders
    const pausedOrders = await Order.countDocuments({
      branchId: user.branchId,
      'machines.status': 'paused',
    });

    if (pausedOrders > 0) {
      alerts.push({
        type: 'info',
        title: 'Paused Orders',
        message: `${pausedOrders} order(s) are currently paused`,
        count: pausedOrders,
      });
    }

    // Check for inactive machines
    const inactiveMachines = await Machine.countDocuments({
      branchId: user.branchId,
      status: { $in: ['offline', 'maintenance'] },
    });

    if (inactiveMachines > 0) {
      alerts.push({
        type: 'warning',
        title: 'Inactive Machines',
        message: `${inactiveMachines} machine(s) are offline or in maintenance`,
        count: inactiveMachines,
      });
    }

    return respond(200, {
      alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Get alerts error', { error: err.message });
    return respond(500, { message: err.message });
  }
});
