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

module.exports.createBranch = async (event, context) => {
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

    // ✅ Get admin details (product may be null for old admins)
    const { admin, product27InfinityObjectId, product27InfinityStringId, hasProduct } = await getAdminWithProduct(user);

    const body = JSON.parse(event.body);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!name) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch name is required and must be a string.' }),
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch code is required.' }),
      };
    }

    if (!location) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Location is required.' }),
      };
    }

    // ✅ Check duplicates based on whether admin has product
    if (hasProduct) {
      // New behavior: Check within product scope
      const existingName = await Branch.findOne({ 
        name: name.toLowerCase(),
        product27InfinityId: product27InfinityObjectId
      });
      
      if (existingName) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Branch name already exists for this product' }),
        };
      }

      const existingCode = await Branch.findOne({ 
        code: code.toUpperCase(),
        product27InfinityId: product27InfinityObjectId
      });
      
      if (existingCode) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Branch code already exists for this product' }),
        };
      }
    } else {
      // Old behavior: Check globally (for backward compatibility)
      const existingName = await Branch.findOne({ 
        name: name.toLowerCase(),
        product27InfinityId: { $exists: false }
      });
      
      if (existingName) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Branch name already exists' }),
        };
      }

      const existingCode = await Branch.findOne({ 
        code: code.toUpperCase(),
        product27InfinityId: { $exists: false }
      });
      
      if (existingCode) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Branch code already exists' }),
        };
      }
    }

    // ✅ Create branch - only add product27InfinityId if admin has one
    const branchData = {
      name: name.toLowerCase(),
      location,
      code: code.toUpperCase(),
      phone,
      email,
      userId: admin._id.toString(),
      isActive: true
    };

    // ✅ Only add product27InfinityId for new admins
    if (hasProduct) {
      branchData.product27InfinityId = product27InfinityObjectId;
    }

    const branch = new Branch(branchData);

    console.log('✅ Creating branch:', {
      name: branch.name,
      code: branch.code,
      hasProduct,
      product27InfinityId: hasProduct ? product27InfinityObjectId : 'none (legacy)',
      adminId: admin._id
    });

    await branch.save();

    // ✅ Format response
    const response = {
      id: branch._id,
      name: branch.name,
      code: branch.code,
      location: branch.location,
      phone: branch.phone,
      email: branch.email,
      isActive: branch.isActive,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt
    };

    // Only include product27InfinityId in response if it exists
    if (hasProduct) {
      response.product27InfinityId = product27InfinityStringId;
    }

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Branch created successfully',
        branch: response
      }),
    };
  } catch (err) {
    console.error('❌ Branch creation error:', err);
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

module.exports.updateBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Content-Type': 'application/json',
  };

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

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    const user = verifyToken(authorization);
    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin can update branches' }),
      };
    }

    // ✅ Get admin details
    const { admin, product27InfinityObjectId, product27InfinityStringId, hasProduct } = await getAdminWithProduct(user);

    const branchId = event.pathParameters?.id;
    const body = JSON.parse(event.body);
    const { name, location, code, phone, email } = body;

    // ✅ Find existing branch
    const existingBranch = await Branch.findById(branchId).populate('product27InfinityId');

    if (!existingBranch) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch not found' }),
      };
    }

    // ✅ Verify access
    if (hasProduct) {
      if (!existingBranch.product27InfinityId || 
          existingBranch.product27InfinityId._id.toString() !== product27InfinityObjectId.toString()) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Access denied: You do not have access to this branch' 
          }),
        };
      }
    } else {
      if (existingBranch.product27InfinityId) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Access denied: You do not have access to this branch' 
          }),
        };
      }
    }

    // ✅ Check duplicates based on product scope
    if (name && name !== existingBranch.name) {
      const duplicateQuery = {
        name: name.toLowerCase(),
        _id: { $ne: branchId }
      };

      if (hasProduct) {
        duplicateQuery.product27InfinityId = product27InfinityObjectId;
      } else {
        duplicateQuery.product27InfinityId = { $exists: false };
      }

      const duplicateName = await Branch.findOne(duplicateQuery);

      if (duplicateName) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Branch name already exists' }),
        };
      }
    }

    if (code && code !== existingBranch.code) {
      const duplicateQuery = {
        code: code.toUpperCase(),
        _id: { $ne: branchId }
      };

      if (hasProduct) {
        duplicateQuery.product27InfinityId = product27InfinityObjectId;
      } else {
        duplicateQuery.product27InfinityId = { $exists: false };
      }

      const duplicateCode = await Branch.findOne(duplicateQuery);

      if (duplicateCode) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Branch code already exists' }),
        };
      }
    }

    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name.toLowerCase();
    if (location) updateData.location = location;
    if (code) updateData.code = code.toUpperCase();
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;

    const updatedBranch = await Branch.findByIdAndUpdate(
      branchId,
      updateData,
      { new: true }
    ).populate('product27InfinityId');

    console.log('✅ Branch updated:', updatedBranch._id);

    const response = {
      id: updatedBranch._id,
      name: updatedBranch.name,
      code: updatedBranch.code,
      location: updatedBranch.location,
      phone: updatedBranch.phone,
      email: updatedBranch.email,
      isActive: updatedBranch.isActive,
      createdAt: updatedBranch.createdAt,
      updatedAt: updatedBranch.updatedAt
    };

    if (updatedBranch.product27InfinityId) {
      response.product27InfinityId = updatedBranch.product27InfinityId?.Product27InfinityId || product27InfinityStringId;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Branch updated successfully',
        branch: response
      }),
    };
  } catch (err) {
    console.error('❌ Update branch error:', err);
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

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' }),
      };
    }

    const user = verifyToken(authorization);
    if (!user || user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin can delete branches' }),
      };
    }

    // ✅ Get admin details
    const { admin, product27InfinityObjectId, hasProduct } = await getAdminWithProduct(user);

    const branchId = event.pathParameters?.id;

    // ✅ Find branch
    const branch = await Branch.findById(branchId).populate('product27InfinityId');

    if (!branch) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Branch not found' }),
      };
    }

    // ✅ Verify access
    if (hasProduct) {
      if (!branch.product27InfinityId || 
          branch.product27InfinityId._id.toString() !== product27InfinityObjectId.toString()) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Access denied: You do not have access to this branch' 
          }),
        };
      }
    } else {
      if (branch.product27InfinityId) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Access denied: You do not have access to this branch' 
          }),
        };
      }
    }

    await Branch.findByIdAndDelete(branchId);

    console.log('✅ Branch deleted:', branchId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Branch deleted successfully',
        branchId 
      }),
    };
  } catch (err) {
    console.error('❌ Delete branch error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};