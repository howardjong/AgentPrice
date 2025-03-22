/**
 * Redis Service for caching and data storage
 */
import { createClient } from 'redis';
import logger from '../utils/logger.js';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  }

  /**
   * Initialize and connect to Redis
   */
  async connect() {
    if (this.client && this.isConnected) {
      logger.debug('Redis already connected');
      return;
    }

    try {
      logger.info('Connecting to Redis', { url: this.redisUrl.replace(/redis:\/\/.*@/, 'redis://***@') });
      
      this.client = createClient({
        url: this.redisUrl
      });

      this.client.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting');
      });

      await this.client.connect();
      this.isConnected = true;
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get value from Redis
   * @param {string} key - The key to get
   * @returns {Promise<string|null>} The value or null if not found
   */
  async get(key) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error', { key, error: error.message });
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
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      if (expiry) {
        await this.client.set(key, value, { EX: expiry });
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete a key from Redis
   * @param {string} key - The key to delete
   * @returns {Promise<boolean>} Success or failure
   */
  async del(key) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error', { key, error: error.message });
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
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', { error: error.message });
      }
    }
  }
}

const redisService = new RedisService();
export default redisService;