require('dotenv').config();
const jwt = require('jsonwebtoken');
const connectDB = require('../../config/mongodb/db');
const Admin = require('../../models/Admin/Admin');

// ✅ FIX: Use the correct model path - check your project structure
// Option 1: If you have a schemas file with Product27Infinity
// const { Product27Infinity } = require('../../models/schemas');

// Option 2: If Product27Infinity is in a separate file, find the correct path
// const Product27Infinity = require('../../models/Product27Infinity');

// For now, I'll use Option 1 based on your other handlers
const { Product27Infinity } = require('../../models/Product27InfinitySchema/Product27InfinitySchema');

module.exports.loginAdmin = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const headers = event.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' })
      };
    }

    await connectDB();

    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Request body is required' })
      };
    }

    const { username, password } = JSON.parse(event.body);
    if (!username || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Username and password are required' })
      };
    }

    // ✅ FIX: Changed from User to Admin
    const admin = await Admin.findOne({ username })
      .populate('product27InfinityId');

    if (!admin) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    const passwordMatch = await admin.comparePassword(password);
    if (!passwordMatch) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    // ✅ Check product only for role = 'admin'
    if (admin.role === 'admin') {
      const product = admin.product27InfinityId;
      if (!product || !product.isActive || product.status !== 'active') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Product is inactive or not accessible'
          })
        };
      }
    }

    // ✅ Allow master_admin login without product check

    const token = jwt.sign(
      { 
        id: admin._id, 
        userId: admin._id.toString(), // ✅ Add userId for consistency with other handlers
        role: admin.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        token,
        admin: {
          id: admin._id,
          username: admin.username,
          role: admin.role,
          product: admin.product27InfinityId ? {
            id: admin.product27InfinityId._id,
            Product27InfinityId: admin.product27InfinityId.Product27InfinityId,
            name: admin.product27InfinityId.name
          } : null
        }
      })
    };

  } catch (error) {
    console.error('❌ Admin login error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};