// config/mongodb/modelFactory.js
const { getMainConnection, getMasterAdminConnection } = require('./connections');

/**
 * Model Factory for Multiple Database Connections
 *
 * This factory creates models on the appropriate database connection
 * based on the context (main or masteradmin).
 *
 * Usage Example:
 * const { getModel } = require('./config/mongodb/modelFactory');
 *
 * // Get Branch model from main database
 * const Branch = await getModel('Branch', 'main');
 *
 * // Get MasterAdmin model from masteradmin database
 * const MasterAdmin = await getModel('MasterAdmin', 'masteradmin');
 */

// Cache for compiled models
const modelCache = {
  main: {},
  masteradmin: {}
};

/**
 * Model Schema Registry
 * Maps model names to their schema files
 */
const MODEL_SCHEMAS = {
  // User models
  'Admin': () => require('../../models/Admin/Admin'),
  'Manager': () => require('../../models/Manager/Mannager'),
  'MasterAdmin': () => require('../../models/masterAdmin/masterAdmin'),
  'MachineOperator': () => require('../../models/MachineOperator/MachineOperator'),

  // Business models
  'Branch': () => require('../../models/Branch/Branch'),
  'Customer': () => require('../../models/Customer/Customer'),
  'Machine': () => require('../../models/Machine/machine'),
  'MachineType': () => require('../../models/MachineType/MachineType'),

  // Product models
  'Product': () => require('../../models/product/product'),
  'ProductCatalogue': () => require('../../models/ProductCatalogue/productType'),
  'ProductSpec': () => require('../../models/productSpecSchema/productSpecSchema'),
  'Product27Infinity': () => require('../../models/Product27InfinitySchema/Product27InfinitySchema'),

  // Material models
  'Material': () => require('../../models/Material/Material'),
  'MaterialType': () => require('../../models/MaterialType/materialType'),
  'MaterialFormula': () => require('../../models/MaterialFormula/materialFormula'),

  // Order models
  'Order': () => require('../../models/oders/oders'),

  // Other models
  'Table': () => require('../../models/Table/table'),
  'Step': () => require('../../models/steps/step'),
  'DeviceAccess': () => require('../../models/deviceAccess/deviceAccess'),
  'DeviceAddMachine': () => require('../../models/deviceAddmachine/deviceAddmachine'),
  'DevicesForControlPanel': () => require('../../models/devicesForControlPanel/devicesForControlPanel'),

  // Add more models as needed
};

/**
 * Get a model with the specified database connection
 *
 * @param {string} modelName - Name of the model (e.g., 'Branch', 'MasterAdmin')
 * @param {string} connectionType - Type of connection: 'main' or 'masteradmin'
 * @returns {Promise<Model>} Mongoose model
 */
const getModel = async (modelName, connectionType = 'main') => {
  const cacheKey = connectionType === 'masteradmin' ? 'masteradmin' : 'main';

  // Return cached model if it exists
  if (modelCache[cacheKey][modelName]) {
    return modelCache[cacheKey][modelName];
  }

  // Get the appropriate connection
  const connection = connectionType === 'masteradmin'
    ? await getMasterAdminConnection()
    : await getMainConnection();

  // Check if model is already registered on this connection
  if (connection.models[modelName]) {
    modelCache[cacheKey][modelName] = connection.models[modelName];
    return connection.models[modelName];
  }

  // Get schema loader function
  const schemaLoader = MODEL_SCHEMAS[modelName];
  if (!schemaLoader) {
    throw new Error(`Model "${modelName}" not found in schema registry. Please add it to MODEL_SCHEMAS in modelFactory.js`);
  }

  try {
    // Load the schema module
    const schemaModule = schemaLoader();

    // Extract the schema (different models export differently)
    let schema;
    if (schemaModule.schema) {
      schema = schemaModule.schema;
    } else if (schemaModule.default && schemaModule.default.schema) {
      schema = schemaModule.default.schema;
    } else {
      // If the module exports a model directly, we need to extract its schema
      // This is a workaround for models that export mongoose.model() directly
      console.warn(`⚠️ Model "${modelName}" exports a compiled model. Consider exporting schema separately for multi-connection support.`);
      return schemaModule; // Return the original model (uses default mongoose connection)
    }

    // Create model on the specified connection
    const model = connection.model(modelName, schema);

    // Cache the model
    modelCache[cacheKey][modelName] = model;

    console.log(`✅ Model "${modelName}" compiled for ${cacheKey} database`);

    return model;

  } catch (error) {
    console.error(`❌ Error loading model "${modelName}":`, error);
    throw error;
  }
};

/**
 * Get multiple models at once
 *
 * @param {Array<string>} modelNames - Array of model names
 * @param {string} connectionType - Type of connection: 'main' or 'masteradmin'
 * @returns {Promise<Object>} Object with model name as key and model as value
 */
const getModels = async (modelNames, connectionType = 'main') => {
  const models = {};

  await Promise.all(
    modelNames.map(async (name) => {
      models[name] = await getModel(name, connectionType);
    })
  );

  return models;
};

/**
 * Clear model cache
 * Useful for testing or when you need to reload models
 */
const clearCache = (connectionType = null) => {
  if (connectionType) {
    modelCache[connectionType] = {};
  } else {
    modelCache.main = {};
    modelCache.masteradmin = {};
  }
};

module.exports = {
  getModel,
  getModels,
  clearCache,
  MODEL_SCHEMAS, // Export for reference
};
