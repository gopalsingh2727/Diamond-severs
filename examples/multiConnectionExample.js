/**
 * Multi-Connection Usage Examples
 *
 * This file contains practical examples of using multiple database connections
 * in Lambda handlers for the 27 Manufacturing System.
 */

// ============================================================================
// EXAMPLE 1: Basic Usage - Main Database
// ============================================================================

/**
 * Get all branches from main database
 */
const getBranchesExample = async (event) => {
  const { getMainConnection } = require('../config/mongodb/connections');

  try {
    // Connect to main database
    const connection = await getMainConnection();

    // Get Branch model from main database
    const Branch = connection.models.Branch ||
                   connection.model('Branch', require('../models/Branch/Branch').schema);

    // Query the model
    const branches = await Branch.find({ isActive: true });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Success',
        data: branches,
        count: branches.length
      })
    };

  } catch (error) {
    console.error('Error fetching branches:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// EXAMPLE 2: Using Model Factory (Recommended)
// ============================================================================

/**
 * Get MasterAdmin dashboard data using model factory
 */
const getMasterAdminDashboard = async (event) => {
  const { getModel } = require('../config/mongodb/modelFactory');

  try {
    // API Key validation
    const apiKey = event.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid API key' })
      };
    }

    // Get models from appropriate databases
    const MasterAdmin = await getModel('MasterAdmin', 'masteradmin');
    const Branch = await getModel('Branch', 'main');
    const Order = await getModel('Order', 'main');
    const Machine = await getModel('Machine', 'main');

    // Fetch data from both databases
    const [totalAdmins, totalBranches, totalOrders, totalMachines] = await Promise.all([
      MasterAdmin.countDocuments({ isActive: true }),
      Branch.countDocuments({ isActive: true }),
      Order.countDocuments({}),
      Machine.countDocuments({ isActive: true })
    ]);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Dashboard data retrieved successfully',
        data: {
          masterAdmins: totalAdmins,
          branches: totalBranches,
          orders: totalOrders,
          machines: totalMachines
        }
      })
    };

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// EXAMPLE 3: Cross-Database Operations
// ============================================================================

/**
 * Create a branch and log in MasterAdmin database
 */
const createBranchWithLogging = async (event) => {
  const { getMainConnection, getMasterAdminConnection } = require('../config/mongodb/connections');

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { name, location, code, masterAdminId } = body;

    // Connect to both databases
    const mainDb = await getMainConnection();
    const masterAdminDb = await getMasterAdminConnection();

    // Get models from different databases
    const Branch = mainDb.model('Branch', require('../models/Branch/Branch').schema);
    const MasterAdmin = masterAdminDb.model('MasterAdmin', require('../models/masterAdmin/masterAdmin').schema);

    // Verify MasterAdmin exists in masteradmin database
    const masterAdmin = await MasterAdmin.findById(masterAdminId);
    if (!masterAdmin) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'MasterAdmin not found' })
      };
    }

    // Create branch in main database
    const branch = await Branch.create({
      name,
      location,
      code,
      userId: masterAdminId,
      product27InfinityId: body.product27InfinityId
    });

    // Log the action (could be a separate ActivityLog model in masteradmin db)
    console.log(`Branch ${branch.name} created by MasterAdmin ${masterAdmin.fullName}`);

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Branch created successfully',
        data: branch,
        createdBy: masterAdmin.fullName
      })
    };

  } catch (error) {
    console.error('Error creating branch:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// EXAMPLE 4: Using Multiple Models from Model Factory
// ============================================================================

/**
 * Get comprehensive analytics using multiple models
 */
const getAnalytics = async (event) => {
  const { getModels } = require('../config/mongodb/modelFactory');

  try {
    // Get multiple models from main database at once
    const mainModels = await getModels(
      ['Branch', 'Order', 'Machine', 'Customer'],
      'main'
    );

    // Get MasterAdmin model from masteradmin database
    const masterAdminModels = await getModels(
      ['MasterAdmin'],
      'masteradmin'
    );

    // Destructure models
    const { Branch, Order, Machine, Customer } = mainModels;
    const { MasterAdmin } = masterAdminModels;

    // Aggregate data
    const analytics = await Promise.all([
      Branch.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Machine.countDocuments({ isActive: true }),
      Customer.countDocuments({ isActive: true }),
      MasterAdmin.countDocuments({ isActive: true })
    ]);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Analytics retrieved successfully',
        data: {
          branches: analytics[0][0]?.total || 0,
          ordersByStatus: analytics[1],
          activeMachines: analytics[2],
          customers: analytics[3],
          masterAdmins: analytics[4]
        }
      })
    };

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// EXAMPLE 5: Dynamic Connection Selection
// ============================================================================

/**
 * Dynamically select database based on user role
 */
const getUserData = async (event) => {
  const { getConnection } = require('../config/mongodb/connections');

  try {
    // Determine connection type based on user role
    const userRole = event.requestContext?.authorizer?.role || 'admin';

    const connectionType = userRole === 'master_admin' ? 'masteradmin' : 'main';

    // Get appropriate connection
    const connection = await getConnection(connectionType);

    // Get user model based on role
    let User;
    if (userRole === 'master_admin') {
      User = connection.models.MasterAdmin ||
             connection.model('MasterAdmin', require('../models/masterAdmin/masterAdmin').schema);
    } else {
      User = connection.models.Admin ||
             connection.model('Admin', require('../models/Admin/Admin').schema);
    }

    // Fetch user data
    const userId = event.pathParameters?.id;
    const user = await User.findById(userId);

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'User data retrieved successfully',
        data: user
      })
    };

  } catch (error) {
    console.error('Error fetching user data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// EXAMPLE 6: Transaction Across Same Database (Not Cross-Database)
// ============================================================================

/**
 * Create order with transaction in main database
 * Note: MongoDB transactions work within the same database/replica set
 */
const createOrderWithTransaction = async (event) => {
  const { getMainConnection } = require('../config/mongodb/connections');

  try {
    const connection = await getMainConnection();
    const session = await connection.startSession();

    let order;

    await session.withTransaction(async () => {
      const Order = connection.model('Order', require('../models/oders/oders').schema);
      const Machine = connection.model('Machine', require('../models/Machine/machine').schema);

      const body = JSON.parse(event.body || '{}');

      // Create order
      order = await Order.create([body], { session });

      // Update machine status
      await Machine.findByIdAndUpdate(
        body.machineId,
        { $set: { status: 'busy' } },
        { session }
      );
    });

    session.endSession();

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Order created successfully with transaction',
        data: order[0]
      })
    };

  } catch (error) {
    console.error('Transaction error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Transaction failed', error: error.message })
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getBranchesExample,
  getMasterAdminDashboard,
  createBranchWithLogging,
  getAnalytics,
  getUserData,
  createOrderWithTransaction
};

/**
 * USAGE IN SERVERLESS.YML:
 *
 * functions:
 *   getBranches:
 *     handler: examples/multiConnectionExample.getBranchesExample
 *     events:
 *       - http:
 *           path: /examples/branches
 *           method: get
 *
 *   masterAdminDashboard:
 *     handler: examples/multiConnectionExample.getMasterAdminDashboard
 *     events:
 *       - http:
 *           path: /examples/dashboard
 *           method: get
 */
