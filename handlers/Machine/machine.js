const Machine = require('../../models/Machine/machine');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');
const MachineType = require('../../models/machineType/machineType'); 
const Branch = require('../../models/Branch/Branch');
const mongoose = require("mongoose");

module.exports.createMachine = async (event) => {
  await connect();

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // 🌐 Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // ✅ API Key validation
    const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);
    
    console.log('Full tableConfig:', JSON.stringify(body.tableConfig, null, 2));
    // ✅ Authorization check
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Access denied' }),
      };
    }

    // ✅ Required fields validation
    const requiredFields = ['machineName', 'machineType', 'branchId'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: `${field} is required` }),
        };
      }
    }

    // 🔒 Manager branch protection
    if (user.role === 'manager' && body.branchId !== user.branchId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Cannot create machine in other branch' }),
      };
    }

    // ✅ Check for unique machine name (normalized)
    const normalizedName = body.machineName.trim().toLowerCase();
    const exists = await Machine.findOne({ machineName: normalizedName });
    if (exists) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Machine name must be unique' }),
      };
    }

    // ✅ Machine type validation
    const machineTypeExists = await MachineType.findById(body.machineType);
    if (!machineTypeExists) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid machine type' }),
      };
    }

    // ✅ Create machine WITH tableConfig support
    const machine = new Machine({
      machineName: normalizedName,
      machineType: body.machineType,
      sizeX: body.sizeX,
      sizeY: body.sizeY,
      sizeZ: body.sizeZ,
      branchId: body.branchId,
      ...(body.tableConfig && { tableConfig: body.tableConfig }), // ✅ FIXED: Now includes tableConfig
    });

    await machine.save();

    console.log('Machine created successfully with ID:', machine._id);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Machine created successfully',
        machine,
      }),
    };
  } catch (err) {
    console.error('Create machine error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: err.message || 'Server error',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined 
      }),
    };
  }
};

// ✅ GET ALL MACHINES
module.exports.getAllMachines = async (event) => {
  await connect();

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // ✅ Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // ✅ API key validation
    const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Missing Authorization token' }),
      };
    }

    const user = await verifyToken(authHeader); 
    if (!user || !user.role) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    const query = {};
    const params = event.queryStringParameters || {};


    if (user.role === 'manager') {
      query.branchId = user.branchId;
    } else if (user.role === 'admin' && params.branchId) {
      // ✅ Validate branchId format
      const isValidId = /^[0-9a-fA-F]{24}$/.test(params.branchId);
      if (!isValidId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'Invalid branch ID format' }),
        };
      }

      // ✅ Confirm branch exists
      const branchExists = await Branch.findById(params.branchId);
      if (!branchExists) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'Invalid branch ID' }),
        };
      }
      query.branchId = params.branchId;
    }

    const machines = await Machine.find(query)
      .populate('machineType', 'type description')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        machines,
        count: machines.length,
      }),
    };
  } catch (err) {
    console.error('Get machines error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: err.message || 'Server error' }),
    };
  }
};

// // ✅ GET ONE MACHINE
// const mongoose = require('mongoose');
// const { verifyToken } = require('../utils/jwt'); // adjust path if needed
// const { connect } = require('../db'); // adjust path if needed
// const Machine = require('../models/Machine'); // adjust path if needed
// const Branch = require('../models/Branch'); // if needed

module.exports.getOneMachine = async (event) => {
  await connect();

  try {
    // ✅ API key validation
    const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    // ✅ Check and verify JWT
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing Authorization token' }),
      };
    }

    const user = await verifyToken(authHeader);
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    const { id } = event.pathParameters;

    // ✅ Validate machine ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid machine ID' }),
      };
    }

    const query = { _id: id };

    // ✅ Role-based filtering
    if (user.role === 'manager') {
      query.branchId = user.branchId;
    }

    const machine = await Machine.findOne(query)
      .populate('machineType', 'type description')
      .populate('branchId', 'name location');

    if (!machine) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Machine not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ machine }),
    };
  } catch (err) {
    console.error('Get one machine error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: err.message }),
    };
  }
};

// ✅ UPDATE MACHINE


module.exports.updateMachine = async (event) => {
  await connect();
  try {
    // ✅ API key validation
    const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
    if (apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid API key' }),
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Authorization token missing' }),
      };
    }

    const user = verifyToken(authHeader);
    const { id } = event.pathParameters;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid machine ID' }),
      };
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Access denied' }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseErr) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid JSON body' }),
      };
    }

    const query = { _id: id };

    if (user.role === 'manager') {
      query.branchId = user.branchId;
    }

    const existingMachine = await Machine.findOne(query);
    if (!existingMachine) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Machine not found or access denied' }),
      };
    }

    // Duplicate machine name check
    if (body.machineName && body.machineName !== existingMachine.machineName) {
      const nameExists = await Machine.findOne({
        machineName: body.machineName.trim(),
        _id: { $ne: id },
      });
      if (nameExists) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ message: 'Machine name must be unique' }),
        };
      }
    }

    // Validate machineType
    if (body.machineType) {
      const machineTypeExists = await MachineType.findById(body.machineType);
      if (!machineTypeExists) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ message: 'Invalid machine type' }),
        };
      }
    }

    // Manager cannot change branchId
    if (user.role === 'manager' && body.branchId && body.branchId !== user.branchId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Cannot move machine to other branch' }),
      };
    }

    const updatedMachine = await Machine.findByIdAndUpdate(
      id,
      { ...body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('machineType', 'type description')
      .populate('branchId', 'name location');

    if (!updatedMachine) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Machine update failed unexpectedly' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Machine updated successfully',
        machine: updatedMachine,
      }),
    };
  } catch (err) {
    console.error('Update machine error:', err);
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

// ✅ DELETE MACHINE


module.exports.deleteMachine = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const apiKey = event.headers['x-api-key'];

    // ✅ API key validation
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Invalid API Key' })
      };
    }

    // ✅ Auth header check
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Authorization header missing' })
      };
    }

    const user = verifyToken(authHeader);
    const { id } = event.pathParameters;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Invalid machine ID' })
      };
    }

    // ✅ Role check
    if (user.role !== 'admin' && user.role !== 'manager') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Access denied' })
      };
    }

    const query = { _id: id };

    // ✅ Restrict manager to their branch
    if (user.role === 'manager') {
      query.branchId = user.branchId;
    }

    const machine = await Machine.findOneAndDelete(query);

    if (!machine) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Machine not found or access denied' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Machine deleted successfully',
        deletedMachine: machine
      })
    };
  } catch (err) {
    console.error('Delete machine error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: err.message })
    };
  }
};
