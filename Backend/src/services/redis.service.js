import { createClient } from 'redis';
import crypto from 'crypto';

/**
 * Redis Service for CSV/XLSX Processing Backend
 * Handles connection, caching, and utility functions for AI responses,
 * file parsing, validation results, and rule recommendations
 */

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    
    // Initialize connection
    this.init();
  }

  /**
   * Initialize Redis connection with fallback credentials
   */
  async init() {
    try {
      const redisConfig = {
        socket: {
          host: process.env.REDIS_HOST || 'redis-11409.c11.us-east-1-2.ec2.redns.redis-cloud.com',
          port: parseInt(process.env.REDIS_PORT) || 11409,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              console.warn('Redis: Maximum reconnection attempts reached');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        },
        password: process.env.REDIS_PASSWORD || 'cnO7pYFwxH7rUvwvnocnmd4jS4j1FsYJ',
        database: 0
      };

      this.client = createClient(redisConfig);
      
      // Event listeners
      this.client.on('connect', () => {
        console.log('✅ Redis: Connection established');
      });

      this.client.on('ready', () => {
        console.log('🚀 Redis: Client ready for operations');
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis: Reconnecting...');
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis: Connection closed');
        this.isConnected = false;
      });

      await this.connectRedis();
      
    } catch (error) {
      console.error('❌ Redis Service initialization failed:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Establish Redis connection with retry logic
   */
  async connectRedis() {
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.warn('⚠️ Redis: Max connection attempts reached, operating without cache');
      return false;
    }

    try {
      this.connectionAttempts++;
      await this.client.connect();
      console.log('✅ Redis: Successfully connected to Redis Cloud');
      return true;
    } catch (error) {
      console.error(`❌ Redis connection attempt ${this.connectionAttempts} failed:`, error.message);
      
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        console.log(`🔄 Retrying connection in 2 seconds... (${this.connectionAttempts}/${this.maxConnectionAttempts})`);
        setTimeout(() => this.connectRedis(), 2000);
      } else {
        console.warn('⚠️ Redis: All connection attempts failed, continuing without cache');
      }
      return false;
    }
  }

  /**
   * Check if Redis is available and connected
   */
  isAvailable() {
    return this.client && this.isConnected;
  }

  /**
   * Generate a safe cache key with namespace
   * @param {string} namespace - Cache namespace (e.g., 'ai:response', 'cache:parsed')
   * @param {string} identifier - Unique identifier for the cache entry
   * @returns {string} Formatted cache key
   */
  generateCacheKey(namespace, identifier) {
    // Create hash for long identifiers to keep keys manageable
    const hash = crypto.createHash('md5').update(identifier).digest('hex');
    return `${namespace}:${hash}`;
  }

  /**
   * Set cache with JSON serialization and TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttlInSec - Time to live in seconds (default: 600 = 10 minutes)
   * @returns {Promise<boolean>} Success status
   */
  async setCache(key, value, ttlInSec = 600) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis: Cache unavailable, skipping set operation');
      return false;
    }

    try {
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now(),
        ttl: ttlInSec
      });

      await this.client.setEx(key, ttlInSec, serializedValue);
      console.log(`✅ Redis: Cached data with key: ${key} (TTL: ${ttlInSec}s)`);
      return true;
    } catch (error) {
      console.error(`❌ Redis: Failed to set cache for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get cache with JSON deserialization
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null if not found
   */
  async getCache(key) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis: Cache unavailable, skipping get operation');
      return null;
    }

    try {
      const cachedData = await this.client.get(key);
      
      if (!cachedData) {
        console.log(`📭 Redis: Cache miss for key: ${key}`);
        return null;
      }

      const parsed = JSON.parse(cachedData);
      console.log(`📬 Redis: Cache hit for key: ${key}`);
      return parsed.data;
    } catch (error) {
      console.error(`❌ Redis: Failed to get cache for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key to delete
   * @returns {Promise<boolean>} Success status
   */
  async delCache(key) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis: Cache unavailable, skipping delete operation');
      return false;
    }

    try {
      const result = await this.client.del(key);
      if (result === 1) {
        console.log(`🗑️ Redis: Deleted cache key: ${key}`);
        return true;
      } else {
        console.log(`📭 Redis: Key not found for deletion: ${key}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Redis: Failed to delete cache for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Clear all cache entries with a specific pattern
   * @param {string} pattern - Pattern to match keys (e.g., 'ai:response:*')
   * @returns {Promise<number>} Number of deleted keys
   */
  async clearCachePattern(pattern) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis: Cache unavailable, skipping pattern clear operation');
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        console.log(`📭 Redis: No keys found matching pattern: ${pattern}`);
        return 0;
      }

      const result = await this.client.del(keys);
      console.log(`🗑️ Redis: Deleted ${result} keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      console.error(`❌ Redis: Failed to clear cache pattern ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics and health info
   * @returns {Promise<object>} Cache statistics
   */
  async getCacheStats() {
    if (!this.isAvailable()) {
      return {
        connected: false,
        error: 'Redis unavailable'
      };
    }

    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();
      
      return {
        connected: true,
        keyCount,
        memoryInfo: info,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Redis: Failed to get cache stats:', error.message);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
        console.log('👋 Redis: Gracefully disconnected');
      } catch (error) {
        console.error('❌ Redis: Error during disconnect:', error.message);
      }
    }
  }

  // Convenience methods for common cache patterns

  /**
   * Cache AI response with 24-hour TTL
   * @param {string} queryText - The query text to hash
   * @param {any} response - AI response to cache
   */
  async cacheAiResponse(queryText, response) {
    const key = this.generateCacheKey('ai:response', queryText);
    return await this.setCache(key, response, 24 * 60 * 60); // 24 hours
  }

  /**
   * Get cached AI response
   * @param {string} queryText - The query text to hash
   */
  async getCachedAiResponse(queryText) {
    const key = this.generateCacheKey('ai:response', queryText);
    return await this.getCache(key);
  }

  /**
   * Cache parsed file data with 6-hour TTL
   * @param {string} fileName - File name or hash
   * @param {any} parsedData - Parsed file data
   */
  async cacheParsedFile(fileName, parsedData) {
    const key = this.generateCacheKey('cache:parsed', fileName);
    return await this.setCache(key, parsedData, 6 * 60 * 60); // 6 hours
  }

  /**
   * Get cached parsed file data
   * @param {string} fileName - File name or hash
   */
  async getCachedParsedFile(fileName) {
    const key = this.generateCacheKey('cache:parsed', fileName);
    return await this.getCache(key);
  }

  /**
   * Cache validation results with 3-hour TTL
   * @param {string} entity - Entity identifier
   * @param {any} validationResults - Validation results
   */
  async cacheValidationResults(entity, validationResults) {
    const key = this.generateCacheKey('validate', entity);
    return await this.setCache(key, validationResults, 3 * 60 * 60); // 3 hours
  }

  /**
   * Get cached validation results
   * @param {string} entity - Entity identifier
   */
  async getCachedValidationResults(entity) {
    const key = this.generateCacheKey('validate', entity);
    return await this.getCache(key);
  }

  /**
   * Cache rule recommendations with 12-hour TTL
   * @param {string} datasetId - Dataset signature/ID
   * @param {any} rules - Rule recommendations
   */
  async cacheRuleRecommendations(datasetId, rules) {
    const key = this.generateCacheKey('ai:rules', datasetId);
    return await this.setCache(key, rules, 12 * 60 * 60); // 12 hours
  }

  /**
   * Get cached rule recommendations
   * @param {string} datasetId - Dataset signature/ID
   */
  async getCachedRuleRecommendations(datasetId) {
    const key = this.generateCacheKey('ai:rules', datasetId);
    return await this.getCache(key);
  }
}

// Create and export singleton instance
const redisService = new RedisService();

// Export individual methods for direct use
export const {
  connectRedis,
  isAvailable,
  generateCacheKey,
  setCache,
  getCache,
  delCache,
  clearCachePattern,
  getCacheStats,
  disconnect,
  cacheAiResponse,
  getCachedAiResponse,
  cacheParsedFile,
  getCachedParsedFile,
  cacheValidationResults,
  getCachedValidationResults,
  cacheRuleRecommendations,
  getCachedRuleRecommendations
} = redisService;

// Export the service instance
export default redisService;

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down Redis connection...');
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down Redis connection...');
  await redisService.disconnect();
  process.exit(0);
});