import { createClient } from 'redis';
import logger from '../utils/logger.js';

// In-memory store for fallback mode
class InMemoryStore {
  constructor() {
    this.store = new Map();
    this.pubsub = new Map();
    logger.info('Using in-memory Redis store fallback');
  }

  async connect() {
    return this;
  }

  async ping() {
    return 'PONG';
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    
    const { value, expiry } = item;
    if (expiry && expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return value;
  }

  async set(key, value, options = {}) {
    let expiry = null;
    if (options.EX) {
      expiry = Date.now() + (options.EX * 1000);
    }
    this.store.set(key, { value, expiry });
    return 'OK';
  }

  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }

  async hSet(key, field, value) {
    const hash = this.store.get(key) || { value: new Map(), expiry: null };
    hash.value.set(field, value);
    this.store.set(key, hash);
    return 1;
  }

  async hGet(key, field) {
    const hash = this.store.get(key);
    if (!hash) return null;
    
    return hash.value.get(field);
  }

  async hGetAll(key) {
    const hash = this.store.get(key);
    if (!hash) return {};
    
    const result = {};
    hash.value.forEach((value, field) => {
      result[field] = value;
    });
    
    return result;
  }

  async quit() {
    this.store.clear();
    this.pubsub.clear();
    return 'OK';
  }

  on(event, callback) {
    logger.info(`Registered event handler for: ${event}`);
    if (event === 'connect') {
      // Execute the connect callback immediately
      setTimeout(callback, 0);
    }
    return this;
  }
}

class RedisClient {
  constructor() {
    this.client = null;
    this.healthCheckInterval = null;
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.useInMemoryStore = process.env.REDIS_MODE === 'memory' || false;
  }

  connect() {
    try {
      if (this.useInMemoryStore) {
        logger.info('Using in-memory Redis store');
        this.client = new InMemoryStore();
        return this.client;
      }

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
        
        // If connection fails, fallback to in-memory store
        if (!this.client || !(this.client instanceof InMemoryStore)) {
          logger.info('Falling back to in-memory Redis store');
          this.useInMemoryStore = true;
          this.client = new InMemoryStore();
        }
      });

      client.on('close', () => {
        logger.warn('Redis connection closed');
      });

      this.client = client;
      this.startHealthCheck();
      return client;
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error: error.message });
      
      // If initialization fails, fallback to in-memory store
      logger.info('Falling back to in-memory Redis store');
      this.useInMemoryStore = true;
      this.client = new InMemoryStore();
      return this.client;
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
      const result = await this.getClient().ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error: error.message });
      
      // If ping fails and we're not already using in-memory store, fallback
      if (!this.useInMemoryStore) {
        logger.info('Falling back to in-memory Redis store');
        this.useInMemoryStore = true;
        this.client = new InMemoryStore();
        return true;
      }
      
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