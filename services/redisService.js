// Redis client implementation with in-memory fallback and Redis Memory Server option
import logger from '../utils/logger.js';
import Redis from 'ioredis';
import { RedisMemoryServer } from 'redis-memory-server';

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
    this.redisServer = null;
    this.redisUrl = null;
    this.logger = logger;
    
    // Get Redis mode from environment variable
    // Make this a static property so it can be accessed without creating a new instance
    // This is important for avoiding circular dependencies when other modules need to check the mode
    RedisClient.redisMode = process.env.REDIS_MODE || 'memory'; // Default to memory if not specified
    
    // Instance property for internal use
    this.redisMode = RedisClient.redisMode;
    
    // Log Redis mode for debugging
    logger.info(`Redis client initialized with REDIS_MODE=${this.redisMode}`);
    
    // Initialize based on redisMode
    this.useInMemoryStore = this.redisMode === 'memory';
    this.useRedisMemoryServer = this.redisMode === 'real';
    
    // Initialize with in-memory store immediately if set to memory mode
    if (this.useInMemoryStore) {
      logger.info('Initializing in-memory Redis store');
      this.client = new InMemoryStore();
    }
  }
  
  // Static getter to allow other modules to access the Redis mode without circular dependencies
  static get redisMode() {
    return RedisClient.redisMode || process.env.REDIS_MODE || 'memory';
  }
  
  /**
   * Get the Redis URL for connecting to the Redis server
   * This method is used by other services like Bull queues to get the Redis connection URL
   * @returns {Promise<string>} - The Redis URL
   */
  async getRedisUrl() {
    // Log current state for debugging
    logger.info(`getRedisUrl: redisMode=${this.redisMode}, useRedisMemoryServer=${this.useRedisMemoryServer}, useInMemoryStore=${this.useInMemoryStore}`);
    
    // If we already have a Redis URL, return it
    if (this.redisUrl) {
      logger.info(`Using cached Redis URL: ${this.redisUrl}`);
      return this.redisUrl;
    }
    
    // If using 'real' REDIS_MODE, start a Redis Memory Server 
    // This allows us to use a real Redis server in memory for testing
    if (this.redisMode === 'real') {
      logger.info('REDIS_MODE=real: Starting Redis Memory Server');
      
      // If we don't have a Redis Memory Server yet, start one
      if (!this.redisServer) {
        this.redisUrl = await this.startRedisMemoryServer();
        if (this.redisUrl) {
          logger.info(`Using Redis Memory Server URL: ${this.redisUrl}`);
          return this.redisUrl;
        }
      }
    }
    
    // If we're using the in-memory store (memory mode), we don't need a real Redis URL
    // But we need to return something that Bull will accept
    if (this.redisMode === 'memory') {
      logger.info('Using in-memory Redis mode - returning localhost URL for compatibility');
      return 'redis://localhost:6379';
    }
    
    // Default to environment variable or localhost
    const defaultUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    logger.info(`Using default Redis URL: ${defaultUrl}`);
    return defaultUrl;
  }

  async startRedisMemoryServer() {
    try {
      logger.info('Starting Redis Memory Server...');
      this.redisServer = new RedisMemoryServer({
        instance: {
          port: 6379, // Use the default Redis port
        }
      });
      
      // Start the Redis server
      const host = await this.redisServer.getHost();
      const port = await this.redisServer.getPort();
      
      // Build the Redis URL
      this.redisUrl = `redis://${host}:${port}`;
      
      logger.info(`Redis Memory Server started at ${host}:${port}`);
      
      // Set environment variable so other processes can use it
      process.env.REDIS_URL = this.redisUrl;
      
      // Return connection string
      return this.redisUrl;
    } catch (error) {
      logger.error(`Failed to start Redis Memory Server: ${error.message}`);
      return null;
    }
  }

  async connect() {
    // If client already exists, return it
    if (this.client) {
      return this.client;
    }
    
    // Log current state for debugging
    logger.info(`connect: redisMode=${this.redisMode}, useRedisMemoryServer=${this.useRedisMemoryServer}, useInMemoryStore=${this.useInMemoryStore}`);
    
    // Handle based on instance redisMode to ensure consistency with getRedisUrl
    if (this.redisMode === 'memory') {
      // Memory mode - use in-memory store implementation
      logger.info('redisMode=memory: Creating new in-memory Redis store');
      this.client = new InMemoryStore();
      this.useInMemoryStore = true;
    } 
    else if (this.redisMode === 'real') {
      // Real mode - use Redis Memory Server for testing without external dependency
      try {
        // Start a Redis Memory Server instance
        const redisUrl = await this.startRedisMemoryServer();
        
        if (!redisUrl) {
          logger.warn('Failed to start Redis Memory Server, falling back to in-memory store');
          this.client = new InMemoryStore();
          this.useInMemoryStore = true;
          return this.client;
        }
        
        logger.info(`Connecting to Redis Memory Server at ${redisUrl}`);
        
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            logger.info(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
            return delay;
          },
          enableReadyCheck: true,
          connectTimeout: 10000,
          keepAlive: 10000
        });
        
        // Set up event listeners
        this.client.on('connect', () => {
          logger.info('Connected to Redis Memory Server');
        });
        
        this.client.on('error', (err) => {
          logger.error(`Redis connection error: ${err.message}`);
          
          // If Redis is unavailable, fallback to in-memory
          if (!this.useInMemoryStore) {
            logger.warn('Falling back to in-memory Redis store due to connection error');
            this.client = new InMemoryStore();
            this.useInMemoryStore = true;
          }
        });
        
        // Initial connection test
        await this.client.ping();
        logger.info('Redis server is responsive');
      } catch (error) {
        logger.error(`Failed to connect to Redis: ${error.message}`);
        logger.warn('Falling back to in-memory Redis store');
        this.client = new InMemoryStore();
        this.useInMemoryStore = true;
      }
    } 
    else {
      // No mode specified or unrecognized mode - use in-memory store as default
      logger.info(`No recognized Redis mode specified (${this.redisMode}), using in-memory store`);
      this.client = new InMemoryStore();
      this.useInMemoryStore = true;
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

  async get(key, options = {}) {
    const timeout = options.timeout || 5000; // Default 5 second timeout

    try {
      const client = await this.getClient();
      return await Promise.race([
        client.get(key),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Redis GET operation timed out after ${timeout}ms`)), timeout)
        )
      ]);
    } catch (error) {
      this.logger.error(`Redis GET error: ${error.message}`, { key });
      return null;
    }
  }

  // Get with fallback value if Redis fails
  async getWithFallback(key, fallbackValue, options = {}) {
    try {
      const result = await this.get(key, options);
      return result !== null ? result : fallbackValue;
    } catch (error) {
      this.logger.warn(`Redis GET failed, using fallback for: ${key}`);
      return fallbackValue;
    }
  }

  async set(key, value, expirySecs = null, timeoutMs = 3000) {
    try {
      // Create a promise with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Redis SET operation timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      // Prepare the Redis operation
      const client = await this.getClient();
      let redisOperation;
      if (expirySecs) {
        redisOperation = client.set(key, value, 'EX', expirySecs);
      } else {
        redisOperation = client.set(key, value);
      }

      // Race between the actual operation and the timeout
      const result = await Promise.race([
        redisOperation,
        timeoutPromise
      ]);

      return result === 'OK';
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}: ${error.message}`);
      // Return false instead of throwing to make the application more resilient
      return false;
    }
  }

  async stop() {
    if (this.client) {
      try {
        await this.client.quit();
        this.client = null;
        logger.info('Redis connection closed');
        
        // Stop Redis Memory Server if it's running
        if (this.redisServer) {
          await this.redisServer.stop();
          this.redisServer = null;
          logger.info('Redis Memory Server stopped');
        }
      } catch (error) {
        logger.error('Error closing Redis connection', { error: error.message });
      }
    }
  }
}

const redisClient = new RedisClient();
export { RedisClient };
export default redisClient;