const mongoose = require('mongoose');
const ProductSpec = require('../../models/productSpecSchema/productSpecSchema');
const ProductType = require('../../models/ProductCatalogue/productType');
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

// CREATE PRODUCT SPEC
module.exports.createProductSpec = async (event) => {
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
    const { productTypeId, specName, description, dimensions, branchId: bodyBranchId } = body;

    // Validate required fields
    if (!productTypeId || !specName) {
      return respond(400, { message: 'productTypeId and specName are required' });
    }

    // Validate productTypeId
    if (!mongoose.Types.ObjectId.isValid(productTypeId)) {
      return respond(400, { message: 'Invalid productTypeId' });
    }

    // Check if product type exists
    const productType = await ProductType.findById(productTypeId);
    if (!productType) {
      return respond(404, { message: 'Product type not found' });
    }

    // Determine branch
    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;
    if (!branchId) {
      return respond(400, { message: 'Branch ID is required' });
    }

    // Check if a specification already exists for this product type
    // UNIQUE CONSTRAINT: Each product type can have only ONE specification per branch
    const exists = await ProductSpec.findOne({
      productTypeId,
      branchId
    });

    if (exists) {
      return respond(400, {
        message: `A specification already exists for this product type (${productType.productTypeName}). Each product type can have only one specification per branch. Please edit the existing specification instead.`,
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

    // Create product spec
    const productSpec = new ProductSpec({
      productTypeId,
      specName,
      description: description || '',
      dimensions: processedDimensions,
      branchId,
      isActive: true
    });

    await productSpec.save();

    // Populate the response
    await productSpec.populate('productTypeId', 'productTypeName');
    await productSpec.populate('branchId', 'name location');

    return respond(201, {
      message: 'Product spec created successfully',
      productSpec
    });

  } catch (error) {
    console.error('Create Product Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET ALL PRODUCT SPECS
module.exports.getProductSpecs = async (event) => {
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
    if (queryParams.productTypeId) {
      filter.productTypeId = queryParams.productTypeId;
    }
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true';
    }

    const productSpecs = await ProductSpec.find(filter)
      .populate('productTypeId', 'productTypeName')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });

    return respond(200, {
      message: 'Product specs fetched successfully',
      count: productSpecs.length,
      productSpecs
    });

  } catch (error) {
    console.error('Get Product Specs Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET SINGLE PRODUCT SPEC BY ID
module.exports.getProductSpecById = async (event) => {
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
      return respond(400, { message: 'Product spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid product spec ID' });
    }

    const productSpec = await ProductSpec.findById(id)
      .populate('productTypeId', 'productTypeName')
      .populate('branchId', 'name location');

    if (!productSpec) {
      return respond(404, { message: 'Product spec not found' });
    }

    // Check if user has access to this spec
    if (user.role === 'manager' && user.branchId !== String(productSpec.branchId._id)) {
      return respond(403, { message: 'Unauthorized to access this product spec' });
    }

    return respond(200, {
      message: 'Product spec fetched successfully',
      productSpec
    });

  } catch (error) {
    console.error('Get Product Spec By ID Error:', error);
    return respond(500, { message: error.message });
  }
};

// UPDATE PRODUCT SPEC
module.exports.updateProductSpec = async (event) => {
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
      return respond(400, { message: 'Product spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid product spec ID' });
    }

    const productSpec = await ProductSpec.findById(id);
    if (!productSpec) {
      return respond(404, { message: 'Product spec not found' });
    }

    // Check if user has access to update this spec
    if (user.role === 'manager' && user.branchId !== String(productSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to update this product spec' });
    }

    const body = JSON.parse(event.body);

    // Check for duplicate spec name if name is being changed
    if (body.specName && body.specName !== productSpec.specName) {
      const nameExists = await ProductSpec.findOne({
        specName: { $regex: `^${body.specName}$`, $options: 'i' },
        branchId: productSpec.branchId,
        productTypeId: productSpec.productTypeId,
        _id: { $ne: id }
      });

      if (nameExists) {
        return respond(400, {
          message: 'Product spec with this name already exists for this product type'
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
    if (body.specName !== undefined) productSpec.specName = body.specName;
    if (body.description !== undefined) productSpec.description = body.description;
    if (body.dimensions !== undefined) productSpec.dimensions = body.dimensions;

    await productSpec.save();

    // Populate the response
    await productSpec.populate('productTypeId', 'productTypeName');
    await productSpec.populate('branchId', 'name location');

    return respond(200, {
      message: 'Product spec updated successfully',
      productSpec
    });

  } catch (error) {
    console.error('Update Product Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// DELETE PRODUCT SPEC
module.exports.deleteProductSpec = async (event) => {
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
      return respond(400, { message: 'Product spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid product spec ID' });
    }

    const productSpec = await ProductSpec.findById(id);
    if (!productSpec) {
      return respond(404, { message: 'Product spec not found' });
    }

    // Check if user has access to delete this spec
    if (user.role === 'manager' && user.branchId !== String(productSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to delete this product spec' });
    }

    await productSpec.deleteOne();

    return respond(200, { message: 'Product spec deleted successfully' });

  } catch (error) {
    console.error('Delete Product Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// ACTIVATE PRODUCT SPEC
module.exports.activateProductSpec = async (event) => {
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
      return respond(400, { message: 'Product spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid product spec ID' });
    }

    const productSpec = await ProductSpec.findById(id);
    if (!productSpec) {
      return respond(404, { message: 'Product spec not found' });
    }

    // Check if user has access to activate this spec
    if (user.role === 'manager' && user.branchId !== String(productSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to activate this product spec' });
    }

    // Check if already active
    if (productSpec.isActive) {
      return respond(400, { message: 'Product spec is already active' });
    }

    productSpec.isActive = true;
    await productSpec.save();

    // Populate the response
    await productSpec.populate('productTypeId', 'productTypeName');
    await productSpec.populate('branchId', 'name location');

    return respond(200, {
      message: 'Product spec activated successfully',
      productSpec
    });

  } catch (error) {
    console.error('Activate Product Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// DEACTIVATE PRODUCT SPEC
module.exports.deactivateProductSpec = async (event) => {
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
      return respond(400, { message: 'Product spec ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid product spec ID' });
    }

    const productSpec = await ProductSpec.findById(id);
    if (!productSpec) {
      return respond(404, { message: 'Product spec not found' });
    }

    // Check if user has access to deactivate this spec
    if (user.role === 'manager' && user.branchId !== String(productSpec.branchId)) {
      return respond(403, { message: 'Unauthorized to deactivate this product spec' });
    }

    // Check if already inactive
    if (!productSpec.isActive) {
      return respond(400, { message: 'Product spec is already inactive' });
    }

    productSpec.isActive = false;
    await productSpec.save();

    // Populate the response
    await productSpec.populate('productTypeId', 'productTypeName');
    await productSpec.populate('branchId', 'name location');

    return respond(200, {
      message: 'Product spec deactivated successfully',
      productSpec
    });

  } catch (error) {
    console.error('Deactivate Product Spec Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET PRODUCT SPECS BY PRODUCT TYPE
module.exports.getProductSpecsByProductType = async (event) => {
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

    const { productTypeId } = event.pathParameters || {};
    if (!productTypeId) {
      return respond(400, { message: 'Product type ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(productTypeId)) {
      return respond(400, { message: 'Invalid product type ID' });
    }

    // Build filter
    let filter = { productTypeId };
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    // Check for active filter
    const queryParams = event.queryStringParameters || {};
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true';
    }

    const productSpecs = await ProductSpec.find(filter)
      .populate('productTypeId', 'productTypeName')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });

    return respond(200, {
      message: 'Product specs fetched successfully',
      count: productSpecs.length,
      productSpecs
    });

  } catch (error) {
    console.error('Get Product Specs By Product Type Error:', error);
    return respond(500, { message: error.message });
  }
};
