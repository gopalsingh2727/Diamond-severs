const jwt = require('jsonwebtoken');
const { z } = require('zod');

// ============================================================================
// CONSTANTS
// ============================================================================

const API_KEY = process.env.API_KEY || '27infinity.in_5f84c89315f74a2db149c06a93cf4820';
const JWT_SECRET = process.env.JWT_SECRET || 'yourSecr33232';

// Rate limiting storage (in-memory for Lambda, consider DynamoDB/Redis for production)
const rateLimitStore = new Map();

// Rate limit configuration
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  message: 'Too many requests. Please wait before sending more messages.'
};

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize string input to prevent XSS attacks
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;')
    // Remove potential script injections
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }

  return obj;
};

/**
 * Validate and sanitize chat message
 */
const sanitizeChatMessage = (message) => {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message format');
  }

  // Max message length
  if (message.length > 5000) {
    throw new Error('Message too long. Maximum 5000 characters allowed.');
  }

  // Sanitize
  const sanitized = sanitizeString(message);

  // Check for empty message after sanitization
  if (!sanitized.trim()) {
    throw new Error('Message cannot be empty');
  }

  return sanitized;
};

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check rate limit for user
 */
const checkRateLimit = (userId) => {
  const now = Date.now();
  const key = `chat:${userId}`;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT.windowMs) {
    // Reset window
    entry = {
      windowStart: now,
      count: 0
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  // Clean old entries periodically
  if (rateLimitStore.size > 10000) {
    const cutoff = now - RATE_LIMIT.windowMs;
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.windowStart < cutoff) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (entry.count > RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + RATE_LIMIT.windowMs,
      message: RATE_LIMIT.message
    };
  }

  return {
    allowed: true,
    remaining: RATE_LIMIT.maxRequests - entry.count,
    resetAt: entry.windowStart + RATE_LIMIT.windowMs
  };
};

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

/**
 * Verify API key
 */
const verifyApiKey = (event) => {
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];

  if (!apiKey || apiKey !== API_KEY) {
    return {
      valid: false,
      error: 'Invalid or missing API key'
    };
  }

  return { valid: true };
};

/**
 * Verify JWT token and extract user info
 */
const verifyToken = (event) => {
  const authHeader = event.headers['Authorization'] || event.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Missing or invalid authorization header'
    };
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    return {
      valid: true,
      user: {
        userId: decoded.id || decoded.userId || decoded._id,
        userRole: (decoded.role || decoded.userRole || 'manager').toLowerCase(),
        branchId: decoded.branchId,
        product27InfinityId: decoded.product27InfinityId,
        email: decoded.email,
        username: decoded.username
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error.name === 'TokenExpiredError'
        ? 'Token has expired. Please login again.'
        : 'Invalid token'
    };
  }
};

/**
 * Verify user has access to specific branch (role-based)
 */
const verifyBranchAccess = (user, targetBranchId) => {
  // Master admin can access all branches
  if (user.userRole === 'master-admin') {
    return { allowed: true };
  }

  // Admin can access their product's branches
  if (user.userRole === 'admin') {
    // Admin's branch access is determined by product27InfinityId
    return { allowed: true }; // Will be filtered by product27InfinityId in queries
  }

  // Manager can only access their own branch
  if (user.userRole === 'manager') {
    if (!user.branchId) {
      return {
        allowed: false,
        error: 'Manager has no branch assigned'
      };
    }

    if (targetBranchId && user.branchId.toString() !== targetBranchId.toString()) {
      return {
        allowed: false,
        error: 'You do not have access to this branch'
      };
    }

    return { allowed: true };
  }

  return {
    allowed: false,
    error: 'Unknown user role'
  };
};

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

/**
 * Validate request body against Zod schema
 */
const validateRequest = (body, schema) => {
  try {
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return {
        valid: false,
        errors
      };
    }

    return {
      valid: true,
      data: result.data
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Invalid request format' }]
    };
  }
};

// ============================================================================
// SECURITY MIDDLEWARE WRAPPER
// ============================================================================

/**
 * Security middleware that wraps handlers
 */
