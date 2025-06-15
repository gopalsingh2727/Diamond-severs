require('dotenv').config();
const jwt = require('jsonwebtoken');
const  connectDB  = require('../../config/mongodb/db');
const User = require('../../models/Admin/Admin');

// CREATE ADMIN (only once)
module.exports.createAdmin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    console.log('Incoming event:', JSON.stringify(event, null, 2));

    const headers = event.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    await connectDB();
    console.log('DB connected');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Admin already exists' }),
      };
    }

    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (err) {
      console.error('Body parse failed', err);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid JSON body' }),
      };
    }

    const { username, password } = body;

    if (!username || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Username and password are required' }),
      };
    }

    const admin = new User({ username, password, role: 'admin' });
    await admin.save();
    console.log('Admin saved');

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Admin created successfully' }),
    };

  } catch (error) {
    console.error('CreateAdmin error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};

module.exports.loginAdmin = async (event) => {
  console.log('Function started, event:', JSON.stringify(event, null, 2));

  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    console.log('Starting POST request processing');

    // ✅ API key check
    const headers = event.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      console.warn('Invalid or missing API key');
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' })
      };
    }

    // Check environment variables
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

    console.log('Attempting database connection...');
    await connectDB();
    console.log('Database connected successfully');

    // Validate request body
    if (!event.body) {
      console.log('No request body provided');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Request body is required' })
      };
    }

    console.log('Parsing request body...');
    const { username, password } = JSON.parse(event.body);
    console.log('Username:', username, 'Password length:', password ? password.length : 0);

    if (!username || !password) {
      console.log('Missing username or password');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Username and password are required' })
      };
    }

    console.log('Searching for admin user...');
    const admin = await User.findOne({ username, role: 'admin' });
    console.log('Admin found:', !!admin);

    if (!admin) {
      console.log('Admin not found');
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    console.log('Comparing password...');
    const passwordMatch = await admin.comparePassword(password);
    console.log('Password match:', passwordMatch);

    if (!passwordMatch) {
      console.log('Password does not match');
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    console.log('Generating JWT token...');
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log('Token generated successfully');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ token })
    };

  } catch (error) {
    console.error('Login error details:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message // Remove in production
      })
    };
  }
};



module.exports.getAdmin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Check API Key
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-API-Key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
    };
  }

  try {
    await connectDB();

    const admin = await User.findOne({ role: 'admin' }).select('-password');
    if (!admin) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Admin not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(admin),
    };

  } catch (error) {
    console.error('getAdmin error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};





module.exports.deleteAdmin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Check API Key
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-API-Key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
    };
  }

  try {
    await connectDB();

    const deleted = await User.findOneAndDelete({ role: 'admin' });

    if (!deleted) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Admin not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Admin deleted successfully' }),
    };

  } catch (error) {
    console.error('deleteAdmin error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};