const Redis = require('ioredis');

let redisClient = null;

/**
 * Get or create Redis client instance (Singleton pattern)
 */
const getRedisClient = () => {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    };

    // Use Redis Cluster if configured
    if (process.env.REDIS_CLUSTER_ENDPOINTS) {
      const clusterEndpoints = process.env.REDIS_CLUSTER_ENDPOINTS.split(',').map(endpoint => {
        const [host, port] = endpoint.split(':');
        return { host, port: parseInt(port) };
      });

      redisClient = new Redis.Cluster(clusterEndpoints, {
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
        },
      });
    } else {
      redisClient = new Redis(redisConfig);
    }

    // Event listeners
    redisClient.on('connect', () => {
      console.log('✅ Redis client connected');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis client error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('⚠️  Redis client connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis client reconnecting...');
    });

    return redisClient;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    return null;
  }
};

/**
 * Connect to Redis
 */
const connectRedis = async () => {
  const client = getRedisClient();
  if (!client) {
    console.warn('⚠️  Redis not configured, caching disabled');
    return null;
  }

  try {
    if (client.status !== 'ready') {
      await client.connect();
    }
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    return null;
  }
};

/**
 * Disconnect from Redis
 */
const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

/**
 * Check if Redis is available
 */
const isRedisAvailable = () => {
  return redisClient && redisClient.status === 'ready';
};

/**
 * Cache wrapper with fallback
 */
const cache = {
  /**
   * Get value from cache
   */
  async get(key) {
    if (!isRedisAvailable()) return null;
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  /**
   * Set value in cache with TTL (in seconds)
   */
  async set(key, value, ttl = 3600) {
    if (!isRedisAvailable()) return false;
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redisClient.setex(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  /**
   * Delete key from cache
   */
  async del(key) {
    if (!isRedisAvailable()) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern) {
    if (!isRedisAvailable()) return false;
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Redis DEL PATTERN error:', error);
      return false;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!isRedisAvailable()) return false;
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  },

  /**
   * Set expiration on key
   */
  async expire(key, seconds) {
    if (!isRedisAvailable()) return false;
    try {
      await redisClient.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  },

  /**
   * Get multiple keys
   */
  async mget(keys) {
    if (!isRedisAvailable() || !keys.length) return [];
    try {
      const values = await redisClient.mget(...keys);
      return values.map(v => (v ? JSON.parse(v) : null));
    } catch (error) {
      console.error('Redis MGET error:', error);
      return [];
    }
  },

  /**
   * Increment counter
   */
  async incr(key) {
    if (!isRedisAvailable()) return null;
    try {
      return await redisClient.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
      return null;
    }
  },

  /**
   * Hash operations
   */
  async hset(key, field, value) {
    if (!isRedisAvailable()) return false;
    try {
      await redisClient.hset(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis HSET error:', error);
      return false;
    }
  },

  async hget(key, field) {
    if (!isRedisAvailable()) return null;
    try {
      const value = await redisClient.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis HGET error:', error);
      return null;
    }
  },

  async hgetall(key) {
    if (!isRedisAvailable()) return null;
    try {
      const hash = await redisClient.hgetall(key);
      const parsed = {};
      for (const [field, value] of Object.entries(hash)) {
        parsed[field] = JSON.parse(value);
      }
      return parsed;
    } catch (error) {
      console.error('Redis HGETALL error:', error);
      return null;
    }
  },

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet(key, fetchFn, ttl = 3600) {
    // Try to get from cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFn();

    // Store in cache
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttl);
    }

    return value;
  },
};

module.exports = {
  getRedisClient,
  connectRedis,
  disconnectRedis,
  isRedisAvailable,
  cache,
};