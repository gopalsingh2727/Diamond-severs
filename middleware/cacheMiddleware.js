const { cache } = require('../config/redis/redis');
const crypto = require('crypto');

/**
 * Generate cache key from event
 */
const generateCacheKey = (prefix, event) => {
  const path = event.path || event.rawPath;
  const queryString = event.queryStringParameters
    ? JSON.stringify(event.queryStringParameters)
    : '';
  const userId = event.requestContext?.authorizer?.userId || 'anonymous';

  const keyData = `${path}:${queryString}:${userId}`;
  const hash = crypto.createHash('md5').update(keyData).digest('hex');

  return `${prefix}:${hash}`;
};

/**
 * Cache middleware wrapper
 */
const withCache = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyPrefix = 'api',
    shouldCache = () => true,
    vary = [], // Additional fields to vary cache by
  } = options;

  return (handler) => {
    return async (event, context, logger) => {
      // Only cache GET requests
      if (event.httpMethod !== 'GET') {
        return handler(event, context, logger);
      }

      // Check if should cache
      if (!shouldCache(event)) {
        return handler(event, context, logger);
      }

      // Generate cache key
      const cacheKey = generateCacheKey(keyPrefix, event);

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        if (logger) {
          logger.info('Cache HIT', { cacheKey });
        }

        return {
          ...cached,
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT',
          },
        };
      }

      // Cache MISS - execute handler
      if (logger) {
        logger.info('Cache MISS', { cacheKey });
      }

      const result = await handler(event, context, logger);

      // Cache successful responses
      if (result.statusCode === 200) {
        await cache.set(cacheKey, result, ttl);
      }

      return {
        ...result,
        headers: {
          ...result.headers,
          'X-Cache': 'MISS',
        },
      };
    };
  };
};

/**
 * Invalidate cache by pattern
 */
const invalidateCache = async (pattern) => {
  await cache.delPattern(`${pattern}*`);
};

/**
 * Invalidate cache for specific resource
 */
const invalidateResourceCache = async (resourceType, resourceId) => {
  const patterns = [
    `api:*${resourceType}*`,
    `api:*${resourceId}*`,
  ];

  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
};

/**
 * Cache frequently accessed data helper
 */
const cacheWrapper = {
  /**
   * Get branches with cache
   */
  async getBranches(branchId = null) {
    const key = branchId ? `branches:${branchId}` : 'branches:all';
    return cache.getOrSet(key, async () => {
      const Branch = require('../models/branch/branch');
      if (branchId) {
        return await Branch.findById(branchId).lean();
      }
      return await Branch.find().lean();
    }, 3600); // Cache for 1 hour
  },

  /**
   * Get machine types with cache
   */
  async getMachineTypes(branchId = null) {
    const key = branchId ? `machine_types:${branchId}` : 'machine_types:all';
    return cache.getOrSet(key, async () => {
      const MachineType = require('../models/machineType/machineType');
      const filter = branchId ? { branchId } : {};
      return await MachineType.find(filter).lean();
    }, 1800); // Cache for 30 minutes
  },

  /**
   * Get product types with cache
   */
  async getProductTypes(branchId = null) {
    const key = branchId ? `product_types:${branchId}` : 'product_types:all';
    return cache.getOrSet(key, async () => {
      const ProductType = require('../models/ProductCatalogue/productType');
      const filter = branchId ? { branchId } : {};
      return await ProductType.find(filter).lean();
    }, 1800); // Cache for 30 minutes
  },

  /**
   * Get material types with cache
   */
  async getMaterialTypes(branchId = null) {
    const key = branchId ? `material_types:${branchId}` : 'material_types:all';
    return cache.getOrSet(key, async () => {
      const MaterialType = require('../models/MaterialType/materialType');
      const filter = branchId ? { branchId } : {};
      return await MaterialType.find(filter).lean();
    }, 1800); // Cache for 30 minutes
  },

  /**
   * Get operators with cache
   */
  async getOperators(branchId) {
    const key = `operators:${branchId}`;
    return cache.getOrSet(key, async () => {
      const Operator = require('../models/MachineOperator/MachineOperator');
      return await Operator.find({ branchId }).lean();
    }, 600); // Cache for 10 minutes
  },

  /**
   * Get machines with cache
   */
  async getMachines(branchId = null) {
    const key = branchId ? `machines:${branchId}` : 'machines:all';
    return cache.getOrSet(key, async () => {
      const Machine = require('../models/machine/machine');
      const filter = branchId ? { branchId } : {};
      return await Machine.find(filter).lean();
    }, 600); // Cache for 10 minutes
  },

  /**
   * Get device access with cache
   */
  async getDeviceAccess(deviceId) {
    const key = `device_access:${deviceId}`;
    return cache.getOrSet(key, async () => {
      const DeviceAccess = require('../models/deviceAccess/deviceAccess');
      return await DeviceAccess.findOne({ deviceId }).lean();
    }, 1800); // Cache for 30 minutes
  },
};

/**
 * Cache invalidation hooks for mutations
 */
const cacheInvalidationHooks = {
  afterBranchUpdate: async (branchId) => {
    await invalidateResourceCache('branch', branchId);
    await cache.del('branches:all');
  },

  afterMachineUpdate: async (machineId, branchId) => {
    await invalidateResourceCache('machine', machineId);
    await cache.del(`machines:${branchId}`);
    await cache.del('machines:all');
  },

  afterOperatorUpdate: async (operatorId, branchId) => {
    await cache.del(`operators:${branchId}`);
  },

  afterOrderUpdate: async (orderId, branchId) => {
    await invalidateResourceCache('order', orderId);
    await cache.delPattern(`orders:${branchId}*`);
  },

  afterProductTypeUpdate: async (productTypeId, branchId) => {
    await cache.del(`product_types:${branchId}`);
    await cache.del('product_types:all');
  },

  afterMaterialTypeUpdate: async (materialTypeId, branchId) => {
    await cache.del(`material_types:${branchId}`);
    await cache.del('material_types:all');
  },
};

module.exports = {
  withCache,
  invalidateCache,
  invalidateResourceCache,
  cacheWrapper,
  cacheInvalidationHooks,
};