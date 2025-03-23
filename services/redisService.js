// Simplified Redis client implementation with in-memory fallback
import logger from '../utils/logger.js';

// In-memory store for fallback mode
export class InMemoryStore {
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

  async set(key, value, ...args) {
    // Handle different Redis set() formats:
    // set(key, value)
    // set(key, value, 'EX', seconds)
    // set(key, value, { EX: seconds })
    
    let expiry = null;
    
    if (args.length === 1 && typeof args[0] === 'object') {
      // Object options format
      const options = args[0];
      if (options.EX) {
        expiry = Date.now() + (options.EX * 1000);
      }
    } else if (args.length >= 2 && args[0] === 'EX') {
      // EX seconds format
      expiry = Date.now() + (parseInt(args[1], 10) * 1000);
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

  async keys(pattern) {
    // Very simple pattern matching: only support exact matches and * at the end
    const keys = Array.from(this.store.keys());
    
    if (pattern === '*') return keys;
    
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return keys.filter(key => key.startsWith(prefix));
    }
    
    return keys.filter(key => key === pattern);
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
    this.useInMemoryStore = process.env.REDIS_MODE === 'memory' || false;
    
    // Initialize with in-memory store immediately
    if (this.useInMemoryStore) {
      logger.info('Initializing in-memory Redis store');
      this.client = new InMemoryStore();
    }
  }

  async connect() {
    if (!this.client) {
      logger.info('Creating new in-memory Redis store');
      this.client = new InMemoryStore();
    }
    return this.client;
  }

  async getClient() {
    if (!this.client) {
      await this.connect();
    }
    return this.client;
  }

  async ping() {
    const client = await this.getClient();
    try {
      return await client.ping() === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error: error.message });
      return false;
    }
  }

  async stop() {
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