const { Parser } = require('expr-eval');

/**
 * Evaluates formulas in dimensions array
 * Formulas can reference other dimensions by name
 * Dimensions are evaluated in order, so formulas can only reference earlier dimensions
 *
 * @param {Array} dimensions - Array of dimension objects
 * @returns {Array} - Updated dimensions array with calculated values
 * @throws {Error} - If formula evaluation fails or circular dependencies detected
 */
function evaluateDimensionFormulas(dimensions) {
  if (!dimensions || !Array.isArray(dimensions)) {
    return dimensions;
  }

  // Create a parser instance
  const parser = new Parser();

  // Context stores calculated dimension values that can be referenced by formulas
  const context = {};

  // Process each dimension in order
  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i];

    // If dimension has a formula, calculate its value
    if (dim.formula && dim.formula.trim() !== '') {
      try {
        // Validate that formula only uses numbers for dimensions
        if (dim.dataType !== 'number') {
          throw new Error(`Formula can only be used with dataType 'number', but '${dim.name}' has dataType '${dim.dataType}'`);
        }

        // Parse and evaluate the formula with current context
        const expression = parser.parse(dim.formula);
        const result = expression.evaluate(context);

        // Validate result is a number
        if (typeof result !== 'number' || isNaN(result)) {
          throw new Error(`Formula '${dim.formula}' did not evaluate to a valid number (got: ${result})`);
        }

        // Update dimension with calculated value
        dim.value = result;
        dim.isCalculated = true;

      } catch (error) {
        throw new Error(`Formula error in dimension '${dim.name}': ${error.message}`);
      }
    } else {
      // Manual value - ensure isCalculated is false
      dim.isCalculated = false;
    }

    // Add this dimension's value to context for future formulas
    // Only add numeric values to context to prevent type errors
    if (dim.dataType === 'number' && dim.value !== null && dim.value !== undefined) {
      context[dim.name] = Number(dim.value);
    }
  }

  return dimensions;
}

/**
 * Validates that all dimension references in formulas exist and are defined before usage
 *
 * @param {Array} dimensions - Array of dimension objects
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
function validateDimensionReferences(dimensions) {
  if (!dimensions || !Array.isArray(dimensions)) {
    return { valid: true, errors: [] };
  }

  const errors = [];
  const availableDimensions = new Set();

  // Create parser to extract variable names
  const parser = new Parser();

  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i];

    // Check for duplicate dimension names
    if (availableDimensions.has(dim.name)) {
      errors.push(`Duplicate dimension name: '${dim.name}' at index ${i}`);
    }

    if (dim.formula && dim.formula.trim() !== '') {
      try {
        // Parse formula to extract variables
        const expression = parser.parse(dim.formula);
        const variables = expression.variables();

        // Check each variable is defined in earlier dimensions
        variables.forEach(varName => {
          if (!availableDimensions.has(varName)) {
            errors.push(
              `Dimension '${dim.name}' formula references '${varName}' which is not defined or is defined later. ` +
              `Only dimensions defined earlier can be referenced.`
            );
          }
        });
      } catch (error) {
        errors.push(`Invalid formula syntax in dimension '${dim.name}': ${error.message}`);
      }
    }

    // Add this dimension to available dimensions
    availableDimensions.add(dim.name);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Detects circular dependencies in dimension formulas
 *
 * @param {Array} dimensions - Array of dimension objects
 * @returns {Object} - { hasCircularDeps: boolean, errors: Array<string> }
 */
function detectCircularDependencies(dimensions) {
  if (!dimensions || !Array.isArray(dimensions)) {
    return { hasCircularDeps: false, errors: [] };
  }

  const errors = [];
  const parser = new Parser();

  // Build dependency graph
  const dependencies = new Map();
  dimensions.forEach(dim => {
    if (dim.formula && dim.formula.trim() !== '') {
      try {
        const expression = parser.parse(dim.formula);
        const variables = expression.variables();
        dependencies.set(dim.name, variables);
      } catch (error) {
        // Syntax errors will be caught by validateDimensionReferences
      }
    }
  });

  // Check for circular dependencies using depth-first search
  const visited = new Set();
  const recursionStack = new Set();

  function hasCycle(dimName, path = []) {
    if (recursionStack.has(dimName)) {
      const cycle = [...path, dimName].join(' -> ');
      errors.push(`Circular dependency detected: ${cycle}`);
      return true;
    }

    if (visited.has(dimName)) {
      return false;
    }

    visited.add(dimName);
    recursionStack.add(dimName);

    const deps = dependencies.get(dimName) || [];
    for (const dep of deps) {
      if (hasCycle(dep, [...path, dimName])) {
        return true;
      }
    }

    recursionStack.delete(dimName);
    return false;
  }

  // Check each dimension for cycles
  for (const dim of dimensions) {
    if (dim.formula && !visited.has(dim.name)) {
      if (hasCycle(dim.name)) {
        break; // Stop after finding first cycle
      }
    }
  }

  return {
    hasCircularDeps: errors.length > 0,
    errors
  };
}

module.exports = {
  evaluateDimensionFormulas,
  validateDimensionReferences,
  detectCircularDependencies
};
