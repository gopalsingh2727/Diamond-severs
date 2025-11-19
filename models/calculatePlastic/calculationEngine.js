/**
 * CALCULATION ENGINE MODULE
 *
 * Purpose: Execute calculations across your order management system
 *
 * This module links your formulas to product types, materials, and orders,
 * allowing automatic calculation of weights, dimensions, and other values
 * throughout your production workflow.
 *
 * Integrates with: Order, Product, ProductType, Material schemas
 */

const { formulaStorage } = require('./formulaStorage');

class CalculationEngine {
  constructor() {
    // Link product types to their specific formulas
    this.productTypeFormulas = new Map();

    // Link material types to their specific formulas
    this.materialTypeFormulas = new Map();

    // Store calculation history for audit trail
    this.calculationHistory = [];

    // Maximum history entries to keep (prevent memory issues)
    this.maxHistorySize = 1000;
  }

  /**
   * Link a product type to a specific formula
   *
   * @param {string} productTypeId - MongoDB ObjectId of the product type
   * @param {string} formulaName - Name of the formula to use
   * @param {object} options - Optional configuration
   *
   * @example
   * calculationEngine.linkProductTypeToFormula(
   *   '507f1f77bcf86cd799439011',
   *   'rectangularBagWeight',
   *   { autoCalculate: true }
   * );
   */
  linkProductTypeToFormula(productTypeId, formulaName, options = {}) {
    if (!formulaStorage.hasFormula(formulaName)) {
      throw new Error(`Formula '${formulaName}' does not exist in storage`);
    }

    this.productTypeFormulas.set(productTypeId.toString(), {
      formulaName,
      linkedAt: new Date(),
      ...options
    });

    return true;
  }

  /**
   * Link a material type to a specific formula
   *
   * @param {string} materialTypeId - MongoDB ObjectId of the material type
   * @param {string} formulaName - Name of the formula to use
   * @param {object} options - Optional configuration
   */
  linkMaterialTypeToFormula(materialTypeId, formulaName, options = {}) {
    if (!formulaStorage.hasFormula(formulaName)) {
      throw new Error(`Formula '${formulaName}' does not exist in storage`);
    }

    this.materialTypeFormulas.set(materialTypeId.toString(), {
      formulaName,
      linkedAt: new Date(),
      ...options
    });

    return true;
  }

