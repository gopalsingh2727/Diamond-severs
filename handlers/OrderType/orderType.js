const mongoose = require('mongoose');
const OrderType = require('../../models/OrderType/orderType');
const Branch = require('../../models/Branch/Branch');
// Import Step model to register schema for population
require('../../models/steps/step');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

// ============================================================================
// CREATE ORDER TYPE
// ============================================================================
module.exports.createOrderType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    // Only admins, managers, and master admins can create order types
    if (!user || (user.role !== 'admin' && user.role !== 'masterAdmin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const body = JSON.parse(event.body);
    const {
      typeName,
      typeCode,
      description,
      numberPrefix,
      numberFormat,
      sequencePadding,
      defaultSteps,
      customFields,
      validationRules,
      slaConfig,
      costingParams,
      requiresApproval,
      approvalLevels,
      autoApproveBelow,
      branchId: bodyBranchId,
      isGlobal,
      isDefault,
      sections,
      restrictions,
      machineWorkflow
    } = body;

    // Validate required fields
    if (!typeName || !typeCode || !numberPrefix) {
      return respond(400, {
        message: 'typeName, typeCode, and numberPrefix are required'
      });
    }

    // Check for duplicate type code
    const existingType = await OrderType.findOne({
      typeCode: typeCode.toUpperCase()
    });

    if (existingType) {
      return respond(400, {
        message: 'Order type with this type code already exists'
      });
    }

    // Determine branch
    let branchId = bodyBranchId;
    if (user.role === 'admin' && !branchId) {
      return respond(400, { message: 'Branch ID is required for admin users' });
    }
    // For managers, use their branchId if not provided
    if (user.role === 'manager' && !branchId) {
      branchId = user.branchId;
    }

    // Validate branch if provided
    if (branchId) {
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        return respond(400, { message: 'Invalid branch ID' });
      }

      const branch = await Branch.findById(branchId);
      if (!branch) {
        return respond(404, { message: 'Branch not found' });
      }
    }

    // Create order type
    const orderType = new OrderType({
      typeName,
      typeCode: typeCode.toUpperCase(),
      description: description || '',
      numberPrefix: numberPrefix.toUpperCase(),
      numberFormat: numberFormat || '{PREFIX}-{SEQUENCE}',
      sequenceCounter: 0,
      sequencePadding: sequencePadding || 4,
      defaultSteps: defaultSteps || [],
      customFields: customFields || [],
      validationRules: validationRules || undefined,
      slaConfig: slaConfig || undefined,
      costingParams: costingParams || undefined,
      requiresApproval: requiresApproval || false,
      approvalLevels: approvalLevels || 1,
      autoApproveBelow: autoApproveBelow || undefined,
      branchId: branchId || undefined,
      isGlobal: isGlobal || false,
      isActive: true,
      isDefault: isDefault || false,
      sections: sections || [],
      restrictions: restrictions || {},
      machineWorkflow: machineWorkflow || { stepCreationMode: 'manual' },
      version: 1,
      isLatestVersion: true,
      createdBy: user.id || user.userId
    });

    await orderType.save();

    // Populate the response
    if (orderType.branchId) {
      await orderType.populate('branchId', 'name location code');
    }

    return respond(201, {
      message: 'Order type created successfully',
      orderType
    });

  } catch (error) {
    console.error('Create Order Type Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// GET ALL ORDER TYPES
// ============================================================================
module.exports.getOrderTypes = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user) {
      return respond(403, { message: 'Unauthorized' });
    }

    // Build filter based on user role
    let filter = {};
    const queryParams = event.queryStringParameters || {};

    if (user.role === 'admin') {
      // Admin sees their branch types + global types
      const branchId = user.branchId || queryParams.branchId;
      if (branchId) {
        filter.$or = [
          { branchId },
          { isGlobal: true }
        ];
      } else {
        filter.isGlobal = true;
      }
    } else if (user.role === 'manager') {
      // Manager sees their branch types + global types
      if (user.branchId) {
        filter.$or = [
          { branchId: user.branchId },
          { isGlobal: true }
        ];
      } else {
        filter.isGlobal = true;
      }
    } else if (user.role === 'masterAdmin') {
      // Master admin sees all types
      if (queryParams.branchId) {
        filter.branchId = queryParams.branchId;
      }
      if (queryParams.isGlobal !== undefined) {
        filter.isGlobal = queryParams.isGlobal === 'true';
      }
    }

    // Filter by active status
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true';
    }

    const orderTypes = await OrderType.find(filter)
      .populate('branchId', 'name location code')
      .populate('defaultSteps', 'stepName description')
      .sort({ typeName: 1 });

    return respond(200, {
      message: 'Order types fetched successfully',
      count: orderTypes.length,
      orderTypes
    });

  } catch (error) {
    console.error('Get Order Types Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// GET SINGLE ORDER TYPE BY ID
// ============================================================================
module.exports.getOrderTypeById = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Order type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid order type ID' });
    }

    const orderType = await OrderType.findById(id)
      .populate('branchId', 'name location code')
      .populate('defaultSteps', 'stepName description');

    if (!orderType) {
      return respond(404, { message: 'Order type not found' });
    }

    // Check if user has access to this order type
    if (user.role === 'admin' || user.role === 'manager') {
      // Must be global or belong to user's branch
      if (!orderType.isGlobal) {
        if (!orderType.branchId || user.branchId !== String(orderType.branchId._id)) {
          return respond(403, { message: 'Unauthorized to access this order type' });
        }
      }
    }

    return respond(200, {
      message: 'Order type fetched successfully',
      orderType
    });

  } catch (error) {
    console.error('Get Order Type By ID Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// UPDATE ORDER TYPE
// ============================================================================
module.exports.updateOrderType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    // Only admins, managers, and master admins can update order types
    if (!user || (user.role !== 'admin' && user.role !== 'masterAdmin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Order type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid order type ID' });
    }

    const orderType = await OrderType.findById(id);
    if (!orderType) {
      return respond(404, { message: 'Order type not found' });
    }

    // Check if user has access to update this order type
    if ((user.role === 'admin' || user.role === 'manager') && !orderType.isGlobal) {
      if (!orderType.branchId || user.branchId !== String(orderType.branchId)) {
        return respond(403, { message: 'Unauthorized to update this order type' });
      }
    }

    const body = JSON.parse(event.body);

    // Check for duplicate type code if it's being changed
    if (body.typeCode && body.typeCode.toUpperCase() !== orderType.typeCode) {
      const codeExists = await OrderType.findOne({
        typeCode: body.typeCode.toUpperCase(),
        _id: { $ne: id }
      });

      if (codeExists) {
        return respond(400, {
          message: 'Order type with this type code already exists'
        });
      }
    }

    // Update fields
    if (body.typeName !== undefined) orderType.typeName = body.typeName;
    if (body.typeCode !== undefined) orderType.typeCode = body.typeCode.toUpperCase();
    if (body.description !== undefined) orderType.description = body.description;
    if (body.numberPrefix !== undefined) orderType.numberPrefix = body.numberPrefix.toUpperCase();
    if (body.numberFormat !== undefined) orderType.numberFormat = body.numberFormat;
    if (body.sequencePadding !== undefined) orderType.sequencePadding = body.sequencePadding;

    if (body.defaultSteps !== undefined) orderType.defaultSteps = body.defaultSteps;

    if (body.customFields !== undefined) orderType.customFields = body.customFields;
    if (body.validationRules !== undefined) orderType.validationRules = body.validationRules;
    if (body.slaConfig !== undefined) orderType.slaConfig = body.slaConfig;
    if (body.costingParams !== undefined) orderType.costingParams = body.costingParams;

    if (body.requiresApproval !== undefined) orderType.requiresApproval = body.requiresApproval;
    if (body.approvalLevels !== undefined) orderType.approvalLevels = body.approvalLevels;
    if (body.autoApproveBelow !== undefined) orderType.autoApproveBelow = body.autoApproveBelow;

    if (body.isGlobal !== undefined) orderType.isGlobal = body.isGlobal;
    if (body.isDefault !== undefined) orderType.isDefault = body.isDefault;

    // Form sections configuration
    if (body.sections !== undefined) orderType.sections = body.sections;

    // Restrictions
    if (body.restrictions !== undefined) orderType.restrictions = body.restrictions;

    // Machine workflow
    if (body.machineWorkflow !== undefined) orderType.machineWorkflow = body.machineWorkflow;

    orderType.updatedBy = user.id || user.userId;

    await orderType.save();

    // Populate the response
    if (orderType.branchId) {
      await orderType.populate('branchId', 'name location code');
    }
    await orderType.populate('defaultSteps', 'stepName description');

    return respond(200, {
      message: 'Order type updated successfully',
      orderType
    });

  } catch (error) {
    console.error('Update Order Type Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// DELETE ORDER TYPE
// ============================================================================
module.exports.deleteOrderType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    // Only admins, managers, and master admins can delete order types
    if (!user || (user.role !== 'admin' && user.role !== 'masterAdmin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Order type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid order type ID' });
    }

    const orderType = await OrderType.findById(id);
    if (!orderType) {
      return respond(404, { message: 'Order type not found' });
    }

    // Check if user has access to delete this order type
    if ((user.role === 'admin' || user.role === 'manager') && !orderType.isGlobal) {
      if (!orderType.branchId || user.branchId !== String(orderType.branchId)) {
        return respond(403, { message: 'Unauthorized to delete this order type' });
      }
    }

    // Check if this order type is being used by any orders
    // TODO: Add this check once Order schema is updated
    // const orderCount = await Order.countDocuments({ orderTypeId: id });
    // if (orderCount > 0) {
    //   return respond(400, {
    //     message: `Cannot delete order type. It is being used by ${orderCount} order(s)`
    //   });
    // }

    await orderType.deleteOne();

    return respond(200, { message: 'Order type deleted successfully' });

  } catch (error) {
    console.error('Delete Order Type Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// ACTIVATE ORDER TYPE
// ============================================================================
module.exports.activateOrderType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'masterAdmin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Order type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid order type ID' });
    }

    const orderType = await OrderType.findById(id);
    if (!orderType) {
      return respond(404, { message: 'Order type not found' });
    }

    // Check if user has access
    if ((user.role === 'admin' || user.role === 'manager') && !orderType.isGlobal) {
      if (!orderType.branchId || user.branchId !== String(orderType.branchId)) {
        return respond(403, { message: 'Unauthorized to activate this order type' });
      }
    }

    if (orderType.isActive) {
      return respond(400, { message: 'Order type is already active' });
    }

    orderType.isActive = true;
    orderType.updatedBy = user.id || user.userId;
    await orderType.save();

    // Populate the response
    if (orderType.branchId) {
      await orderType.populate('branchId', 'name location code');
    }
    await orderType.populate('defaultSteps', 'stepName description');

    return respond(200, {
      message: 'Order type activated successfully',
      orderType
    });

  } catch (error) {
    console.error('Activate Order Type Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// DEACTIVATE ORDER TYPE
// ============================================================================
module.exports.deactivateOrderType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'masterAdmin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Order type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid order type ID' });
    }

    const orderType = await OrderType.findById(id);
    if (!orderType) {
      return respond(404, { message: 'Order type not found' });
    }

    // Check if user has access
    if ((user.role === 'admin' || user.role === 'manager') && !orderType.isGlobal) {
      if (!orderType.branchId || user.branchId !== String(orderType.branchId)) {
        return respond(403, { message: 'Unauthorized to deactivate this order type' });
      }
    }

    if (!orderType.isActive) {
      return respond(400, { message: 'Order type is already inactive' });
    }

    // Cannot deactivate if it's the default
    if (orderType.isDefault) {
      return respond(400, {
        message: 'Cannot deactivate the default order type. Set another type as default first.'
      });
    }

    orderType.isActive = false;
    orderType.updatedBy = user.id || user.userId;
    await orderType.save();

    // Populate the response
    if (orderType.branchId) {
      await orderType.populate('branchId', 'name location code');
    }
    await orderType.populate('defaultSteps', 'stepName description');

    return respond(200, {
      message: 'Order type deactivated successfully',
      orderType
    });

  } catch (error) {
    console.error('Deactivate Order Type Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// SET DEFAULT ORDER TYPE
// ============================================================================
module.exports.setDefaultOrderType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'masterAdmin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Order type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid order type ID' });
    }

    const orderType = await OrderType.findById(id);
    if (!orderType) {
      return respond(404, { message: 'Order type not found' });
    }

    // Check if user has access
    if ((user.role === 'admin' || user.role === 'manager') && !orderType.isGlobal) {
      if (!orderType.branchId || user.branchId !== String(orderType.branchId)) {
        return respond(403, { message: 'Unauthorized to set default for this order type' });
      }
    }

    // Must be active to set as default
    if (!orderType.isActive) {
      return respond(400, { message: 'Cannot set an inactive order type as default' });
    }

    if (orderType.isDefault) {
      return respond(400, { message: 'This order type is already the default' });
    }

    // The pre-save hook will handle removing default from other types
    orderType.isDefault = true;
    orderType.updatedBy = user.id || user.userId;
    await orderType.save();

    // Populate the response
    if (orderType.branchId) {
      await orderType.populate('branchId', 'name location code');
    }
    await orderType.populate('defaultSteps', 'stepName description');

    return respond(200, {
      message: 'Order type set as default successfully',
      orderType
    });

  } catch (error) {
    console.error('Set Default Order Type Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// GET ORDER TYPES BY BRANCH
// ============================================================================
module.exports.getOrderTypesByBranch = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { branchId } = event.pathParameters || {};
    if (!branchId) {
      return respond(400, { message: 'Branch ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return respond(400, { message: 'Invalid branch ID' });
    }

    // Build filter
    const filter = {
      $or: [
        { branchId },
        { isGlobal: true }
      ],
      isActive: true
    };

    const orderTypes = await OrderType.find(filter)
      .populate('branchId', 'name location code')
      .populate('defaultSteps', 'stepName description')
      .sort({ isDefault: -1, typeName: 1 }); // Default types first

    return respond(200, {
      message: 'Order types fetched successfully',
      count: orderTypes.length,
      orderTypes
    });

  } catch (error) {
    console.error('Get Order Types By Branch Error:', error);
    return respond(500, { message: error.message });
  }
};

// ============================================================================
// GET DEFAULT ORDER TYPE
// ============================================================================
module.exports.getDefaultOrderType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user) {
      return respond(403, { message: 'Unauthorized' });
    }

    const queryParams = event.queryStringParameters || {};
    const branchId = queryParams.branchId || user.branchId;

    let orderType;

    if (branchId) {
      // Try to find branch-specific default first
      orderType = await OrderType.findOne({
        branchId,
        isDefault: true,
        isActive: true
      })
        .populate('branchId', 'name location code')
        .populate('defaultSteps', 'stepName description');

      // If no branch-specific default, try global default
      if (!orderType) {
        orderType = await OrderType.findOne({
          isGlobal: true,
          isDefault: true,
          isActive: true
        })
          .populate('defaultSteps', 'stepName description');
      }
    } else {
      // No branch specified, get global default
      orderType = await OrderType.findOne({
        isGlobal: true,
        isDefault: true,
        isActive: true
      })
        .populate('defaultSteps', 'stepName description');
    }

    if (!orderType) {
      return respond(404, { message: 'No default order type found' });
    }

    return respond(200, {
      message: 'Default order type fetched successfully',
      orderType
    });

  } catch (error) {
    console.error('Get Default Order Type Error:', error);
    return respond(500, { message: error.message });
  }
};
