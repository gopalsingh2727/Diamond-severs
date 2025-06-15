const MachineType = require('../../models/MachineType/MachineType');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const Machine = require('../../models/Machine/machine');
const mongoose = require('mongoose');

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
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


// STEP 1: Test basic function (deploy this first)
module.exports.createMachineType = async (event) => {
  console.log('=== createMachineType STARTED ===');
  
  try {
    // Test 1: Basic response
    console.log('Test 1: Basic response working');
    return respond(200, { message: 'createMachineType function is working', timestamp: new Date() });
    
    /* UNCOMMENT STEP BY STEP AFTER EACH ONE WORKS:
    
    // Test 2: API Key check
    console.log('Test 2: Checking API key');
    if (!checkApiKey(event)) {
      console.log('API key check failed');
      return respond(401, { message: 'Invalid API key' });
    }
    console.log('API key check passed');
    return respond(200, { message: 'API key working' });
    
    // Test 3: Database connection
    console.log('Test 3: Connecting to database');
    await connect();
    console.log('Database connected successfully');
    return respond(200, { message: 'Database connection working' });
    
    // Test 4: Token verification
    console.log('Test 4: Verifying token');
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
      console.log('User verified:', user);
    } catch (tokenError) {
      console.log('Token verification failed:', tokenError);
      return respond(401, { message: 'Invalid token' });
    }
    return respond(200, { message: 'Token verification working', user });
    
    // Test 5: Body parsing
    console.log('Test 5: Parsing body');
    const body = JSON.parse(event.body);
    console.log('Body parsed:', body);
    return respond(200, { message: 'Body parsing working', body });
    
    // Test 6: Model import test
    console.log('Test 6: Testing MachineType model');
    console.log('MachineType model:', typeof MachineType);
    return respond(200, { message: 'MachineType model imported', modelType: typeof MachineType });
    
    // Test 7: Full logic (uncomment only after all above tests pass)
    console.log('Test 7: Full function logic');
    
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const body = JSON.parse(event.body);
    const { type, description, branchId: bodyBranchId } = body;

    if (!type) {
      return respond(400, { message: 'Machine type is required' });
    }

    if (!description) {
      return respond(400, { message: 'Description is required' });
    }

    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;
    
    if (!branchId) {
      return respond(400, { message: 'Branch ID is required' });
    }

    const exists = await MachineType.findOne({
      type: { $regex: `^${type}$`, $options: 'i' },
      branchId,
    });

    if (exists) {
      return respond(400, { message: 'Machine type already exists in this branch' });
    }

    const machineType = new MachineType({ 
      type, 
      description, 
      branchId 
    });
    
    await machineType.save();

    return respond(201, machineType);
    */
    
  } catch (error) {
    console.error('=== ERROR in createMachineType ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return respond(500, { message: 'Function error: ' + error.message });
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