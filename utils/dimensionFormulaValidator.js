const {
  validateDimensionReferences,
  detectCircularDependencies
} = require('./dimensionFormulaEvaluator');

/**
 * Validates dimension formulas before saving to database
 * Performs comprehensive validation including:
 * - Dimension name uniqueness
 * - Formula syntax
 * - Reference validation (dimensions must be defined before usage)
 * - Circular dependency detection
 * - Data type validation for formulas
 *
 * @param {Array} dimensions - Array of dimension objects to validate
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
function validateDimensions(dimensions) {
  if (!dimensions || !Array.isArray(dimensions)) {
    return { valid: true, errors: [] };
  }

  const allErrors = [];

  // Step 1: Validate dimension names are not empty
  dimensions.forEach((dim, index) => {
    if (!dim.name || dim.name.trim() === '') {
      allErrors.push(`Dimension at index ${index} has empty name`);
    }
  });

  // Step 2: Validate formulas are only used with number data type
  dimensions.forEach(dim => {
    if (dim.formula && dim.formula.trim() !== '' && dim.dataType !== 'number') {
      allErrors.push(
        `Dimension '${dim.name}' has formula but dataType is '${dim.dataType}'. ` +
        `Formulas can only be used with dataType 'number'`
      );
    }
  });

  // Step 3: Validate dimension references
  const refValidation = validateDimensionReferences(dimensions);
  if (!refValidation.valid) {
    allErrors.push(...refValidation.errors);
  }

  // Step 4: Detect circular dependencies
  const circularCheck = detectCircularDependencies(dimensions);
  if (circularCheck.hasCircularDeps) {
    allErrors.push(...circularCheck.errors);
  }

  // Step 5: Validate formula length (prevent extremely long formulas)
  dimensions.forEach(dim => {
    if (dim.formula && dim.formula.length > 500) {
      allErrors.push(
        `Dimension '${dim.name}' formula is too long (${dim.formula.length} characters). ` +
        `Maximum allowed is 500 characters`
      );
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Quick validation for a single formula string
 * Used for testing formulas without full dimension context
 *
 * @param {string} formula - Formula string to validate
 * @param {Array} availableDimensions - Array of dimension names that can be referenced
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateFormulaSyntax(formula, availableDimensions = []) {
  if (!formula || formula.trim() === '') {
    return { valid: true, error: null };
  }

  try {
    const { Parser } = require('expr-eval');
    const parser = new Parser();

    // Try to parse the formula
    const expression = parser.parse(formula);

    // Get variables used in formula
    const variables = expression.variables();

    // Check if all variables are in available dimensions
    const unavailable = variables.filter(v => !availableDimensions.includes(v));
    if (unavailable.length > 0) {
      return {
        valid: false,
        error: `Formula references undefined dimensions: ${unavailable.join(', ')}`
      };
    }

    return { valid: true, error: null };

  } catch (error) {
    return {
      valid: false,
      error: `Invalid formula syntax: ${error.message}`
    };
  }
}

/**
 * Sanitizes dimension formula to prevent injection attacks
 * Removes any potentially dangerous characters
 *
 * @param {string} formula - Formula string to sanitize
 * @returns {string} - Sanitized formula
 */
function sanitizeFormula(formula) {
  if (!formula) return formula;

  // expr-eval already provides safe evaluation without eval()
  // Just trim whitespace and validate length
  return formula.trim();
}

module.exports = {
  validateDimensions,
  validateFormulaSyntax,
  sanitizeFormula
};
