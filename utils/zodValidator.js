// ============================================================================
// ZOD VALIDATION UTILITY
// ============================================================================
//
// This utility provides a centralized way to validate request data using Zod schemas
// Usage in Lambda handlers:
//
// const { validateRequest } = require('@/utils/zodValidator');
// const { createBranchSchema } = require('@/models/Branch/Branch');
//
// exports.handler = async (event) => {
//   const validation = validateRequest(event.body, createBranchSchema);
//   if (!validation.success) {
//     return validation.errorResponse;
//   }
//   const data = validation.data;
//   // Use validated data...
// };

const { z } = require('zod');

/**
 * Validates request body against a Zod schema
 * @param {string|object} body - Request body (string or already parsed object)
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {object} Validation result with success flag, data or errorResponse
 */
const validateRequest = (body, schema) => {
  try {
    // Parse body if it's a string
    const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;

    // Validate against schema
    const validatedData = schema.parse(parsedBody);

    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      return {
        success: false,
        errorResponse: {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Validation failed',
            errors: formattedErrors
          })
        }
      };
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return {
        success: false,
        errorResponse: {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Invalid JSON in request body',
            error: error.message
          })
        }
      };
    }

    // Handle other errors
    return {
      success: false,
      errorResponse: {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Validation error',
          error: error.message
        })
      }
    };
  }
};

/**
 * Validates path parameters against a Zod schema
 * @param {object} pathParameters - Path parameters from API Gateway event
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {object} Validation result with success flag, data or errorResponse
 */
const validatePathParameters = (pathParameters, schema) => {
  try {
    const validatedData = schema.parse(pathParameters || {});

    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      return {
        success: false,
        errorResponse: {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Invalid path parameters',
            errors: formattedErrors
          })
        }
      };
    }

    return {
      success: false,
      errorResponse: {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Path parameter validation error',
          error: error.message
        })
      }
    };
  }
};

/**
 * Validates query parameters against a Zod schema
 * @param {object} queryStringParameters - Query parameters from API Gateway event
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {object} Validation result with success flag, data or errorResponse
 */
const validateQueryParameters = (queryStringParameters, schema) => {
  try {
    const validatedData = schema.parse(queryStringParameters || {});

    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      return {
        success: false,
        errorResponse: {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Invalid query parameters',
            errors: formattedErrors
          })
        }
      };
    }

    return {
      success: false,
      errorResponse: {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Query parameter validation error',
          error: error.message
        })
      }
    };
  }
};

/**
 * Validates partial data against a schema (useful for PATCH operations)
 * Uses Zod's .partial() to make all fields optional
 * @param {string|object} body - Request body
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {object} Validation result
 */
const validatePartialRequest = (body, schema) => {
  try {
    const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
    const partialSchema = schema.partial();
    const validatedData = partialSchema.parse(parsedBody);

    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      return {
        success: false,
        errorResponse: {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Validation failed',
            errors: formattedErrors
          })
        }
      };
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        errorResponse: {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Invalid JSON in request body',
            error: error.message
          })
        }
      };
    }

    return {
      success: false,
      errorResponse: {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Validation error',
          error: error.message
        })
      }
    };
  }
};

module.exports = {
  validateRequest,
  validatePathParameters,
  validateQueryParameters,
  validatePartialRequest
};
