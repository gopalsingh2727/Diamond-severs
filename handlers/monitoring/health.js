const { isRedisAvailable, cache } = require('../../config/redis/redis');
const mongoose = require('mongoose');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

/**
 * Basic health check endpoint
 * GET /health
 */
module.exports.healthCheck = async (event) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'this27-backend',
    version: process.env.VERSION || '1.0.0',
  };

  return respond(200, health);
};

/**
 * Detailed health check with dependencies
 * GET /health/detailed
 */
module.exports.healthCheckDetailed = async (event) => {
  const checks = {
    mongodb: 'unknown',
    redis: 'unknown',
  };

  let overallStatus = 'healthy';

  // Check MongoDB
  try {
    if (mongoose.connection.readyState === 1) {
      checks.mongodb = 'healthy';
    } else {
      checks.mongodb = 'unhealthy';
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.mongodb = 'unhealthy';
    overallStatus = 'unhealthy';
  }

  // Check Redis
  try {
    if (isRedisAvailable()) {
      await cache.set('health_check', { timestamp: Date.now() }, 60);
      const test = await cache.get('health_check');
      checks.redis = test ? 'healthy' : 'unhealthy';
    } else {
      checks.redis = 'unavailable';
    }
  } catch (error) {
    checks.redis = 'unhealthy';
    // Redis is optional, so don't change overall status
  }

  const health = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'this27-backend',
    version: process.env.VERSION || '1.0.0',
    checks,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return respond(statusCode, health);
};

/**
 * Get system metrics
 * GET /monitoring/metrics
 */
module.exports.getMetrics = async (event) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get metrics from Redis
    const metricKeys = [
      `metric:api_request_count:${today}`,
      `metric:api_error_count:${today}`,
      `metric:api_200:${today}`,
      `metric:api_400:${today}`,
      `metric:api_500:${today}`,
    ];

    const metrics = {};
    for (const key of metricKeys) {
      const value = await cache.get(key);
      const metricName = key.split(':')[1];
      metrics[metricName] = parseInt(value) || 0;
    }

    // Get error details
    const errorKey = `errors:${today}`;
    const errors = await cache.hgetall(errorKey);

    return respond(200, {
      date: today,
      metrics,
      errors: errors ? Object.values(errors) : [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return respond(500, {
      message: 'Failed to fetch metrics',
      error: error.message,
    });
  }
};

/**
 * Get error logs
 * GET /monitoring/errors
 */
module.exports.getErrors = async (event) => {
  try {
    const { days = 1 } = event.queryStringParameters || {};

    const errors = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get errors for each day
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const errorKey = `errors:${dateStr}`;
      const dayErrors = await cache.hgetall(errorKey);

      if (dayErrors) {
        errors.push({
          date: dateStr,
          errors: Object.values(dayErrors),
        });
      }
    }

    return respond(200, {
      errors,
      period: `${days} day(s)`,
    });
  } catch (error) {
    return respond(500, {
      message: 'Failed to fetch errors',
      error: error.message,
    });
  }
};

/**
 * Get cache statistics
 * GET /monitoring/cache/stats
 */
module.exports.getCacheStats = async (event) => {
  try {
    if (!isRedisAvailable()) {
      return respond(200, {
        status: 'unavailable',
        message: 'Redis is not configured or unavailable',
      });
    }

    // Get Redis info (basic stats)
    const stats = {
      status: 'available',
      timestamp: new Date().toISOString(),
    };

    return respond(200, stats);
  } catch (error) {
    return respond(500, {
      message: 'Failed to fetch cache stats',
      error: error.message,
    });
  }
};

/**
 * Clear cache (admin only)
 * DELETE /monitoring/cache/clear
 */
module.exports.clearCache = async (event) => {
  try {
    const { pattern = '*' } = JSON.parse(event.body || '{}');

    if (!isRedisAvailable()) {
      return respond(200, {
        message: 'Redis is not available, nothing to clear',
      });
    }

    await cache.delPattern(pattern);

    return respond(200, {
      message: `Cache cleared for pattern: ${pattern}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return respond(500, {
      message: 'Failed to clear cache',
      error: error.message,
    });
  }
};

/**
 * Get API performance stats
 * GET /monitoring/performance
 */
module.exports.getPerformanceStats = async (event) => {
  try {
    const { days = 7 } = event.queryStringParameters || {};

    const stats = {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: formatUptime(process.uptime()),
      },
      nodejs: process.version,
      platform: process.platform,
    };

    return respond(200, {
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return respond(500, {
      message: 'Failed to fetch performance stats',
      error: error.message,
    });
  }
};

/**
 * Helper to format uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}
