const mongoose = require('mongoose');
const Operator = require('../../models/MachineOperator/MachineOperator');
const Order = require('../../models/oders/oders');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Machine = require('../../models/Machine/machine');
const oders = require('../../models/oders/oders');
const Material = require('../../models/Material/material');
const Product = require('../../models/product/product');
const Step = require('../../models/steps/step');
const Customer = require('../../models/Customer/customer'); // adjust path to your structure

module.exports.createOperator = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only admin or manager can create operators' }),
      };
    }
   
    const { username, password, machineId, branchId } = JSON.parse(event.body);
    
    if (!username || !password || !machineId || !branchId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'All fields required' }),
      };
    }

    const exists = await Operator.findOne({ username });
    if (exists) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Operator already exists' }),
      };
    }

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Machine not found' }),
      };
    }
    

    const { machineName, machineType } = machine;

    const hashedPassword = await bcrypt.hash(password, 10);

   const operator = new Operator({
  username,
  password: hashedPassword,
  machineId, // ✅ Add this line
  machineName,
  machineType,
  branchId,
  role: 'operator',
});

    await operator.save();

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Operator created successfully' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};






module.exports.operatorLogin = async (event) => {
  await connect();

  try {
    // ✅ API key validation
    const apiKey = event.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid API key' }),
      };
    }

    // ✅ Safe body parsing
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Request body is required' }),
      };
    }

    const { username, password } = JSON.parse(event.body);

    // ✅ Required field validation
    if (!username || !password) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Username and password required' }),
      };
    }

    const operator = await Operator.findOne({ username });
    if (!operator) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid credentials' }),
      };
    }

    const passwordMatch = await bcrypt.compare(password, operator.password);
    if (!passwordMatch) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid credentials' }),
      };
    }

    // ✅ JWT payload
    const tokenPayload = {
      _id: operator._id,
      username: operator.username,
      role: operator.role,
      branchId: operator.branchId,
      machineId: operator.machineId,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    console.error('Operator login error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: err.message }),
    };
  }
};




module.exports.getOperatorOrders = async (event) => {
  await connect();

  try {
    // ✅ API Key validation
    const apiKey = event.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Invalid API key' }),
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);

    if (!operatorData || operatorData.role !== 'operator') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Operator not found' }),
      };
    }

    const machine = await Machine.findById(operator.machineId);
    if (!machine) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Machine not found' }),
      };
    }

    const allOrders = await Order.find({
      branchId: operator.branchId,
      overallStatus: { $in: ['pending', 'in_progress'] }
    }).populate('customerId productId materialId steps.stepId');

    const filteredOrders = allOrders.filter(order => {
      const step = Array.isArray(order.steps) && order.currentStepIndex >= 0
        ? order.steps[order.currentStepIndex]
        : null;

      if (!step || !Array.isArray(step.machines)) return false;

      const firstActiveMachine = step.machines.find(m => m.status !== 'completed');
      if (!firstActiveMachine) return false;

      // Optional: remove in production
      if (process.env.NODE_ENV !== 'production') {
        console.log(firstActiveMachine);
        console.log(firstActiveMachine.machineName === machine.machineName, "text");
      }

      return firstActiveMachine.machineName === machine.machineName;
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ orders: filteredOrders }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: error.message }),
    };
  }
};






