const MachineType = require('../../models/MachineType/MachineType');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const Machine = require('../../models/Machine/machine');


const respond = (statusCode, body) => ({
  statusCode,
  headers: {
   'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'post, OPTIONS',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  
  const headers = event.headers || {};
  const apiKeyHeader = Object.keys(headers).find(
    (h) => h.toLowerCase() === 'x-api-key'
  );
  const apiKey = apiKeyHeader ? headers[apiKeyHeader] : null;
  return apiKey === process.env.API_KEY;
};


module.exports.createMachineType = async (event) => {

  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  // Connect to database using your existing function
  await connect();

  try {
    // Parse and verify token (exact same pattern as your working function)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    // Check user permissions (exact same pattern)
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    // Parse request body
    const body = JSON.parse(event.body);
    const { type, description, branchId: bodyBranchId } = body;

    // Validate required fields
    if (!type) {
      return respond(400, { message: 'Machine type is required' });
    }

    if (!description) {
      return respond(400, { message: 'Description is required' });
    }

    // Determine branchId (same logic as your working function)
    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;
    
    if (!branchId) {
      return respond(400, { message: 'Branch ID is required' });
    }

    // Check if machine type already exists (case-insensitive, same branch)
    const exists = await MachineType.findOne({
      type: { $regex: `^${type}$`, $options: 'i' },
      branchId,
    });

    if (exists) {
      return respond(400, { message: 'Machine type already exists in this branch' });
    }

    // Create and save new machine type
    const machineType = new MachineType({ 
      type, 
      description, 
      branchId 
    });
    
    await machineType.save();

    // Return success response using your helper function
    return respond(201, machineType);

  } catch (error) {
    console.error('Create Machine Type Error:', error);
    return respond(500, { message: error.message });
  }
};
// ✅ Get All Machine Types
module.exports.getMachineTypes = async (event) => {
  await connect();

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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