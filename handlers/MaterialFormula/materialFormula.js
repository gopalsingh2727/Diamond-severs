const connect = require('../../config/mongodb/db');
const MaterialFormula = require('../../models/MaterialFormula/materialFormula');
const Material = require('../../models/Material/material');
const { withLogger } = require('../../middleware/logger');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  return apiKey === process.env.API_KEY;
};

/**
 * Create Material Formula
 * POST /api/material-formula
 */
module.exports.createMaterialFormula = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const body = JSON.parse(event.body);
    const {
      formulaName,
      productSpecId,
      productType,
      materials,
      mixingTimeMinutes,
      mixingTemperature,
      mixingSpeed,
      expectedOutput,
      expectedWastage,
      minBatchSize,
      maxBatchSize,
      notes,
      branchId
    } = body;

    // Validation
    if (!formulaName || !productType || !materials || materials.length === 0 || !branchId) {
      return respond(400, {
        message: 'Formula name, product type, materials, and branch ID are required'
      });
    }

    // Validate total percentage = 100%
    const totalPercentage = materials.reduce((sum, m) => sum + m.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return respond(400, {
        message: `Material percentages must total 100%. Current total: ${totalPercentage}%`
      });
    }

    // Verify all materials exist
    const materialIds = materials.map(m => m.materialId);
    const existingMaterials = await Material.find({ _id: { $in: materialIds } });

    if (existingMaterials.length !== materialIds.length) {
      return respond(400, { message: 'One or more materials not found' });
    }

    // Create formula
    const formula = new MaterialFormula({
      formulaName,
      productSpecId: productSpecId || undefined,
      productType,
      branchId,
      materials,
      mixingTimeMinutes: mixingTimeMinutes || 0,
      mixingTemperature: mixingTemperature || 0,
      mixingSpeed: mixingSpeed || 'medium',
      expectedOutput: expectedOutput || 95,
      expectedWastage: expectedWastage || 5,
      minBatchSize: minBatchSize || 10,
      maxBatchSize: maxBatchSize || 500,
      notes,
      createdBy: event.requestContext?.authorizer?.userId,
      createdByRole: event.requestContext?.authorizer?.role || 'Manager'
    });

    await formula.save();

    logger.info('Material formula created', {
      formulaId: formula._id,
      formulaName: formula.formulaName,
      branchId
    });

    return respond(201, {
      message: 'Material formula created successfully',
      formula
    });
  } catch (error) {
    logger.error('Create material formula error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Get All Material Formulas
 * GET /api/material-formula
 * Query params: branchId, productType, isActive
 */
module.exports.getAllMaterialFormulas = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { branchId, productType, isActive } = event.queryStringParameters || {};

    const filter = {};
    if (branchId) filter.branchId = branchId;
    if (productType) filter.productType = productType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const formulas = await MaterialFormula.find(filter)
      .populate('materials.materialId', 'materialName materialType')
      .populate('productSpecId', 'specName')
      .sort({ createdAt: -1 });

    return respond(200, {
      formulas,
      count: formulas.length
    });
  } catch (error) {
    logger.error('Get material formulas error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Get Material Formula by ID
 * GET /api/material-formula/{id}
 */
module.exports.getMaterialFormulaById = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { id } = event.pathParameters;

    const formula = await MaterialFormula.findById(id)
      .populate('materials.materialId', 'materialName materialType materialMol')
      .populate('productSpecId', 'specName description');

    if (!formula) {
      return respond(404, { message: 'Material formula not found' });
    }

    return respond(200, { formula });
  } catch (error) {
    logger.error('Get material formula error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Get Formula by Product Spec
 * GET /api/material-formula/product/{productSpecId}
 */
module.exports.getFormulaByProduct = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { productSpecId } = event.pathParameters;

    const formulas = await MaterialFormula.find({
      productSpecId,
      isActive: true
    })
      .populate('materials.materialId', 'materialName materialType')
      .sort({ version: -1 });

    return respond(200, {
      formulas,
      count: formulas.length
    });
  } catch (error) {
    logger.error('Get formula by product error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Get Formula by Product Type
 * GET /api/material-formula/product-type/{productType}
 */
module.exports.getFormulaByProductType = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { productType } = event.pathParameters;
    const { branchId } = event.queryStringParameters || {};

    const filter = {
      productType,
      isActive: true
    };

    if (branchId) {
      filter.branchId = branchId;
    }

    const formulas = await MaterialFormula.find(filter)
      .populate('materials.materialId', 'materialName materialType')
      .sort({ version: -1 });

    return respond(200, {
      productType,
      formulas,
      count: formulas.length
    });
  } catch (error) {
    logger.error('Get formula by product type error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Calculate Material Requirements
 * POST /api/material-formula/calculate
 * Body: { materialFormulaId, quantity }
 */
module.exports.calculateMaterialRequirements = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { materialFormulaId, quantity } = JSON.parse(event.body);

    if (!materialFormulaId || !quantity) {
      return respond(400, { message: 'Formula ID and quantity are required' });
    }

    const formula = await MaterialFormula.findById(materialFormulaId)
      .populate('materials.materialId', 'materialName materialType');

    if (!formula) {
      return respond(404, { message: 'Formula not found' });
    }

    // Calculate requirements using the model method
    const calculation = formula.calculateRequirements(quantity);

    logger.info('Material requirements calculated', {
      formulaId: materialFormulaId,
      quantity,
      totalWeight: calculation.totalWeight
    });

    return respond(200, calculation);
  } catch (error) {
    logger.error('Calculate requirements error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Update Material Formula
 * PUT /api/material-formula/{id}
 */
module.exports.updateMaterialFormula = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body);

    const formula = await MaterialFormula.findById(id);
    if (!formula) {
      return respond(404, { message: 'Material formula not found' });
    }

    // Validate total percentage if materials are being updated
    if (updates.materials) {
      const totalPercentage = updates.materials.reduce((sum, m) => sum + m.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return respond(400, {
          message: `Material percentages must total 100%. Current total: ${totalPercentage}%`
        });
      }
    }

    // Update allowed fields
    const allowedUpdates = [
      'formulaName',
      'materials',
      'mixingTimeMinutes',
      'mixingTemperature',
      'mixingSpeed',
      'expectedOutput',
      'expectedWastage',
      'minBatchSize',
      'maxBatchSize',
      'notes',
      'isActive'
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        formula[field] = updates[field];
      }
    });

    // Increment version on update
    formula.version += 1;

    await formula.save();

    logger.info('Material formula updated', {
      formulaId: id,
      version: formula.version
    });

    return respond(200, {
      message: 'Material formula updated successfully',
      formula
    });
  } catch (error) {
    logger.error('Update material formula error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Delete (Deactivate) Material Formula
 * DELETE /api/material-formula/{id}
 */
module.exports.deleteMaterialFormula = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { id } = event.pathParameters;

    const formula = await MaterialFormula.findById(id);
    if (!formula) {
      return respond(404, { message: 'Material formula not found' });
    }

    // Soft delete - just deactivate
    formula.isActive = false;
    await formula.save();

    logger.info('Material formula deactivated', { formulaId: id });

    return respond(200, { message: 'Material formula deactivated successfully' });
  } catch (error) {
    logger.error('Delete material formula error', { error: error.message });
    return respond(500, { message: error.message });
  }
});

/**
 * Clone Material Formula (Create new version)
 * POST /api/material-formula/{id}/clone
 */
module.exports.cloneMaterialFormula = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { id } = event.pathParameters;
    const { formulaName } = JSON.parse(event.body || '{}');

    const originalFormula = await MaterialFormula.findById(id);
    if (!originalFormula) {
      return respond(404, { message: 'Original formula not found' });
    }

    // Create clone
    const clonedFormula = new MaterialFormula({
      formulaName: formulaName || `${originalFormula.formulaName} (Copy)`,
      productSpecId: originalFormula.productSpecId,
      productType: originalFormula.productType,
      branchId: originalFormula.branchId,
      materials: originalFormula.materials,
      mixingTimeMinutes: originalFormula.mixingTimeMinutes,
      mixingTemperature: originalFormula.mixingTemperature,
      mixingSpeed: originalFormula.mixingSpeed,
      expectedOutput: originalFormula.expectedOutput,
      expectedWastage: originalFormula.expectedWastage,
      minBatchSize: originalFormula.minBatchSize,
      maxBatchSize: originalFormula.maxBatchSize,
      notes: originalFormula.notes,
      version: originalFormula.version + 1,
      createdBy: event.requestContext?.authorizer?.userId,
      createdByRole: event.requestContext?.authorizer?.role || 'Manager'
    });

    await clonedFormula.save();

    logger.info('Material formula cloned', {
      originalId: id,
      clonedId: clonedFormula._id
    });

    return respond(201, {
      message: 'Material formula cloned successfully',
      formula: clonedFormula
    });
  } catch (error) {
    logger.error('Clone material formula error', { error: error.message });
    return respond(500, { message: error.message });
  }
});