module.exports.updateMachineStatus = async (event) => {
  await connect();

  // ✅ API Key Validation
  const apiKey = event.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return {
      statusCode: 403,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Invalid API key' }),
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);

    if (!operatorData || operatorData.role !== 'operator') {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    const { orderId } = event.pathParameters || {};
    const { newStatus } = JSON.parse(event.body);

    if (!['in-progress', 'completed'].includes(newStatus)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid status' }),
      };
    }

    // ✅ Validate Mongo ID
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid order ID format' }),
      };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Operator not found' }),
      };
    }

    const machine = await Machine.findById(operator.machineId);
    if (!machine) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Machine not found' }),
      };
    }

    // ✅ Prevent working on multiple orders
    if (newStatus === 'in-progress') {
      const inProgressOrder = await Order.findOne({
        _id: { $ne: orderId },
        'steps.machines': {
          $elemMatch: {
            machineName: machine.machineName,
            status: 'in-progress',
          },
        },
      });

      if (inProgressOrder) {
        return {
          statusCode: 409,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Machine '${machine.machineName}' is already working on another order.`,
          }),
        };
      }
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Order not found' }),
      };
    }

    const step = Array.isArray(order.steps) && typeof order.currentStepIndex === 'number'
      ? order.steps[order.currentStepIndex]
      : null;

    if (!step || !Array.isArray(step.machines)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid step or machine list' }),
      };
    }

    const machineIndex = step.machines.findIndex(
      (m) => m.machineName === machine.machineName
    );

    if (machineIndex === -1) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Machine not part of this step' }),
      };
    }

    const currentMachine = step.machines[machineIndex];

    const firstActiveIndex = step.machines.findIndex(
      (m) => m.status !== 'completed'
    );
    if (machineIndex !== firstActiveIndex) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Machine is not next in line to update' }),
      };
    }

    // ✅ Update machine status
    const now = new Date();
    currentMachine.status = newStatus;
    currentMachine.operatorId = operator._id;

    if (newStatus === 'in-progress') {
      currentMachine.startedAt = now;
    } else if (newStatus === 'completed') {
      currentMachine.completedAt = now;

      const allDone = step.machines.every((m) => m.status === 'completed');
      if (allDone) {
        const nextStepIndex = order.currentStepIndex + 1;
        if (nextStepIndex < order.steps.length) {
          order.currentStepIndex = nextStepIndex;
          const nextStep = order.steps[nextStepIndex];
          if (nextStep && Array.isArray(nextStep.machines) && nextStep.machines.length > 0) {
            nextStep.machines[0].status = 'pending';
          }
        } else {
          order.overallStatus = 'dispatched';
        }
      }
    }

    await order.save();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Machine status updated', order }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message }),
    };
  }
};





module.exports.getCompletedOrders = async (event) => {
  await connect();

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // ✅ API key validation
    const apiKey = event.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Invalid API key' }),
      };
    }

    // ✅ Token validation
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Missing Authorization header' }),
      };
    }

    let operatorData;
    try {
      operatorData = verifyToken(authHeader);
    } catch (err) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      };
    }

    if (!operatorData || operatorData.role !== 'operator') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    // ✅ Validate operator ID format
    if (!mongoose.Types.ObjectId.isValid(operatorData._id)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid operator ID format' }),
      };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Operator not found' }),
      };
    }

    const machine = await Machine.findById(operator.machineId);
    if (!machine) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Machine not found' }),
      };
    }

    const completedOrders = await Order.find({
      'steps.machines': {
        $elemMatch: {
          machineName: machine.machineName,
          status: 'completed',
          operatorId: operator._id,
        },
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ completedOrders }),
    };

  } catch (error) {
    console.error('Error in getCompletedOrders:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message }),
    };
  }
};












module.exports.getPendingOrders = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);

    if (!operatorData || operatorData.role !== 'operator') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Operator not found' }) };
    }

    const machine = await Machine.findById(operator.machineId);
    if (!machine) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Machine not found' }) };
    }

    const pendingOrders = await Order.find({
      'steps.machines': {
        $elemMatch: {
          machineName: machine.machineName,
          status: { $ne: 'completed' },
          operatorId: operator._id
        }
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ pendingOrders }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

module.exports.getOnePendingOrder = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);

    if (!operatorData || operatorData.role !== 'operator') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) return { statusCode: 404, body: JSON.stringify({ message: 'Operator not found' }) };

    const machine = await Machine.findById(operator.machineId);
    if (!machine) return { statusCode: 404, body: JSON.stringify({ message: 'Machine not found' }) };

    const pendingOrder = await Order.findOne({
      'steps.machines': {
        $elemMatch: {
          machineName: machine.machineName,
          status: { $ne: 'completed' }
        }
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ pendingOrder }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};


module.exports.getOneCompletedOrder = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);

    if (!operatorData || operatorData.role !== 'operator') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) return { statusCode: 404, body: JSON.stringify({ message: 'Operator not found' }) };

    const machine = await Machine.findById(operator.machineId);
    if (!machine) return { statusCode: 404, body: JSON.stringify({ message: 'Machine not found' }) };

    const completedOrder = await Order.findOne({
      'steps.machines': {
        $elemMatch: {
          machineName: machine.machineName,
          status: 'completed',
          operatorId: operator._id
        }
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ completedOrder }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};


module.exports.getOneInProgressOrder = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);

    if (!operatorData || operatorData.role !== 'operator') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Operator not found' }) };
    }

    const machine = await Machine.findById(operator.machineId);
    if (!machine) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Machine not found' }) };
    }

    const inProgressOrder = await Order.findOne({
      'steps.machines': {
        $elemMatch: {
          machineName: machine.machineName,
          status: 'in-progress',
          operatorId: operator._id
        }
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ inProgressOrder }),
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};



module.exports.updateOperatorPassword = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);

    if (!operatorData || operatorData.role !== 'operator') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const { oldPassword, newPassword } = JSON.parse(event.body);

    if (!oldPassword || !newPassword) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Both old and new password are required' }) };
    }

    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Operator not found' }) };
    }

    const isMatch = await bcrypt.compare(oldPassword, operator.password);
    if (!isMatch) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Old password is incorrect' }) };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    operator.password = hashedNewPassword;
    await operator.save();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Password updated successfully' }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};