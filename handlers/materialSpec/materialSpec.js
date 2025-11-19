const mongoose = require('mongoose');
const MaterialSpec = require('../../models/materialSpecSchema/materialSpecSchema');
const MaterialType = require('../../models/MaterialType/materialType');
const Branch = require('../../models/Branch/Branch');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const { validateDimensions } = require('../../utils/dimensionFormulaValidator');
const { evaluateDimensionFormulas } = require('../../utils/dimensionFormulaEvaluator');

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

// CREATE MATERIAL SPEC
module.exports.createMaterialSpec = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const body = JSON.parse(event.body);
    const { materialTypeId, specName, description, mol, weightPerPiece, density, dimensions, branchId: bodyBranchId } = body;

    // Validate required fields
    if (!materialTypeId || !specName) {
      return respond(400, { message: 'materialTypeId and specName are required' });
    }

    // Validate materialTypeId
    if (!mongoose.Types.ObjectId.isValid(materialTypeId)) {
      return respond(400, { message: 'Invalid materialTypeId' });
    }

    // Check if material type exists
    const materialType = await MaterialType.findById(materialTypeId);
    if (!materialType) {
      return respond(404, { message: 'Material type not found' });
    }

    // Determine branch
    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;
    if (!branchId) {
      return respond(400, { message: 'Branch ID is required' });
    }

    // Check if a specification already exists for this material type
    // UNIQUE CONSTRAINT: Each material type can have only ONE specification per branch
    const exists = await MaterialSpec.findOne({
      materialTypeId,
      branchId
    });

    if (exists) {
      return respond(400, {
        message: `A specification already exists for this material type (${materialType.materialTypeName}). Each material type can have only one specification per branch. Please edit the existing specification instead.`,
        existingSpec: {
          id: exists._id,
          name: exists.specName,
          createdAt: exists.createdAt
        }
      });
    }

    // Validate and evaluate dimension formulas
    let processedDimensions = dimensions || [];
    if (processedDimensions.length > 0) {
      // Validate formulas
      const validation = validateDimensions(processedDimensions);
      if (!validation.valid) {
        return respond(400, {
          message: 'Formula validation failed',
          errors: validation.errors
        });
      }

      // Evaluate formulas to calculate values
      try {
        processedDimensions = evaluateDimensionFormulas(processedDimensions);
      } catch (error) {
        return respond(400, {
          message: 'Formula evaluation failed',
          error: error.message
        });
      }
    }

    // Create material spec
    const materialSpec = new MaterialSpec({
      materialTypeId,
      specName,
      description: description || '',
      mol: mol || 0,
      weightPerPiece: weightPerPiece || 0,
      density: density || 0,
      dimensions: processedDimensions,
      branchId,
      isActive: true
    });

    await materialSpec.save();

    // Populate the response
    await materialSpec.populate('materialTypeId', 'materialTypeName');
    await materialSpec.populate('branchId', 'name location');

    return respond(201, {
      message: 'Material spec created successfully',
      materialSpec
    });

  } catch (error) {
    console.error('Create Material Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET ALL MATERIAL SPECS
module.exports.getMaterialSpecs = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    // Build filter based on user role
    let filter = {};
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    // Check for query parameters
    const queryParams = event.queryStringParameters || {};
    if (queryParams.materialTypeId) {
      filter.materialTypeId = queryParams.materialTypeId;
    }
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true';
    }

    const materialSpecs = await MaterialSpec.find(filter)
      .populate('materialTypeId', 'materialTypeName')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });

    return respond(200, {
      message: 'Material specs fetched successfully',
      count: materialSpecs.length,
      materialSpecs
    });

  } catch (error) {
    console.error('Get Material Specs Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET SINGLE MATERIAL SPEC BY ID
module.exports.getMaterialSpecById = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Material spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid material spec ID' });
    }

    const materialSpec = await MaterialSpec.findById(id)
      .populate('materialTypeId', 'materialTypeName')
      .populate('branchId', 'name location');

    if (!materialSpec) {
      return respond(404, { message: 'Material spec not found' });
    }

    // Check if user has access to this spec
    if (user.role === 'manager' && user.branchId !== String(materialSpec.branchId._id)) {
      return respond(403, { message: 'Unauthorized to access this material spec' });
    }

    return respond(200, {
      message: 'Material spec fetched successfully',
      materialSpec
    });

  } catch (error) {
    console.error('Get Material Spec By ID Error:', error);
    return respond(500, { message: error.message });
  }
};

