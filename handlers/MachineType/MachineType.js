const MachineType = require('../../models/MachineType/MachineType');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const Machine = require('../../models/Machine/machine');
const mongoose = require('mongoose');

module.exports.createMachineType = async (event) => {
  await connect();

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // ✅ Check API key
    const apiKey = event.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Invalid API key' }),
      };
    }

    // ✅ Parse token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      };
    }

    // ✅ Only admin or manager allowed
    if (user.role !== 'admin' && user.role !== 'manager') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    // ✅ Parse body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid JSON body' }),
      };
    }

    // ✅ Validate required fields
    if (!body.type || !body.description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'type and description are required' }),
      };
    }

    if (user.role === 'admin' && !body.branchId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'branchId is required for admin' }),
      };
    }

    // ✅ Optional: validate ObjectId format
    if (user.role === 'admin' && !mongoose.Types.ObjectId.isValid(body.branchId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid branchId format' }),
      };
    }

    // ✅ Check uniqueness
    const exists = await MachineType.findOne({ type: body.type });
    if (exists) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Machine type must be unique' }),
      };
    }

    // ✅ Create and save
    const machineType = new MachineType({
      type: body.type,
      description: body.description,
      branchId: user.role === 'admin' ? body.branchId : user.branchId
    });

    await machineType.save();

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(machineType)
    };

  } catch (error) {
    console.error('Error creating machine type:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

// ✅ Get All Machine Types
module.exports.getMachineTypes = async (event) => {
  await connect();

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // ✅ API key check
    const apiKey = event.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Invalid API key' }),
      };
    }

    // ✅ Token auth check
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      };
    }

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    // ✅ Filter machine types based on role
    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    const machineTypes = await MachineType.find(filter);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(machineTypes)
    };

  } catch (error) {
    console.error("getMachineTypes error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};

// ✅ Update Machine Type
module.exports.updateMachineType = async (event) => {
  await connect();

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // ✅ API Key validation
    const apiKey = event.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Invalid API key' })
      };
    }

    // ✅ Auth validation
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch (err) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid or missing token' })
      };
    }

    const id = event.pathParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing machine type ID' })
      };
    }

    const body = JSON.parse(event.body || '{}');

    const machineType = await MachineType.findById(id);
    if (!machineType) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Not found' })
      };
    }

    // ✅ Role check
    if (user.role !== 'admin' && user.branchId !== String(machineType.branchId)) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    // ✅ Update fields safely
    machineType.type = body.type || machineType.type;
    machineType.description = body.description || machineType.description;
    await machineType.save();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(machineType)
    };

  } catch (error) {
    console.error("updateMachineType error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};
// ✅ Delete Machine Type
module.exports.deleteMachineType = async (event) => {
  await connect();

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // ✅ API key validation
    const apiKey = event.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Invalid API key' })
      };
    }

    // ✅ Token parsing with fallback and error handling
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch (err) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid or missing token' })
      };
    }

    // ✅ Safe access to ID
    const id = event.pathParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing machine type ID' })
      };
    }

    const machineType = await MachineType.findById(id);
    if (!machineType) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Not found' })
      };
    }

    // ✅ Role-based deletion authorization
    if (user.role !== 'admin' && user.branchId !== String(machineType.branchId)) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    await machineType.deleteOne();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Deleted successfully' })
    };

  } catch (error) {
    console.error('deleteMachineType error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: error.message })
    };
  }
};

module.exports.getAllMachineTypesWithMachines = async (event) => {
  await connect();

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    // ✅ API Key check
    const apiKey = event.headers?.['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Invalid API key' }),
      };
    }

    // ✅ Safe token handling
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid or missing token' }),
      };
    }

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: 'Unauthorized access' }),
      };
    }

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    const machineTypes = await MachineType.find(filter);

    const results = await Promise.all(
      machineTypes.map(async (type) => {
        const machines = await Machine.find({ machineType: type._id });
        return {
          ...type.toObject(),
          machines,
        };
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results),
    };

  } catch (err) {
    console.error('Error fetching machine types with machines:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: err.message }),
    };
  }
};