  /**
   * Calculate for an order based on its product type
   *
   * @param {object} orderData - Order data including productTypeId and parameters
   * @returns {object} - Calculation result with metadata
   *
   * @example
   * const result = calculationEngine.calculateForOrder({
   *   orderId: '507f1f77bcf86cd799439012',
   *   productTypeId: '507f1f77bcf86cd799439011',
   *   parameters: {
   *     length: 30,
   *     width: 20,
   *     thickness: 0.05,
   *     density: 0.92
   *   }
   * });
   */
  calculateForOrder(orderData) {
    const { orderId, productTypeId, parameters, materialTypeId } = orderData;

    let formulaName;
    let sourceType;

    // Try to find formula by product type first
    if (productTypeId) {
      const productTypeLink = this.productTypeFormulas.get(productTypeId.toString());
      if (productTypeLink) {
        formulaName = productTypeLink.formulaName;
        sourceType = 'productType';
      }
    }

    // If not found, try material type
    if (!formulaName && materialTypeId) {
      const materialTypeLink = this.materialTypeFormulas.get(materialTypeId.toString());
      if (materialTypeLink) {
        formulaName = materialTypeLink.formulaName;
        sourceType = 'materialType';
      }
    }

    if (!formulaName) {
      throw new Error('No formula linked to this product or material type');
    }

    // Execute the calculation
    const result = formulaStorage.calculate(formulaName, parameters);

    // Store in history
    this.addToHistory({
      orderId,
      productTypeId,
      materialTypeId,
      formulaName,
      sourceType,
      parameters,
      result,
      calculatedAt: new Date()
    });

    return {
      success: true,
      result,
      formulaUsed: formulaName,
      sourceType,
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate material weight for an order's mix materials
   *
   * @param {object} mixMaterialData - Mix material specifications
   * @returns {object} - Calculated weights
   *
   * @example
   * const weights = calculationEngine.calculateMixMaterials({
   *   orderId: '507f1f77bcf86cd799439012',
   *   mixMaterials: [
   *     { materialTypeId: '...', ratio: 0.7, parameters: {...} },
   *     { materialTypeId: '...', ratio: 0.3, parameters: {...} }
   *   ]
   * });
   */
  calculateMixMaterials(mixMaterialData) {
    const { orderId, mixMaterials } = mixMaterialData;
    const results = [];

    for (const material of mixMaterials) {
      const { materialTypeId, ratio, parameters } = material;

      const materialLink = this.materialTypeFormulas.get(materialTypeId.toString());

      if (materialLink) {
        const formulaName = materialLink.formulaName;
        const baseWeight = formulaStorage.calculate(formulaName, parameters);
        const adjustedWeight = baseWeight * (ratio || 1);

        results.push({
          materialTypeId,
          formulaUsed: formulaName,
          baseWeight,
          ratio,
          adjustedWeight,
          unit: parameters.unit || 'grams'
        });
      } else {
        results.push({
          materialTypeId,
          error: 'No formula linked to this material type',
          ratio,
          adjustedWeight: null
        });
      }
    }

    return {
      orderId,
      totalWeight: results.reduce((sum, r) => sum + (r.adjustedWeight || 0), 0),
      materials: results,
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate based on product specifications
   *
   * @param {object} productSpecData - Product spec with dimensions
   * @returns {object} - Calculation results
   *
   * @example
   * const result = calculationEngine.calculateFromProductSpec({
   *   productTypeId: '507f1f77bcf86cd799439011',
   *   dimensions: [
   *     { name: 'length', value: 30, unit: 'cm' },
   *     { name: 'width', value: 20, unit: 'cm' },
   *     { name: 'thickness', value: 0.05, unit: 'mm' }
   *   ],
   *   additionalParams: { density: 0.92 }
   * });
   */
  calculateFromProductSpec(productSpecData) {
    const { productTypeId, dimensions, additionalParams = {} } = productSpecData;

    const productTypeLink = this.productTypeFormulas.get(productTypeId.toString());

    if (!productTypeLink) {
      throw new Error('No formula linked to this product type');
    }

    // Convert dimensions array to parameters object
    const parameters = {};
    dimensions.forEach(dim => {
      parameters[dim.name] = dim.value;
    });

    // Merge with additional parameters
    Object.assign(parameters, additionalParams);

    // Execute calculation
    const result = formulaStorage.calculate(productTypeLink.formulaName, parameters);

    return {
      success: true,
      result,
      formulaUsed: productTypeLink.formulaName,
      parameters,
      calculatedAt: new Date()
    };
  }

  /**
   * Batch calculate for multiple orders
   *
   * @param {Array} ordersArray - Array of order data objects
   * @returns {Array} - Array of calculation results
   */
  batchCalculateForOrders(ordersArray) {
    return ordersArray.map(orderData => {
      try {
        return {
          orderId: orderData.orderId,
          ...this.calculateForOrder(orderData)
        };
      } catch (error) {
        return {
          orderId: orderData.orderId,
          success: false,
          error: error.message
        };
      }
    });
  }

  /**
   * Get the formula associated with a product type
   *
   * @param {string} productTypeId
   * @returns {object|null}
   */
  getProductTypeFormula(productTypeId) {
    return this.productTypeFormulas.get(productTypeId.toString()) || null;
  }

  /**
   * Get the formula associated with a material type
   *
   * @param {string} materialTypeId
   * @returns {object|null}
   */
  getMaterialTypeFormula(materialTypeId) {
    return this.materialTypeFormulas.get(materialTypeId.toString()) || null;
  }

  /**
   * List all product type formula mappings
   *
   * @returns {Array}
   */
  listProductTypeFormulas() {
    return Array.from(this.productTypeFormulas.entries()).map(([id, config]) => ({
      productTypeId: id,
      ...config
    }));
  }

  /**
   * List all material type formula mappings
   *
   * @returns {Array}
   */
  listMaterialTypeFormulas() {
    return Array.from(this.materialTypeFormulas.entries()).map(([id, config]) => ({
      materialTypeId: id,
      ...config
    }));
  }

  /**
   * Remove a product type formula link
   *
   * @param {string} productTypeId
   * @returns {boolean}
   */
  unlinkProductTypeFormula(productTypeId) {
    return this.productTypeFormulas.delete(productTypeId.toString());
  }

  /**
   * Remove a material type formula link
   *
   * @param {string} materialTypeId
   * @returns {boolean}
   */
  unlinkMaterialTypeFormula(materialTypeId) {
    return this.materialTypeFormulas.delete(materialTypeId.toString());
  }

  /**
   * Add entry to calculation history
   *
   * @private
   */
  addToHistory(entry) {
    this.calculationHistory.push(entry);

    // Keep history size manageable
    if (this.calculationHistory.length > this.maxHistorySize) {
      this.calculationHistory.shift(); // Remove oldest entry
    }
  }

  /**
   * Get calculation history for an order
   *
   * @param {string} orderId
   * @returns {Array}
   */
  getOrderCalculationHistory(orderId) {
    return this.calculationHistory.filter(entry =>
      entry.orderId && entry.orderId.toString() === orderId.toString()
    );
  }

  /**
   * Get recent calculation history
   *
   * @param {number} limit - Number of entries to return
   * @returns {Array}
   */
  getRecentHistory(limit = 50) {
    return this.calculationHistory.slice(-limit).reverse();
  }

  /**
   * Clear calculation history
   */
  clearHistory() {
    this.calculationHistory = [];
  }

  /**
   * Export all configuration (for backup or migration)
   *
   * @returns {object}
   */
  exportConfiguration() {
    return {
      productTypeFormulas: Array.from(this.productTypeFormulas.entries()),
      materialTypeFormulas: Array.from(this.materialTypeFormulas.entries()),
      exportedAt: new Date()
    };
  }

  /**
   * Import configuration (for restore or migration)
   *
   * @param {object} config - Configuration object from exportConfiguration
   */
  importConfiguration(config) {
    if (config.productTypeFormulas) {
      this.productTypeFormulas = new Map(config.productTypeFormulas);
    }

    if (config.materialTypeFormulas) {
      this.materialTypeFormulas = new Map(config.materialTypeFormulas);
    }

    return true;
  }
}

// Create a singleton instance
const calculationEngine = new CalculationEngine();

// Export both the class and the singleton
module.exports = {
  CalculationEngine,
  calculationEngine
};