const withSecurity = (options = {}) => {
  const {
    requireAuth = true,
    rateLimit = true,
    sanitize = true,
    allowedRoles = ['manager', 'admin', 'master-admin']
  } = options;

  return (handler) => {
    return async (event, context) => {
      try {
        // 1. Verify API key
        const apiKeyCheck = verifyApiKey(event);
        if (!apiKeyCheck.valid) {
          return {
            statusCode: 401,
            headers: getCorsHeaders(),
            body: JSON.stringify({
              success: false,
              message: apiKeyCheck.error
            })
          };
        }

        // 2. Verify JWT token
        let user = null;
        if (requireAuth) {
          const tokenCheck = verifyToken(event);
          if (!tokenCheck.valid) {
            return {
              statusCode: 401,
              headers: getCorsHeaders(),
              body: JSON.stringify({
                success: false,
                message: tokenCheck.error
              })
            };
          }
          user = tokenCheck.user;

          // Check role authorization
          if (!allowedRoles.includes(user.userRole)) {
            return {
              statusCode: 403,
              headers: getCorsHeaders(),
              body: JSON.stringify({
                success: false,
                message: 'You do not have permission to access this resource'
              })
            };
          }
        }

        // 3. Check rate limit
        if (rateLimit && user) {
          const rateLimitCheck = checkRateLimit(user.userId);
          if (!rateLimitCheck.allowed) {
            return {
              statusCode: 429,
              headers: {
                ...getCorsHeaders(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': rateLimitCheck.resetAt.toString()
              },
              body: JSON.stringify({
                success: false,
                message: rateLimitCheck.message
              })
            };
          }
        }

        // 4. Parse and sanitize request body
        let body = {};
        if (event.body) {
          try {
            body = JSON.parse(event.body);
            if (sanitize) {
              body = sanitizeObject(body);
            }
          } catch (error) {
            return {
              statusCode: 400,
              headers: getCorsHeaders(),
              body: JSON.stringify({
                success: false,
                message: 'Invalid JSON in request body'
              })
            };
          }
        }

        // 5. Call handler with enriched event
        const enrichedEvent = {
          ...event,
          body: JSON.stringify(body),
          parsedBody: body,
          user,
          security: {
            apiKeyVerified: true,
            tokenVerified: requireAuth,
            rateLimitRemaining: rateLimit ? checkRateLimit(user?.userId || 'anonymous').remaining : null
          }
        };

        return await handler(enrichedEvent, context);

      } catch (error) {
        console.error('Security middleware error:', error);

        return {
          statusCode: 500,
          headers: getCorsHeaders(),
          body: JSON.stringify({
            success: false,
            message: 'Security validation error'
          })
        };
      }
    };
  };
};

// ============================================================================
// CORS HEADERS
// ============================================================================

const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
});

// ============================================================================
// CHAT-SPECIFIC SECURITY
// ============================================================================

/**
 * Build role-based query filter
 */
const buildRoleBasedFilter = (user) => {
  const filter = {};

  switch (user.userRole) {
    case 'manager':
      // Manager only sees their branch data
      if (user.branchId) {
        filter.branchId = user.branchId;
      }
      break;

    case 'admin':
      // Admin sees their product27infinity data
      if (user.product27InfinityId) {
        filter.product27InfinityId = user.product27InfinityId;
      }
      break;

    case 'master-admin':
      // Master admin sees all - no filter
      break;

    default:
      // Unknown role - restrict to nothing
      filter._id = null;
  }

  return filter;
};

/**
 * Check if query contains potential injection
 */
const checkQueryInjection = (query) => {
  if (typeof query !== 'string') return false;

  const dangerousPatterns = [
    /\$where/i,
    /\$regex.*\.\*/i,
    /\{\s*\$gt\s*:\s*""\s*\}/i,
    /\{\s*\$ne\s*:\s*null\s*\}/i,
    /mapReduce/i,
    /\$function/i
  ];

  return dangerousPatterns.some(pattern => pattern.test(query));
};

// ============================================================================
// RULES & REGULATIONS
// ============================================================================

const CHAT_RULES = {
  allowed: [
    'Query orders, machines, and operators',
    'View analytics and reports',
    'Set and manage reminders',
    'Search customers and materials',
    'Get branch-specific information'
  ],
  notAllowed: [
    'Delete orders or critical data',
    'Access other branches (for managers)',
    'View sensitive financial data',
    'Change user permissions',
    'Make payments or transactions'
  ],
  dataPolicy: {
    chatHistory: '7 days',
    reminders: 'Permanent until completed',
    minimumRAM: '3 GB'
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Sanitization
  sanitizeString,
  sanitizeObject,
  sanitizeChatMessage,

  // Rate limiting
  checkRateLimit,

  // Authentication
  verifyApiKey,
  verifyToken,
  verifyBranchAccess,

  // Validation
  validateRequest,

  // Middleware
  withSecurity,

  // Helpers
  getCorsHeaders,
  buildRoleBasedFilter,
  checkQueryInjection,

  // Constants
  CHAT_RULES,
  RATE_LIMIT
};
