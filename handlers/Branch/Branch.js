const Branch = require('../../models/Branch/Branch');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');

module.exports.createBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // 🔐 API Key validation
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-API-Key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
    };
  }

  await connect();

  try {
    const authorization = headers['authorization'] || headers['Authorization'];

    if (!authorization) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'No authorization header provided' }),
      };
    }

    const user = verifyToken(authorization);

    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin can create branches' }),
      };
    }

    const body = JSON.parse(event.body);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';

    if (!name) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch name is required and must be a string.' }),
      };
    }

    const existing = await Branch.findOne({ name: name.toLowerCase() });
    if (existing) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch already exists' }),
      };
    }

    const branch = new Branch({
      name: name.toLowerCase(),
      location,
    });

    console.log(branch, 'branchidname');

    await branch.save();

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(branch),
    };
  } catch (err) {
    console.error('Branch creation error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

module.exports.getAllBranches = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Validate API key
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-API-Key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
    };
  }

  await connect();

  try {
    const auth = headers['authorization'] || headers['Authorization'];
    const user = verifyToken(auth);

    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Access denied' }),
      };
    }

    const branches = await Branch.find({});
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(branches),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};


module.exports.selectBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  const headers = event.headers || {};
  
  // API Key check
  const apiKey = headers['x-api-key'] || headers['X-API-Key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
    };
  }

  await connect();

  try {
    const auth = headers['authorization'] || headers['Authorization'];
    const user = verifyToken(auth);

    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Access denied' }),
      };
    }

    const body = JSON.parse(event.body);
    const branchId = body.branchId;

    if (!branchId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch ID is required' }),
      };
    }

    const branch = await Branch.findById(branchId).select('name location');

    if (!branch) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        branchId: branch._id,
        name: branch.name,
        location: branch.location,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

module.exports.updateBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Content-Type': 'application/json',
  };

  // CORS preflight support
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  await connect();

  try {
    const headers = event.headers || {};
    const authorization = headers['authorization'] || headers['Authorization'];
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];

    // API key check
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    // JWT auth check
    const user = verifyToken(authorization);
    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin can update branches' }),
      };
    }

    const branchId = event.pathParameters?.id;
    const { name, location } = JSON.parse(event.body);

    const updatedBranch = await Branch.findByIdAndUpdate(
      branchId,
      { name: name?.toLowerCase(), location },
      { new: true }
    );

    if (!updatedBranch) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(updatedBranch),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};
module.exports.deleteBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  await connect();

  try {
    const headers = event.headers || {};
    const authorization = headers['authorization'] || headers['Authorization'];
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];

    // API key check
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    // JWT check
    const user = verifyToken(authorization);
    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin can delete branches' }),
      };
    }

    const branchId = event.pathParameters?.id;

    const deleted = await Branch.findByIdAndDelete(branchId);

    if (!deleted) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Branch deleted successfully' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};