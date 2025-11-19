/**
 * FORMULA STORAGE MODULE
 *
 * Purpose: Store and manage YOUR custom calculation formulas
 *
 * This module allows you to define, store, and execute custom formulas
 * for calculating material requirements, weights, dimensions, and more.
 *
 * NO PRE-DEFINED FORMULAS - You add your own!
 */

class FormulaStorage {
  constructor() {
    // Store all your custom formulas here
    this.formulas = new Map();

    // Optional: Store formula metadata (description, required parameters, etc.)
    this.formulaMetadata = new Map();
  }

  /**
   * Add a custom formula to the storage
   *
   * @param {string} formulaName - Unique name for your formula
   * @param {function} calculationFunction - Your calculation function
   * @param {object} metadata - Optional metadata about the formula
   *
   * @example
   * formulaStorage.addFormula(
   *   'rectangularBagWeight',
   *   ({ length, width, thickness, density }) => {
   *     const volume = length * width * thickness;
   *     return volume * density;
   *   },
   *   {
   *     description: 'Calculate weight of rectangular plastic bag',
   *     requiredParams: ['length', 'width', 'thickness', 'density'],
   *     unit: 'grams'
   *   }
   * );
   */
  addFormula(formulaName, calculationFunction, metadata = {}) {
    if (typeof calculationFunction !== 'function') {
      throw new Error('Calculation must be a function');
    }

    this.formulas.set(formulaName, calculationFunction);

    if (Object.keys(metadata).length > 0) {
      this.formulaMetadata.set(formulaName, {
        ...metadata,
        createdAt: new Date(),
        lastModified: new Date()
      });
    }

    return true;
  }

  /**
   * Update an existing formula
   *
   * @param {string} formulaName - Name of the formula to update
   * @param {function} calculationFunction - New calculation function
   * @param {object} metadata - Optional updated metadata
   */
  updateFormula(formulaName, calculationFunction, metadata = null) {
    if (!this.formulas.has(formulaName)) {
      throw new Error(`Formula '${formulaName}' does not exist`);
    }

    this.formulas.set(formulaName, calculationFunction);

    if (metadata) {
      const existingMeta = this.formulaMetadata.get(formulaName) || {};
      this.formulaMetadata.set(formulaName, {
        ...existingMeta,
        ...metadata,
        lastModified: new Date()
      });
    }

    return true;
  }

  /**
   * Execute a stored formula with given parameters
   *
   * @param {string} formulaName - Name of the formula to execute
   * @param {object} parameters - Parameters required by the formula
   * @returns {number|object} - Result of the calculation
   *
   * @example
   * const weight = formulaStorage.calculate('rectangularBagWeight', {
   *   length: 30,
   *   width: 20,
   *   thickness: 0.05,
   *   density: 0.92
   * });
   */
  calculate(formulaName, parameters = {}) {
    const formula = this.formulas.get(formulaName);

    if (!formula) {
      throw new Error(`Formula '${formulaName}' not found`);
    }

    try {
      const result = formula(parameters);
      return result;
    } catch (error) {
      throw new Error(`Error executing formula '${formulaName}': ${error.message}`);
    }
  }

  /**
   * Get formula metadata (description, required params, etc.)
   *
   * @param {string} formulaName - Name of the formula
   * @returns {object} - Formula metadata
   */
  getFormulaMetadata(formulaName) {
    return this.formulaMetadata.get(formulaName) || null;
  }

  /**
   * List all available formulas
   *
   * @returns {Array} - Array of formula names
   */
  listFormulas() {
    return Array.from(this.formulas.keys());
  }

  /**
   * Check if a formula exists
   *
   * @param {string} formulaName - Name of the formula
   * @returns {boolean}
   */
  hasFormula(formulaName) {
    return this.formulas.has(formulaName);
  }

  /**
   * Remove a formula from storage
   *
   * @param {string} formulaName - Name of the formula to remove
   * @returns {boolean}
   */
  removeFormula(formulaName) {
    const deleted = this.formulas.delete(formulaName);
    this.formulaMetadata.delete(formulaName);
    return deleted;
  }

  /**
   * Get all formulas with their metadata
   *
   * @returns {Array} - Array of objects containing formula info
   */
  getAllFormulasInfo() {
    return Array.from(this.formulas.keys()).map(name => ({
      name,
      metadata: this.formulaMetadata.get(name) || {},
      exists: true
    }));
  }

  /**
   * Clear all formulas (use with caution!)
   */
  clearAll() {
    this.formulas.clear();
    this.formulaMetadata.clear();
  }

  /**
   * Batch add multiple formulas at once
   *
   * @param {Array} formulasArray - Array of {name, function, metadata} objects
   *
   * @example
   * formulaStorage.batchAddFormulas([
   *   {
   *     name: 'formula1',
   *     function: (params) => params.a + params.b,
   *     metadata: { description: 'Simple addition' }
   *   },
   *   {
   *     name: 'formula2',
   *     function: (params) => params.x * params.y,
   *     metadata: { description: 'Simple multiplication' }
   *   }
   * ]);
   */
  batchAddFormulas(formulasArray) {
    const results = [];

    for (const formula of formulasArray) {
      try {
        this.addFormula(formula.name, formula.function, formula.metadata || {});
        results.push({ name: formula.name, success: true });
      } catch (error) {
        results.push({ name: formula.name, success: false, error: error.message });
      }
    }

    return results;
  }
}

// Create a singleton instance
const formulaStorage = new FormulaStorage();

// Export both the class and the singleton
module.exports = {
  FormulaStorage,
  formulaStorage
};
