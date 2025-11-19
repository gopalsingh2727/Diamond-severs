const connect = require('../../config/mongodb/db');
const Operator = require('../../models/MachineOperator/MachineOperator');
const Machine = require('../../models/machine/machine');
const Order = require('../../models/oders/oders');
const { withLogger } = require('../../middleware/logger');
const { cacheWrapper } = require('../../middleware/cacheMiddleware');
const bcrypt = require('bcrypt');

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
 * Operator PIN login for mobile
 * POST /mobile/operator/login
 */
module.exports.operatorLogin = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { pin, branchId, machineId } = JSON.parse(event.body);

    // Validation
    if (!pin || !branchId) {
      return respond(400, { message: 'PIN and branchId are required' });
    }

    if (!/^\d{4}$/.test(pin)) {
      return respond(400, { message: 'PIN must be exactly 4 digits' });
    }

    // Find operators with this PIN in the branch
    const operators = await Operator.find({ branchId }).lean();

    // Find matching operator by comparing hashed PINs
    let matchedOperator = null;
    for (const operator of operators) {
      const isMatch = await bcrypt.compare(pin, operator.pin);
      if (isMatch) {
        matchedOperator = operator;
        break;
      }
    }

    if (!matchedOperator) {
      logger.warn('Invalid PIN attempt', { branchId });
      return respond(401, { message: 'Invalid PIN' });
    }

    // Verify machine access if machineId provided
    if (machineId && matchedOperator.machineId.toString() !== machineId) {
      return respond(403, { message: 'Not authorized for this machine' });
    }

    // Get machine details
    const machine = await Machine.findById(matchedOperator.machineId)
      .select('machineName machineType status branchId')
      .lean();

    if (!machine) {
      return respond(404, { message: 'Machine not found' });
    }

    // Generate simple session token (in production, use JWT)
    const sessionToken = `op_${matchedOperator._id}_${Date.now()}`;

    logger.info('Operator logged in', {
      operatorId: matchedOperator._id,
      machineId: machine._id,
    });

    return respond(200, {
      message: 'Login successful',
      operator: {
        id: matchedOperator._id,
        username: matchedOperator.username,
        machineId: machine._id,
        machineName: machine.machineName,
        machineType: machine.machineType,
        branchId: matchedOperator.branchId,
      },
      sessionToken,
    });
  } catch (err) {
    logger.error('Operator login error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get operator's assigned machine info (mobile)
 * GET /mobile/operator/machine
 */
module.exports.getOperatorMachine = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { operatorId } = event.queryStringParameters || {};

    if (!operatorId) {
      return respond(400, { message: 'operatorId is required' });
    }

    const operator = await Operator.findById(operatorId).lean();
    if (!operator) {
      return respond(404, { message: 'Operator not found' });
    }

    // Get machine with cache
    const machine = await Machine.findById(operator.machineId)
      .populate('machineType', 'type description')
      .lean();

    if (!machine) {
      return respond(404, { message: 'Machine not found' });
    }

    return respond(200, {
      machine: {
        id: machine._id,
        name: machine.machineName,
        type: machine.machineType,
        status: machine.status,
        capacity: machine.capacity,
        currentLoad: machine.currentLoad,
      },
    });
  } catch (err) {
    logger.error('Get operator machine error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get operator's pending orders (mobile-optimized)
 * GET /mobile/operator/orders/pending
 */
module.exports.getOperatorPendingOrders = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { operatorId, limit = 20 } = event.queryStringParameters || {};

    if (!operatorId) {
      return respond(400, { message: 'operatorId is required' });
    }

    // Get operator's machine
    const operator = await Operator.findById(operatorId).lean();
    if (!operator) {
      return respond(404, { message: 'Operator not found' });
    }

    // Get pending orders for this machine
    const orders = await Order.find({
      'machines.machineId': operator.machineId,
      'machines.status': { $in: ['pending', 'in_progress', 'paused'] },
    })
      .select('orderNumber customerName deliveryDate priority status machines createdAt')
      .populate('customerId', 'customerName contactNumber')
      .sort({ priority: -1, deliveryDate: 1 })
      .limit(parseInt(limit))
      .lean();

    // Filter and format for mobile
    const mobileOrders = orders.map((order) => {
      const machineData = order.machines.find(
        (m) => m.machineId.toString() === operator.machineId.toString()
      );

      return {
        id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerId?.customerName || order.customerName,
        contactNumber: order.customerId?.contactNumber,
        deliveryDate: order.deliveryDate,
        priority: order.priority,
        status: machineData?.status || 'pending',
        startedAt: machineData?.startedAt,
        completedPercentage: machineData?.completedPercentage || 0,
        notes: machineData?.notes,
      };
    });

    return respond(200, {
      orders: mobileOrders,
      count: mobileOrders.length,
    });
  } catch (err) {
    logger.error('Get operator pending orders error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Start order on machine (mobile)
 * POST /mobile/operator/order/start
 */
module.exports.startOrderMobile = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { operatorId, orderId } = JSON.parse(event.body);

    if (!operatorId || !orderId) {
      return respond(400, { message: 'operatorId and orderId are required' });
    }

    // Get operator
    const operator = await Operator.findById(operatorId);
    if (!operator) {
      return respond(404, { message: 'Operator not found' });
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return respond(404, { message: 'Order not found' });
    }

    // Find machine in order
    const machineIndex = order.machines.findIndex(
      (m) => m.machineId.toString() === operator.machineId.toString()
    );

    if (machineIndex === -1) {
      return respond(404, { message: 'Order not assigned to this machine' });
    }

    // Update machine status
    order.machines[machineIndex].status = 'in_progress';
    order.machines[machineIndex].startedAt = new Date();
    order.machines[machineIndex].operatorId = operator._id;

    // Update overall order status if needed
    if (order.status === 'pending') {
      order.status = 'in_progress';
    }

    await order.save();

    logger.info('Order started on machine', {
      orderId,
      machineId: operator.machineId,
      operatorId,
    });

    return respond(200, {
      message: 'Order started successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.machines[machineIndex].status,
        startedAt: order.machines[machineIndex].startedAt,
      },
    });
  } catch (err) {
    logger.error('Start order error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Update order progress (mobile)
 * POST /mobile/operator/order/progress
 */
module.exports.updateOrderProgress = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { operatorId, orderId, completedPercentage, notes } = JSON.parse(event.body);

    if (!operatorId || !orderId || completedPercentage === undefined) {
      return respond(400, {
        message: 'operatorId, orderId, and completedPercentage are required',
      });
    }

    // Validate percentage
    if (completedPercentage < 0 || completedPercentage > 100) {
      return respond(400, { message: 'completedPercentage must be between 0 and 100' });
    }

    // Get operator
    const operator = await Operator.findById(operatorId);
    if (!operator) {
      return respond(404, { message: 'Operator not found' });
    }

    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return respond(404, { message: 'Order not found' });
    }

    // Find machine in order
    const machineIndex = order.machines.findIndex(
      (m) => m.machineId.toString() === operator.machineId.toString()
    );

    if (machineIndex === -1) {
      return respond(404, { message: 'Order not assigned to this machine' });
    }

    // Update progress
    order.machines[machineIndex].completedPercentage = completedPercentage;
    if (notes) {
      order.machines[machineIndex].notes = notes;
    }
    order.machines[machineIndex].lastUpdatedAt = new Date();

    // Auto-complete if 100%
    if (completedPercentage === 100) {
      order.machines[machineIndex].status = 'completed';
      order.machines[machineIndex].completedAt = new Date();
    }

    await order.save();

    logger.info('Order progress updated', {
      orderId,
      machineId: operator.machineId,
      completedPercentage,
    });

    return respond(200, {
      message: 'Progress updated successfully',
      completedPercentage,
      status: order.machines[machineIndex].status,
    });
  } catch (err) {
    logger.error('Update order progress error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Pause order (mobile)
 * POST /mobile/operator/order/pause
 */
module.exports.pauseOrderMobile = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { operatorId, orderId, reason } = JSON.parse(event.body);

    if (!operatorId || !orderId) {
      return respond(400, { message: 'operatorId and orderId are required' });
    }

    const operator = await Operator.findById(operatorId);
    if (!operator) {
      return respond(404, { message: 'Operator not found' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return respond(404, { message: 'Order not found' });
    }

    const machineIndex = order.machines.findIndex(
      (m) => m.machineId.toString() === operator.machineId.toString()
    );

    if (machineIndex === -1) {
      return respond(404, { message: 'Order not assigned to this machine' });
    }

    order.machines[machineIndex].status = 'paused';
    order.machines[machineIndex].pausedAt = new Date();
    if (reason) {
      order.machines[machineIndex].notes = reason;
    }

    await order.save();

    logger.info('Order paused', { orderId, machineId: operator.machineId, reason });

    return respond(200, {
      message: 'Order paused successfully',
    });
  } catch (err) {
    logger.error('Pause order error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Resume order (mobile)
 * POST /mobile/operator/order/resume
 */
module.exports.resumeOrderMobile = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { operatorId, orderId } = JSON.parse(event.body);

    if (!operatorId || !orderId) {
      return respond(400, { message: 'operatorId and orderId are required' });
    }

    const operator = await Operator.findById(operatorId);
    if (!operator) {
      return respond(404, { message: 'Operator not found' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return respond(404, { message: 'Order not found' });
    }

    const machineIndex = order.machines.findIndex(
      (m) => m.machineId.toString() === operator.machineId.toString()
    );

    if (machineIndex === -1) {
      return respond(404, { message: 'Order not assigned to this machine' });
    }

    order.machines[machineIndex].status = 'in_progress';
    order.machines[machineIndex].resumedAt = new Date();

    await order.save();

    logger.info('Order resumed', { orderId, machineId: operator.machineId });

    return respond(200, {
      message: 'Order resumed successfully',
    });
  } catch (err) {
    logger.error('Resume order error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get operator's work history (mobile)
 * GET /mobile/operator/history
 */
module.exports.getOperatorHistory = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { operatorId, days = 7, limit = 50 } = event.queryStringParameters || {};

    if (!operatorId) {
      return respond(400, { message: 'operatorId is required' });
    }

    const operator = await Operator.findById(operatorId).lean();
    if (!operator) {
      return respond(404, { message: 'Operator not found' });
    }

    // Get orders from last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const orders = await Order.find({
      'machines.machineId': operator.machineId,
      'machines.operatorId': operatorId,
      'machines.startedAt': { $gte: startDate },
    })
      .select('orderNumber customerName deliveryDate machines createdAt')
      .sort({ 'machines.startedAt': -1 })
      .limit(parseInt(limit))
      .lean();

    const history = orders.map((order) => {
      const machineData = order.machines.find(
        (m) => m.operatorId && m.operatorId.toString() === operatorId
      );

      return {
        id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: machineData?.status,
        startedAt: machineData?.startedAt,
        completedAt: machineData?.completedAt,
        completedPercentage: machineData?.completedPercentage || 0,
      };
    });

    return respond(200, {
      history,
      count: history.length,
    });
  } catch (err) {
    logger.error('Get operator history error', { error: err.message });
    return respond(500, { message: err.message });
  }
});