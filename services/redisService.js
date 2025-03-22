/**
 * Redis Service for caching and data storage
 */
import { createClient } from 'redis';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize and connect to Redis
   */
  async connect() {
    try {
      this.client = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
        },
        password: config.redis.password,
      });

      this.client.on('error', (err) => {
        logger.error(`Redis error: ${err}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        logger.info('Reconnecting to Redis');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get value from Redis
   * @param {string} key - The key to get
   * @returns {Promise<string|null>} The value or null if not found
   */
  async get(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Redis get error: ${error.message}`);
      return null;
    }
  }

  /**
   * Set value in Redis
   * @param {string} key - The key to set
   * @param {string} value - The value to set
   * @param {number} [expiry] - Optional expiry time in seconds
   * @returns {Promise<boolean>} Success or failure
   */
  async set(key, value, expiry = null) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      if (expiry) {
        await this.client.set(key, value, { EX: expiry });
      } else {
        await this.client.set(key, value);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis set error: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete a key from Redis
   * @param {string} key - The key to delete
   * @returns {Promise<boolean>} Success or failure
   */
  async del(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis delete error: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if Redis is connected
   * @returns {boolean} Connection status
   */
  isReady() {
    return this.isConnected;
  }

  /**
   * Close the Redis connection
   */
  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

// Create and export a singleton instance
const redisService = new RedisService();
export default redisService;