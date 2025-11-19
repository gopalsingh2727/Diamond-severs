const mongoose = require('mongoose');

// Import models (lazy load to avoid circular dependencies)
let Order, Machine, MachineOperator, Customer, Material, Branch;

const loadModels = () => {
  if (!Order) {
    Order = require('../../models/oders/oders');
    Machine = require('../../models/Machine/machine');
    MachineOperator = require('../../models/MachineOperator/MachineOperator');
    Customer = require('../../models/Customer/customer');
    Material = require('../../models/Material/material');
    Branch = require('../../models/Branch/Branch');
  }
};

// ============================================================================
// TOOL QUERY EXECUTOR
// ============================================================================

/**
 * Execute a tool query based on command
 */
const executeToolQuery = async (toolName, params, user) => {
  loadModels();

  switch (toolName) {
    case 'orders':
      return await queryOrders(params, user);

    case 'machines':
      return await queryMachines(params, user);

    case 'operators':
      return await queryOperators(params, user);

    case 'analytics':
      return await getAnalytics(params, user);

    case 'customers':
      return await queryCustomers(params, user);

    case 'materials':
      return await queryMaterials(params, user);

    default:
      return {
        text: `Tool "${toolName}" is not available.`,
        data: null
      };
  }
};

// ============================================================================
// ORDER QUERIES
// ============================================================================

const queryOrders = async (params, user) => {
  const { status = 'pending', branchId, product27InfinityId } = params;

  // Build query with role-based filtering
  const query = {};

  if (branchId) {
    query.branchId = branchId;
  }
  if (product27InfinityId) {
    query.product27InfinityId = product27InfinityId;
  }

  // Status filter
  if (status && status !== 'all') {
    const statusMap = {
      'pending': 'pending',
      'in-progress': 'in-progress',
      'inprogress': 'in-progress',
      'completed': 'completed',
      'done': 'completed'
    };
    query.overallStatus = statusMap[status.toLowerCase()] || status;
  }

  try {
    const orders = await Order.find(query)
      .select('orderId customerInfo overallStatus priority createdAt steps')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (orders.length === 0) {
      return {
        text: `No ${status} orders found.`,
        data: []
      };
    }

    // Format response
    let text = `**${status.charAt(0).toUpperCase() + status.slice(1)} Orders (${orders.length}):**\n\n`;

    orders.forEach((order, i) => {
      const priority = order.priority === 'high' ? '🔴' : order.priority === 'normal' ? '🟡' : '🟢';
      const customer = order.customerInfo?.accountName || 'Unknown Customer';
      const date = new Date(order.createdAt).toLocaleDateString('en-IN');

      text += `${i + 1}. ${priority} **${order.orderId}**\n`;
      text += `   Customer: ${customer}\n`;
      text += `   Status: ${order.overallStatus}\n`;
      text += `   Date: ${date}\n\n`;
    });

    return { text, data: orders };

  } catch (error) {
    console.error('Order query error:', error);
    return {
      text: 'Failed to fetch orders. Please try again.',
      data: null
    };
  }
};

// ============================================================================
// MACHINE QUERIES
// ============================================================================

const queryMachines = async (params, user) => {
  const { status, branchId, product27InfinityId } = params;

  const query = {};
  if (branchId) query.branchId = branchId;
  if (product27InfinityId) query.product27InfinityId = product27InfinityId;
  if (status) query.status = status.toLowerCase();

  try {
    const machines = await Machine.find(query)
      .select('machineName machineType status location')
      .sort({ machineName: 1 })
      .limit(50)
      .lean();

    if (machines.length === 0) {
      return {
        text: status ? `No ${status} machines found.` : 'No machines found.',
        data: []
      };
    }

    // Group by status
    const grouped = {
      running: [],
      idle: [],
      maintenance: [],
      offline: []
    };

    machines.forEach(m => {
      const s = (m.status || 'idle').toLowerCase();
      if (grouped[s]) {
        grouped[s].push(m);
      } else {
        grouped.idle.push(m);
      }
    });

    let text = `**Machine Status (${machines.length} total):**\n\n`;

    if (grouped.running.length > 0) {
      text += `🟢 **Running (${grouped.running.length}):**\n`;
      grouped.running.forEach(m => {
        text += `   • ${m.machineName}\n`;
      });
      text += '\n';
    }

    if (grouped.idle.length > 0) {
      text += `🟡 **Idle (${grouped.idle.length}):**\n`;
      grouped.idle.forEach(m => {
        text += `   • ${m.machineName}\n`;
      });
      text += '\n';
    }

    if (grouped.maintenance.length > 0) {
      text += `🔴 **Maintenance (${grouped.maintenance.length}):**\n`;
      grouped.maintenance.forEach(m => {
        text += `   • ${m.machineName}\n`;
      });
      text += '\n';
    }

    if (grouped.offline.length > 0) {
      text += `⚫ **Offline (${grouped.offline.length}):**\n`;
      grouped.offline.forEach(m => {
        text += `   • ${m.machineName}\n`;
      });
    }

    return { text, data: machines };

  } catch (error) {
    console.error('Machine query error:', error);
    return {
      text: 'Failed to fetch machines. Please try again.',
      data: null
    };
  }
};

// ============================================================================
// OPERATOR QUERIES
// ============================================================================

