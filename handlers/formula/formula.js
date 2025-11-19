const mongoose = require('mongoose');
const { formulaStorage } = require('../../models/calculatePlastic/formulaStorage');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');

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

// CREATE FORMULA
module.exports.createFormula = async (event) => {
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
    const { formulaName, functionBody, metadata } = body;

    // Validate required fields
    if (!formulaName || !functionBody) {
      return respond(400, { message: 'formulaName and functionBody are required' });
    }

    // Check if formula already exists
    if (formulaStorage.hasFormula(formulaName)) {
      return respond(400, { message: 'Formula with this name already exists' });
    }

    // Create function from string
    // Security note: In production, consider sanitizing or restricting function creation
    let calculationFunction;
    try {
      calculationFunction = new Function('params', functionBody);
    } catch (error) {
      return respond(400, {
        message: 'Invalid function body',
        error: error.message
      });
    }

    // Test the function with empty params to ensure it doesn't crash
    try {
      calculationFunction({});
    } catch (error) {
      // It's okay if it throws an error with empty params
      // We just want to make sure it's a valid function
    }

    // Add metadata with creator info
    const formulaMetadata = {
      ...metadata,
      createdBy: user.name || user.email,
      createdByRole: user.role,
      functionBody: functionBody // Store for retrieval
    };

    // Add formula to storage
    formulaStorage.addFormula(formulaName, calculationFunction, formulaMetadata);

    return respond(201, {
      message: 'Formula created successfully',
      formula: {
        name: formulaName,
        metadata: formulaStorage.getFormulaMetadata(formulaName)
      }
    });

  } catch (error) {
    console.error('Create Formula Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET ALL FORMULAS
module.exports.getFormulas = async (event) => {
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

    const allFormulas = formulaStorage.getAllFormulasInfo();

    return respond(200, {
      message: 'Formulas fetched successfully',
      count: allFormulas.length,
      formulas: allFormulas
    });

  } catch (error) {
    console.error('Get Formulas Error:', error);
    return respond(500, { message: error.message });
  }
};

// GET FORMULA BY NAME
module.exports.getFormulaByName = async (event) => {
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

    const { name } = event.pathParameters || {};
    if (!name) {
      return respond(400, { message: 'Formula name is required' });
    }

    if (!formulaStorage.hasFormula(name)) {
      return respond(404, { message: 'Formula not found' });
    }

    const metadata = formulaStorage.getFormulaMetadata(name);

    return respond(200, {
      message: 'Formula fetched successfully',
      formula: {
        name: name,
        metadata: metadata
      }
    });

  } catch (error) {
    console.error('Get Formula Error:', error);
    return respond(500, { message: error.message });
  }
};

// UPDATE FORMULA
module.exports.updateFormula = async (event) => {
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

    const { name } = event.pathParameters || {};
    if (!name) {
      return respond(400, { message: 'Formula name is required' });
    }

    if (!formulaStorage.hasFormula(name)) {
      return respond(404, { message: 'Formula not found' });
    }

    const body = JSON.parse(event.body);
    const { functionBody, metadata } = body;

    let calculationFunction;
    if (functionBody) {
      try {
        calculationFunction = new Function('params', functionBody);
      } catch (error) {
        return respond(400, {
          message: 'Invalid function body',
          error: error.message
        });
      }

      // Test the function
      try {
        calculationFunction({});
      } catch (error) {
        // It's okay if it throws with empty params
      }
    }

    // Update metadata
    const updatedMetadata = {
      ...metadata,
      lastModifiedBy: user.name || user.email,
      lastModifiedByRole: user.role
    };

    if (functionBody) {
      updatedMetadata.functionBody = functionBody;
    }

    // Update formula
    if (calculationFunction) {
      formulaStorage.updateFormula(name, calculationFunction, updatedMetadata);
    } else {
      // Update only metadata
      const existingMeta = formulaStorage.getFormulaMetadata(name) || {};
      formulaStorage.formulaMetadata.set(name, {
        ...existingMeta,
        ...updatedMetadata,
        lastModified: new Date()
      });
    }

    return respond(200, {
      message: 'Formula updated successfully',
      formula: {
        name: name,
        metadata: formulaStorage.getFormulaMetadata(name)
      }
    });

  } catch (error) {
    console.error('Update Formula Error:', error);
    return respond(500, { message: error.message });
  }
};

// DELETE FORMULA
module.exports.deleteFormula = async (event) => {
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

    // Only admins can delete formulas
    if (!user || user.role !== 'admin') {
      return respond(403, { message: 'Unauthorized. Only admins can delete formulas.' });
    }

    const { name } = event.pathParameters || {};
    if (!name) {
      return respond(400, { message: 'Formula name is required' });
    }

    if (!formulaStorage.hasFormula(name)) {
      return respond(404, { message: 'Formula not found' });
    }

    // Remove formula
    formulaStorage.removeFormula(name);

    return respond(200, {
      message: 'Formula deleted successfully',
      deletedFormula: name
    });

  } catch (error) {
    console.error('Delete Formula Error:', error);
    return respond(500, { message: error.message });
  }
};

// TEST FORMULA
module.exports.testFormula = async (event) => {
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

    const { name } = event.pathParameters || {};
    if (!name) {
      return respond(400, { message: 'Formula name is required' });
    }

    if (!formulaStorage.hasFormula(name)) {
      return respond(404, { message: 'Formula not found' });
    }

    const body = JSON.parse(event.body);
    const { parameters } = body;

    if (!parameters) {
      return respond(400, { message: 'parameters object is required' });
    }

    // Calculate using the formula
    const result = formulaStorage.calculate(name, parameters);

    return respond(200, {
      message: 'Formula calculation successful',
      formula: name,
      parameters: parameters,
      result: result,
      calculatedAt: new Date()
    });

  } catch (error) {
    console.error('Test Formula Error:', error);
    return respond(400, {
      message: 'Formula calculation failed',
      error: error.message
    });
  }
};

// BATCH CREATE FORMULAS
module.exports.batchCreateFormulas = async (event) => {
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

    if (!user || user.role !== 'admin') {
      return respond(403, { message: 'Unauthorized. Only admins can batch create formulas.' });
    }

    const body = JSON.parse(event.body);
    const { formulas } = body;

    if (!Array.isArray(formulas) || formulas.length === 0) {
      return respond(400, { message: 'formulas array is required and must not be empty' });
    }

    const results = [];

    for (const formula of formulas) {
      try {
        const { formulaName, functionBody, metadata } = formula;

        if (!formulaName || !functionBody) {
          results.push({
            name: formulaName || 'unnamed',
            success: false,
            error: 'formulaName and functionBody are required'
          });
          continue;
        }

        if (formulaStorage.hasFormula(formulaName)) {
          results.push({
            name: formulaName,
            success: false,
            error: 'Formula already exists'
          });
          continue;
        }

        const calculationFunction = new Function('params', functionBody);

        const formulaMetadata = {
          ...metadata,
          createdBy: user.name || user.email,
          createdByRole: user.role,
          functionBody: functionBody
        };

        formulaStorage.addFormula(formulaName, calculationFunction, formulaMetadata);

        results.push({
          name: formulaName,
          success: true,
          message: 'Formula created successfully'
        });

      } catch (error) {
        results.push({
          name: formula.formulaName || 'unnamed',
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return respond(201, {
      message: `Batch creation completed: ${successCount} succeeded, ${failureCount} failed`,
      totalProcessed: results.length,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error('Batch Create Formulas Error:', error);
    return respond(500, { message: error.message });
  }
};
