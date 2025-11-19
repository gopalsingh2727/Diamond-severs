const { cache } = require('../config/redis/redis');

/**
 * Enhanced Logger with structured logging
 */
class Logger {
  constructor(context = {}) {
    this.context = context;
    this.requestId = context.requestId || this.generateRequestId();
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format log message with metadata
   */
  formatLog(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      requestId: this.requestId,
      message,
      ...this.context,
      ...meta,
    };
  }

  /**
   * Log to CloudWatch (console.log in Lambda goes to CloudWatch)
   */
  log(level, message, meta = {}) {
    const logData = this.formatLog(level, message, meta);

    if (level === 'error') {
      console.error(JSON.stringify(logData));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logData));
    } else {
      console.log(JSON.stringify(logData));
    }

    // Track errors in Redis for monitoring
    if (level === 'error' && meta.error) {
      this.trackError(meta.error);
    }
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }

  /**
   * Track API performance metrics
   */
  async trackMetric(metricName, value, unit = 'Count') {
    try {
      const key = `metric:${metricName}:${new Date().toISOString().split('T')[0]}`;
      await cache.incr(key);
      await cache.expire(key, 7 * 24 * 60 * 60); // Keep for 7 days
    } catch (error) {
      // Silent fail for metrics
    }
  }

  /**
   * Track errors for monitoring
   */
  async trackError(error) {
    try {
      const errorKey = `errors:${new Date().toISOString().split('T')[0]}`;
      const errorData = {
        message: error.message || error,
        stack: error.stack,
        timestamp: Date.now(),
        requestId: this.requestId,
      };

      await cache.hset(errorKey, this.requestId, errorData);
      await cache.expire(errorKey, 7 * 24 * 60 * 60); // Keep for 7 days
    } catch (err) {
      // Silent fail for error tracking
    }
  }

  /**
   * Log API request
   */
  logRequest(event) {
    const { httpMethod, path, headers } = event;
    this.info('API Request', {
      method: httpMethod,
      path,
      userAgent: headers?.['User-Agent'] || headers?.['user-agent'],
      ip: headers?.['X-Forwarded-For'] || headers?.['x-forwarded-for'],
    });
  }

  /**
   * Log API response
   */
  logResponse(statusCode, duration) {
    this.info('API Response', {
      statusCode,
      duration: `${duration}ms`,
    });
  }
}

/**
 * Create logger middleware for Lambda handlers
 */
const createLogger = (context = {}) => {
  return new Logger(context);
};

/**
 * Lambda handler wrapper with logging
 */
const withLogger = (handler) => {
  return async (event, context) => {
    const startTime = Date.now();
    const requestId = context.requestId || `req_${Date.now()}`;

    const logger = new Logger({
      requestId,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
    });

    // Log request
    logger.logRequest(event);

    try {
      // Execute handler
      const result = await handler(event, context, logger);

      // Log response
      const duration = Date.now() - startTime;
      logger.logResponse(result.statusCode, duration);

      // Track metrics
      await logger.trackMetric('api_request_count');
      await logger.trackMetric(`api_${result.statusCode}`);

      return result;
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      logger.error('Handler Error', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`,
      });

      // Track error metric
      await logger.trackMetric('api_error_count');

      // Return error response
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Internal server error',
          requestId,
          error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        }),
      };
    }
  };
};

/**
 * Performance monitoring decorator
 */
const measurePerformance = async (operationName, fn, logger) => {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    if (logger) {
      logger.debug(`${operationName} completed`, { duration: `${duration}ms` });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (logger) {
      logger.error(`${operationName} failed`, {
        duration: `${duration}ms`,
        error: error.message,
      });
    }

    throw error;
  }
};

/**
 * Track user activity
 */
const trackUserActivity = async (userId, activity, metadata = {}) => {
  try {
    const key = `user_activity:${userId}`;
    const activityData = {
      activity,
      timestamp: Date.now(),
      ...metadata,
    };

    await cache.hset(key, activity, activityData);
    await cache.expire(key, 30 * 24 * 60 * 60); // Keep for 30 days
  } catch (error) {
    // Silent fail
  }
};

module.exports = {
  Logger,
  createLogger,
  withLogger,
  measurePerformance,
  trackUserActivity,
};