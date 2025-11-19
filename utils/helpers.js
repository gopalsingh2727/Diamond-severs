/**
 * Helper utilities for API responses and common operations
 */

const jwt = require('jsonwebtoken');

/**
 * Standard API response format
 * @param {number} statusCode - HTTP status code
 * @param {object} body - Response body
 * @returns {object} - Formatted response
 */
const respond = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
};

/**
 * Extract and verify admin from JWT token in event
 * @param {object} event - Lambda event object
 * @returns {object} - Decoded admin object
 * @throws {Error} - If token is invalid or missing
 */
const extractAdminFromEvent = (event) => {
  try {
    const token = event.headers.Authorization || event.headers.authorization;

    if (!token) {
      throw new Error('No authorization token provided');
    }

    // Remove 'Bearer ' prefix if present
    const jwtToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      isSuperAdmin: decoded.isSuperAdmin,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId
 */
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Sanitize input to prevent NoSQL injection
 * @param {*} input - Input to sanitize
 * @returns {*} - Sanitized input
 */
const sanitizeInput = (input) => {
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const key in input) {
      // Remove MongoDB operators
      if (!key.startsWith('$')) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
};

/**
 * Format date to ISO string
 * @param {Date|string} date - Date to format
 * @returns {string} - ISO formatted date string
 */
const formatDate = (date) => {
  return new Date(date).toISOString();
};

/**
 * Calculate pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {object} - Pagination metadata
 */
const getPaginationMetadata = (page, limit, total) => {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
};

/**
 * Generate random alphanumeric string
 * @param {number} length - Length of string
 * @returns {string} - Random string
 */
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Convert bytes to human-readable format
 * @param {number} bytes - Bytes to convert
 * @returns {string} - Formatted string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calculate percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @returns {string} - Percentage with 2 decimal places
 */
const calculatePercentage = (value, total) => {
  if (total === 0) return '0.00';
  return ((value / total) * 100).toFixed(2);
};

/**
 * Build MongoDB filter from query parameters
 * @param {object} params - Query parameters
 * @param {array} allowedFields - Fields that can be filtered
 * @returns {object} - MongoDB filter object
 */
const buildFilter = (params, allowedFields = []) => {
  const filter = {};

  allowedFields.forEach((field) => {
    if (params[field] !== undefined) {
      filter[field] = params[field];
    }
  });

  // Handle date range
  if (params.startDate || params.endDate) {
    const dateField = params.dateField || 'createdAt';
    filter[dateField] = {};

    if (params.startDate) {
      filter[dateField].$gte = new Date(params.startDate);
    }
    if (params.endDate) {
      filter[dateField].$lte = new Date(params.endDate);
    }
  }

  // Handle search
  if (params.search && params.searchFields) {
    const searchFields = params.searchFields.split(',');
    filter.$or = searchFields.map((field) => ({
      [field]: { $regex: params.search, $options: 'i' },
    }));
  }

  return filter;
};

/**
 * Handle async errors in Lambda functions
 * @param {function} fn - Async function to wrap
 * @returns {function} - Wrapped function with error handling
 */
const asyncHandler = (fn) => {
  return async (event, context, logger) => {
    try {
      return await fn(event, context, logger);
    } catch (error) {
      if (logger) {
        logger.error('Unhandled error', { error: error.message, stack: error.stack });
      } else {
        console.error('Unhandled error:', error);
      }

      return respond(500, {
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  };
};

/**
 * Validate required fields in request body
 * @param {object} body - Request body
 * @param {array} requiredFields - Array of required field names
 * @throws {Error} - If any required field is missing
 */
const validateRequiredFields = (body, requiredFields) => {
  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
};

module.exports = {
  respond,
  extractAdminFromEvent,
  isValidObjectId,
  sanitizeInput,
  formatDate,
  getPaginationMetadata,
  generateRandomString,
  formatBytes,
  calculatePercentage,
  buildFilter,
  asyncHandler,
  validateRequiredFields,
};