// UPDATE MATERIAL SPEC
module.exports.updateMaterialSpec = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Material spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid material spec ID' });
    }

    const materialSpec = await MaterialSpec.findById(id);
    if (!materialSpec) {
      return respond(404, { message: 'Material spec not found' });
    }

    // Check if user has access to update this spec
    if (user.role === 'manager' && user.branchId !== String(materialSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to update this material spec' });
    }

    const body = JSON.parse(event.body);

    // Check for duplicate spec name if name is being changed
    if (body.specName && body.specName !== materialSpec.specName) {
      const nameExists = await MaterialSpec.findOne({
        specName: { $regex: `^${body.specName}$`, $options: 'i' },
        branchId: materialSpec.branchId,
        materialTypeId: materialSpec.materialTypeId,
        _id: { $ne: id }
      });

      if (nameExists) {
        return respond(400, {
          message: 'Material spec with this name already exists for this material type'
        });
      }
    }

    // Validate and evaluate dimension formulas if dimensions are being updated
    if (body.dimensions !== undefined) {
      let processedDimensions = body.dimensions;
      if (processedDimensions.length > 0) {
        // Validate formulas
        const validation = validateDimensions(processedDimensions);
        if (!validation.valid) {
          return respond(400, {
            message: 'Formula validation failed',
            errors: validation.errors
          });
        }

        // Evaluate formulas to calculate values
        try {
          processedDimensions = evaluateDimensionFormulas(processedDimensions);
        } catch (error) {
          return respond(400, {
            message: 'Formula evaluation failed',
            error: error.message
          });
        }
      }
      body.dimensions = processedDimensions;
    }

    // Update fields
    if (body.specName !== undefined) materialSpec.specName = body.specName;
    if (body.description !== undefined) materialSpec.description = body.description;
    if (body.mol !== undefined) materialSpec.mol = body.mol;
    if (body.weightPerPiece !== undefined) materialSpec.weightPerPiece = body.weightPerPiece;
    if (body.density !== undefined) materialSpec.density = body.density;
    if (body.dimensions !== undefined) materialSpec.dimensions = body.dimensions;

    await materialSpec.save();

    // Populate the response
    await materialSpec.populate('materialTypeId', 'materialTypeName');
    await materialSpec.populate('branchId', 'name location');

    return respond(200, {
      message: 'Material spec updated successfully',
      materialSpec
    });

  } catch (error) {
    console.error('Update Material Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// DELETE MATERIAL SPEC
module.exports.deleteMaterialSpec = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Material spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid material spec ID' });
    }

    const materialSpec = await MaterialSpec.findById(id);
    if (!materialSpec) {
      return respond(404, { message: 'Material spec not found' });
    }

    // Check if user has access to delete this spec
    if (user.role === 'manager' && user.branchId !== String(materialSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to delete this material spec' });
    }

    await materialSpec.deleteOne();

    return respond(200, { message: 'Material spec deleted successfully' });

  } catch (error) {
    console.error('Delete Material Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// ACTIVATE MATERIAL SPEC
module.exports.activateMaterialSpec = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Material spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid material spec ID' });
    }

    const materialSpec = await MaterialSpec.findById(id);
    if (!materialSpec) {
      return respond(404, { message: 'Material spec not found' });
    }

    // Check if user has access to activate this spec
    if (user.role === 'manager' && user.branchId !== String(materialSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to activate this material spec' });
    }

    // Check if already active
    if (materialSpec.isActive) {
      return respond(400, { message: 'Material spec is already active' });
    }

    materialSpec.isActive = true;
    await materialSpec.save();

    // Populate the response
    await materialSpec.populate('materialTypeId', 'materialTypeName');
    await materialSpec.populate('branchId', 'name location');

    return respond(200, {
      message: 'Material spec activated successfully',
      materialSpec
    });

  } catch (error) {
    console.error('Activate Material Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// DEACTIVATE MATERIAL SPEC
module.exports.deactivateMaterialSpec = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { id } = event.pathParameters || {};
    if (!id) {
      return respond(400, { message: 'Material spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid material spec ID' });
    }

    const materialSpec = await MaterialSpec.findById(id);
    if (!materialSpec) {
      return respond(404, { message: 'Material spec not found' });
    }

    // Check if user has access to deactivate this spec
    if (user.role === 'manager' && user.branchId !== String(materialSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to deactivate this material spec' });
    }

    // Check if already inactive
    if (!materialSpec.isActive) {
      return respond(400, { message: 'Material spec is already inactive' });
    }

    materialSpec.isActive = false;
    await materialSpec.save();

    // Populate the response
    await materialSpec.populate('materialTypeId', 'materialTypeName');
    await materialSpec.populate('branchId', 'name location');

    return respond(200, {
      message: 'Material spec deactivated successfully',
      materialSpec
    });

  } catch (error) {
    console.error('Deactivate Material Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET MATERIAL SPECS BY MATERIAL TYPE
module.exports.getMaterialSpecsByMaterialType = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const { materialTypeId } = event.pathParameters || {};
    if (!materialTypeId) {
      return respond(400, { message: 'Material type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(materialTypeId)) {
      return respond(400, { message: 'Invalid material type ID' });
    }

    // Build filter
    let filter = { materialTypeId };
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    // Check for active filter
    const queryParams = event.queryStringParameters || {};
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true';
    }

    const materialSpecs = await MaterialSpec.find(filter)
      .populate('materialTypeId', 'materialTypeName')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });

    return respond(200, {
      message: 'Material specs fetched successfully',
      count: materialSpecs.length,
      materialSpecs
    });

  } catch (error) {
    console.error('Get Material Specs By Material Type Error:', error);
    return respond(500, { message: error.message });
  }
};