const queryOperators = async (params, user) => {
  const { branchId, product27InfinityId } = params;

  const query = {};
  if (branchId) query.branchId = branchId;
  if (product27InfinityId) query.product27InfinityId = product27InfinityId;

  try {
    const operators = await MachineOperator.find(query)
      .select('username machineId isActive lastLogin')
      .populate('machineId', 'machineName')
      .sort({ username: 1 })
      .limit(50)
      .lean();

    if (operators.length === 0) {
      return {
        text: 'No operators found.',
        data: []
      };
    }

    // Separate active and inactive
    const active = operators.filter(o => o.isActive !== false);
    const inactive = operators.filter(o => o.isActive === false);

    let text = `**Operators (${operators.length} total):**\n\n`;

    if (active.length > 0) {
      text += `🟢 **Active (${active.length}):**\n`;
      active.forEach(op => {
        const machine = op.machineId?.machineName || 'Unassigned';
        text += `   • ${op.username} - ${machine}\n`;
      });
      text += '\n';
    }

    if (inactive.length > 0) {
      text += `⚫ **Inactive (${inactive.length}):**\n`;
      inactive.forEach(op => {
        text += `   • ${op.username}\n`;
      });
    }

    return { text, data: operators };

  } catch (error) {
    console.error('Operator query error:', error);
    return {
      text: 'Failed to fetch operators. Please try again.',
      data: null
    };
  }
};

// ============================================================================
// ANALYTICS
// ============================================================================

const getAnalytics = async (params, user) => {
  const { period = 'today', branchId, product27InfinityId } = params;

  const query = {};
  if (branchId) query.branchId = branchId;
  if (product27InfinityId) query.product27InfinityId = product27InfinityId;

  // Date range based on period
  const now = new Date();
  let startDate = new Date(now);

  switch (period.toLowerCase()) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    default:
      startDate.setHours(0, 0, 0, 0);
  }

  query.createdAt = { $gte: startDate };

  try {
    // Get order statistics
    const orderStats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$overallStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total counts
    const totalOrders = orderStats.reduce((sum, s) => sum + s.count, 0);
    const pending = orderStats.find(s => s._id === 'pending')?.count || 0;
    const inProgress = orderStats.find(s => s._id === 'in-progress')?.count || 0;
    const completed = orderStats.find(s => s._id === 'completed')?.count || 0;

    // Get machine stats
    const machineQuery = {};
    if (branchId) machineQuery.branchId = branchId;
    if (product27InfinityId) machineQuery.product27InfinityId = product27InfinityId;

    const machineStats = await Machine.aggregate([
      { $match: machineQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalMachines = machineStats.reduce((sum, s) => sum + s.count, 0);
    const runningMachines = machineStats.find(s => s._id === 'running')?.count || 0;
    const idleMachines = machineStats.find(s => s._id === 'idle')?.count || 0;

    // Format response
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    let text = `**${periodLabel}'s Analytics:**\n\n`;

    text += `📦 **Orders:**\n`;
    text += `   Total: ${totalOrders}\n`;
    text += `   Pending: ${pending}\n`;
    text += `   In Progress: ${inProgress}\n`;
    text += `   Completed: ${completed}\n\n`;

    text += `🏭 **Machines:**\n`;
    text += `   Total: ${totalMachines}\n`;
    text += `   Running: ${runningMachines}\n`;
    text += `   Idle: ${idleMachines}\n`;

    if (totalOrders > 0) {
      const completionRate = ((completed / totalOrders) * 100).toFixed(1);
      text += `\n📊 **Completion Rate:** ${completionRate}%`;
    }

    return {
      text,
      data: {
        orders: { total: totalOrders, pending, inProgress, completed },
        machines: { total: totalMachines, running: runningMachines, idle: idleMachines }
      }
    };

  } catch (error) {
    console.error('Analytics error:', error);
    return {
      text: 'Failed to fetch analytics. Please try again.',
      data: null
    };
  }
};

// ============================================================================
// CUSTOMER QUERIES
// ============================================================================

const queryCustomers = async (params, user) => {
  const { search, branchId, product27InfinityId } = params;

  const query = {};
  if (branchId) query.branchId = branchId;
  if (product27InfinityId) query.product27InfinityId = product27InfinityId;

  if (search) {
    query.$or = [
      { accountName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  try {
    const customers = await Customer.find(query)
      .select('accountName email phone address')
      .sort({ accountName: 1 })
      .limit(20)
      .lean();

    if (customers.length === 0) {
      return {
        text: search ? `No customers found matching "${search}".` : 'No customers found.',
        data: []
      };
    }

    let text = `**Customers (${customers.length}):**\n\n`;

    customers.forEach((c, i) => {
      text += `${i + 1}. **${c.accountName}**\n`;
      if (c.phone) text += `   📞 ${c.phone}\n`;
      if (c.email) text += `   📧 ${c.email}\n`;
      text += '\n';
    });

    return { text, data: customers };

  } catch (error) {
    console.error('Customer query error:', error);
    return {
      text: 'Failed to fetch customers. Please try again.',
      data: null
    };
  }
};

// ============================================================================
// MATERIAL QUERIES
// ============================================================================

const queryMaterials = async (params, user) => {
  const { branchId, product27InfinityId } = params;

  const query = {};
  if (branchId) query.branchId = branchId;
  if (product27InfinityId) query.product27InfinityId = product27InfinityId;

  try {
    const materials = await Material.find(query)
      .select('materialName materialType')
      .sort({ materialName: 1 })
      .limit(50)
      .lean();

    if (materials.length === 0) {
      return {
        text: 'No materials found.',
        data: []
      };
    }

    let text = `**Materials (${materials.length}):**\n\n`;

    materials.forEach((m, i) => {
      text += `${i + 1}. ${m.materialName}`;
      if (m.materialType) text += ` (${m.materialType})`;
      text += '\n';
    });

    return { text, data: materials };

  } catch (error) {
    console.error('Material query error:', error);
    return {
      text: 'Failed to fetch materials. Please try again.',
      data: null
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  executeToolQuery,
  queryOrders,
  queryMachines,
  queryOperators,
  getAnalytics,
  queryCustomers,
  queryMaterials
};
