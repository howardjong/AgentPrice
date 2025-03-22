import { createClient } from 'redis';
import logger from '../utils/logger.js';

class RedisClient {
  constructor() {
    this.client = null;
    this.healthCheckInterval = null;
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  }

  connect() {
    try {
      const client = createClient({
        url: this.redisUrl,
        maxRetriesPerRequest: 3,
        disableOfflineQueue: true
      });

      client.on('connect', () => {
        logger.info('Redis client connected');
      });

      client.on('error', (error) => {
        logger.error('Redis client error', { error: error.message });
      });

      client.on('close', () => {
        logger.warn('Redis connection closed');
      });

      this.client = client;
      this.startHealthCheck();
      return client;
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error: error.message });
      throw error;
    }
  }

  getClient() {
    if (!this.client) {
      this.connect();
    }
    return this.client;
  }

  async ping() {
    try {
      await this.getClient().ping();
      return true;
    } catch (error) {
      logger.error('Redis ping failed', { error: error.message });
      return false;
    }
  }

  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.ping();

      if (!isHealthy) {
        logger.warn('Redis health check failed, attempting reconnection');
        await this.reconnect();
      }
    }, 30000); // Check every 30 seconds
  }

  async reconnect() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        logger.error('Error closing Redis connection', { error: error.message });
      }
      this.client = null;
    }

    try {
      await this.connect();
      logger.info('Redis reconnection successful');
    } catch (error) {
      logger.error('Redis reconnection failed', { error: error.message });
    }
  }

  async stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.client) {
      try {
        await this.client.quit();
        this.client = null;
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', { error: error.message });
      }
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;