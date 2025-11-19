const Branch = require('../../models/Branch/Branch');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');
const mongoose = require('mongoose');
const Admin = require('../../models/Admin/Admin');
const { Product27Infinity } = require('../../models/Product27InfinitySchema/Product27InfinitySchema');

if (mongoose.models.Branch) {
  delete mongoose.models.Branch;
}
const BranchModel = require('../../models/Branch/Branch');

// ✅ Helper function - returns null if admin has no product (for backward compatibility)
async function getAdminWithProduct(tokenData) {
  const admin = await Admin.findById(tokenData.id || tokenData.userId)
    .populate('product27InfinityId');

  if (!admin) {
    throw new Error('Admin not found');
  }

  // ✅ If admin has no product, return null values (old admins)
  if (!admin.product27InfinityId) {
    console.log('⚠️ Admin has no product assigned (legacy admin)');
    return { 
      admin, 
      product27InfinityStringId: null,
      product27InfinityObjectId: null,
      product27Infinity: null,
      hasProduct: false
    };
  }

  // ✅ Check if populate worked
  const isPopulated = typeof admin.product27InfinityId === 'object' && 
                      admin.product27InfinityId.Product27InfinityId;

  if (!isPopulated) {
    throw new Error('Product27Infinity not properly populated');
  }

  const product27Infinity = admin.product27InfinityId;
  const product27InfinityStringId = product27Infinity.Product27InfinityId;
  const product27InfinityObjectId = product27Infinity._id;

  console.log('✅ Admin has product:', {
    stringId: product27InfinityStringId,
    objectId: product27InfinityObjectId,
    productName: product27Infinity.name
  });
  
  return { 
    admin, 
    product27InfinityStringId,
    product27InfinityObjectId,
    product27Infinity,
    hasProduct: true
  };
}



module.exports.getAllBranches = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
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

    // ✅ Get admin details
    const { 
      admin, 
      product27InfinityStringId, 
      product27InfinityObjectId, 
      product27Infinity,
      hasProduct
    } = await getAdminWithProduct(user);

    let branches;
    let filter = { isActive: true };

    if (hasProduct) {
      // ✅ New behavior: Filter by product
      console.log('✅ Fetching branches for product ObjectId:', product27InfinityObjectId);
      filter.product27InfinityId = product27InfinityObjectId;
    } else {
      // ✅ Old behavior: Get branches without product27InfinityId
      console.log('✅ Fetching legacy branches (no product filter)');
      filter.product27InfinityId = { $exists: false };
    }

    branches = await BranchModel.find(filter)
      .populate('product27InfinityId')
      .sort({ name: 1 })
      .lean();

    console.log(`✅ Found ${branches.length} branches`);

    // ✅ Format response to match OLD CODE format (return array directly)
    const formattedBranches = branches.map(branch => {
      const formatted = {
        _id: branch._id,  // ✅ Changed from 'id' to '_id' to match old format
        name: branch.name,
        code: branch.code,
        location: branch.location,
        phone: branch.phone,
        email: branch.email,
        isActive: branch.isActive,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt
      };

      // Only include product27InfinityId if it exists
      if (branch.product27InfinityId) {
        formatted.product27InfinityId = branch.product27InfinityId?.Product27InfinityId || product27InfinityStringId;
      }

      return formatted;
    });

    // ✅ Return array directly (same as old code)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(formattedBranches),  // ✅ Return array, not wrapper object
    };

  } catch (err) {
    console.error('❌ Get branches error:', err);
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

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

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
    const tokenData = verifyToken(auth);

    if (!tokenData || tokenData.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Access denied: Admin role required' }),
      };
    }

    // ✅ Get admin details
    const { admin, product27InfinityObjectId, product27InfinityStringId, hasProduct } = await getAdminWithProduct(tokenData);

    const body = JSON.parse(event.body);
    const branchId = body.branchId;

    if (!branchId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch ID is required' }),
      };
    }

    // ✅ Find branch
    const branch = await Branch.findById(branchId).populate('product27InfinityId');

    if (!branch) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch not found' }),
      };
    }

    // ✅ Verify access based on whether admin has product
    if (hasProduct) {
      // New behavior: Check product match
      if (!branch.product27InfinityId || 
          branch.product27InfinityId._id.toString() !== product27InfinityObjectId.toString()) {
        console.log('❌ Access denied: Product mismatch');
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Access denied: You do not have access to this branch' 
          }),
        };
      }
    } else {
      // Old behavior: Only access branches without product27InfinityId
      if (branch.product27InfinityId) {
        console.log('❌ Access denied: Legacy admin trying to access product branch');
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Access denied: You do not have access to this branch' 
          }),
        };
      }
    }

    if (!branch.isActive) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch is inactive' }),
      };
    }

    console.log('✅ Branch selected:', branch._id);

    const response = {
      branchId: branch._id,
      name: branch.name,
      code: branch.code,
      location: branch.location,
      phone: branch.phone,
      email: branch.email,
      isActive: branch.isActive
    };

    // Only include product27InfinityId if it exists
    if (branch.product27InfinityId) {
      response.product27InfinityId = branch.product27InfinityId?.Product27InfinityId || product27InfinityStringId;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response),
    };

  } catch (err) {
    console.error('❌ Select branch error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};



