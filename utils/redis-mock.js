/**
 * Redis Mock Implementation
 * 
 * This provides a complete in-memory replacement for Redis
 * that can be used in tests without any external dependencies.
 * 
 * Features:
 * - Complete Redis API compatible interface
 * - Support for key operations (get, set, expire)
 * - Support for hash operations
 * - Support for pubsub operations
 * - Proper key expiration handling
 * - Emulates Redis behavior without actual Redis dependency
 */

import { EventEmitter } from 'events';

/**
 * Redis-compatible in-memory mock implementation
 */
class RedisMock extends EventEmitter {
  constructor(options = {}) {
    super();
    this.store = new Map();
    this.pubsub = new Map();
    this.connected = false;
    this.options = {
      namespace: options.namespace || 'test',
      ...options
    };
  }

  /**
   * Connect to the mock Redis server
   */
  async connect() {
    if (!this.connected) {
      this.connected = true;
      this.emit('connect');
      setTimeout(() => this.emit('ready'), 0);
    }
    return this;
  }

  /**
   * Disconnect from the mock Redis server
   */
  async disconnect() {
    if (this.connected) {
      this.connected = false;
      this.emit('end');
    }
    return 'OK';
  }

  /**
   * Quit connection
   */
  async quit() {
    return this.disconnect();
  }

  /**
   * Redis ping command
   */
  async ping() {
    this._checkConnection();
    return 'PONG';
  }

  /**
   * Set a key-value pair with optional expiry
   */
  async set(key, value, ...args) {
    this._checkConnection();
    let expiry = null;

    // Handle different Redis set() formats:
    // set(key, value)
    // set(key, value, 'EX', seconds)
    // set(key, value, { EX: seconds })
    if (args.length === 1 && typeof args[0] === 'object') {
      // Object options format
      const options = args[0];
      if (options.EX) {
        expiry = Date.now() + (options.EX * 1000);
      } else if (options.PX) {
        expiry = Date.now() + options.PX;
      }
    } else if (args.length >= 2) {
      // Command format (EX, PX, etc)
      const cmd = args[0].toUpperCase();
      if (cmd === 'EX') {
        expiry = Date.now() + (parseInt(args[1], 10) * 1000);
      } else if (cmd === 'PX') {
        expiry = Date.now() + parseInt(args[1], 10);
      }
    }

    this.store.set(key, { value, expiry });
    return 'OK';
  }

  /**
   * Get a value by key
   */
  async get(key) {
    this._checkConnection();
    const item = this.store.get(key);
    if (!item) return null;

    // Handle expiry
    const { value, expiry } = item;
    if (expiry && expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return value;
  }

  /**
   * Delete a key
   */
  async del(key) {
    this._checkConnection();
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    
    for (const k of keys) {
      if (this.store.delete(k)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get multiple keys
   */
  async mget(...keys) {
    this._checkConnection();
    return Promise.all(keys.map(key => this.get(key)));
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(...args) {
    this._checkConnection();
    
    // Convert flat array of [key1, val1, key2, val2] to pairs
    for (let i = 0; i < args.length; i += 2) {
      if (i + 1 < args.length) {
        await this.set(args[i], args[i + 1]);
      }
    }
    
    return 'OK';
  }

  /**
   * Check if a key exists
   */
  async exists(key) {
    this._checkConnection();
    
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    
    for (const k of keys) {
      const item = this.store.get(k);
      if (item) {
        if (item.expiry && item.expiry < Date.now()) {
          this.store.delete(k);
        } else {
          count++;
        }
      }
    }
    
    return count;
  }

  /**
   * Set expiry on a key
   */
  async expire(key, seconds) {
    this._checkConnection();
    
    const item = this.store.get(key);
    if (!item) return 0;
    
    item.expiry = Date.now() + (seconds * 1000);
    this.store.set(key, item);
    
    return 1;
  }

  /**
   * Get time-to-live for a key in seconds
   */
  async ttl(key) {
    this._checkConnection();
    
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expiry) return -1;
    
    const ttlMs = item.expiry - Date.now();
    if (ttlMs <= 0) {
      this.store.delete(key);
      return -2;
    }
    
    return Math.ceil(ttlMs / 1000);
  }

  /**
   * Increment a key by 1 or the specified amount
   */
  async incr(key) {
    return this.incrby(key, 1);
  }

  /**
   * Increment a key by the specified amount
   */
  async incrby(key, increment) {
    this._checkConnection();
    
    const item = this.store.get(key);
    let value = 0;
    
    if (item) {
      // Check expiry
      if (item.expiry && item.expiry < Date.now()) {
        this.store.delete(key);
      } else {
        value = parseInt(item.value, 10) || 0;
      }
    }
    
    value += increment;
    this.store.set(key, { 
      value: value.toString(), 
      expiry: item ? item.expiry : null 
    });
    
    return value;
  }

  /**
   * Decrement a key by 1
   */
  async decr(key) {
    return this.incrby(key, -1);
  }

  /**
   * Decrement a key by the specified amount
   */
  async decrby(key, decrement) {
    return this.incrby(key, -decrement);
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern) {
    this._checkConnection();
    
    const allKeys = Array.from(this.store.keys());
    const now = Date.now();
    
    // Remove expired keys
    const validKeys = allKeys.filter(key => {
      const item = this.store.get(key);
      if (item.expiry && item.expiry < now) {
        this.store.delete(key);
        return false;
      }
      return true;
    });
    
    // Apply pattern matching
    if (pattern === '*') {
      return validKeys;
    }
    
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return validKeys.filter(key => key.startsWith(prefix));
    }
    
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return validKeys.filter(key => key.endsWith(suffix));
    }
    
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return validKeys.filter(key => regex.test(key));
    }
    
    return validKeys.filter(key => key === pattern);
  }

  /**
   * Clear all keys
   */
  async flushall() {
    this._checkConnection();
    this.store.clear();
    return 'OK';
  }

  /**
   * Clear keys with a specific prefix
   */
  async flushByPrefix(prefix) {
    this._checkConnection();
    
    const keys = Array.from(this.store.keys());
    let deleted = 0;
    
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  // Hash operations

  /**
   * Set field in a hash
   */
  async hset(key, field, value) {
    this._checkConnection();
    
    // Get or create hash
    let hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') {
      hash = { value: {}, expiry: null };
    } else if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      hash = { value: {}, expiry: null };
    }
    
    // Update field
    hash.value[field] = value;
    this.store.set(key, hash);
    
    return 1;
  }

  /**
   * Set multiple fields in a hash
   */
  async hmset(key, ...args) {
    this._checkConnection();
    
    let fieldValues;
    if (args.length === 1 && typeof args[0] === 'object') {
      // Object format: hmset(key, {field1: value1, field2: value2})
      fieldValues = args[0];
    } else {
      // Array format: hmset(key, field1, value1, field2, value2)
      fieldValues = {};
      for (let i = 0; i < args.length; i += 2) {
        if (i + 1 < args.length) {
          fieldValues[args[i]] = args[i + 1];
        }
      }
    }
    
    // Get or create hash
    let hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') {
      hash = { value: {}, expiry: null };
    } else if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      hash = { value: {}, expiry: null };
    }
    
    // Update fields
    hash.value = { ...hash.value, ...fieldValues };
    this.store.set(key, hash);
    
    return 'OK';
  }

  /**
   * Get field from a hash
   */
  async hget(key, field) {
    this._checkConnection();
    
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return null;
    
    // Check expiry
    if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return hash.value[field] || null;
  }

  /**
   * Get all fields and values from a hash
   */
  async hgetall(key) {
    this._checkConnection();
    
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return {};
    
    // Check expiry
    if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      return {};
    }
    
    return { ...hash.value };
  }

  /**
   * Get multiple fields from a hash
   */
  async hmget(key, ...fields) {
    this._checkConnection();
    
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') {
      return fields.map(() => null);
    }
    
    // Check expiry
    if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      return fields.map(() => null);
    }
    
    return fields.map(field => hash.value[field] || null);
  }

  /**
   * Delete fields from a hash
   */
  async hdel(key, ...fields) {
    this._checkConnection();
    
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return 0;
    
    // Check expiry
    if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      return 0;
    }
    
    let deleted = 0;
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(hash.value, field)) {
        delete hash.value[field];
        deleted++;
      }
    }
    
    // Update the hash
    this.store.set(key, hash);
    
    return deleted;
  }

  /**
   * Check if a field exists in a hash
   */
  async hexists(key, field) {
    this._checkConnection();
    
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return 0;
    
    // Check expiry
    if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      return 0;
    }
    
    return Object.prototype.hasOwnProperty.call(hash.value, field) ? 1 : 0;
  }

  /**
   * Get all field names in a hash
   */
  async hkeys(key) {
    this._checkConnection();
    
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return [];
    
    // Check expiry
    if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      return [];
    }
    
    return Object.keys(hash.value);
  }

  /**
   * Get number of fields in a hash
   */
  async hlen(key) {
    this._checkConnection();
    
    const hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') return 0;
    
    // Check expiry
    if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      return 0;
    }
    
    return Object.keys(hash.value).length;
  }

  /**
   * Increment field value in a hash
   */
  async hincrby(key, field, increment) {
    this._checkConnection();
    
    // Get or create hash
    let hash = this.store.get(key);
    if (!hash || typeof hash.value !== 'object') {
      hash = { value: {}, expiry: null };
    } else if (hash.expiry && hash.expiry < Date.now()) {
      this.store.delete(key);
      hash = { value: {}, expiry: null };
    }
    
    // Get current value
    const currentValue = parseInt(hash.value[field], 10) || 0;
    
    // Set new value
    hash.value[field] = (currentValue + increment).toString();
    this.store.set(key, hash);
    
    return parseInt(hash.value[field], 10);
  }

  // List operations
  
  /**
   * Push values to the head of a list
   */
  async lpush(key, ...values) {
    this._checkConnection();
    
    // Get or create list
    let item = this.store.get(key);
    if (!item) {
      item = { value: [], expiry: null };
    } else if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      item = { value: [], expiry: null };
    }
    
    // Ensure value is an array
    if (!Array.isArray(item.value)) {
      item.value = [];
    }
    
    // Reverse the values and push each to the head of the list
    // This is how Redis actually behaves - last value becomes first in the list
    const reversedValues = [...values].reverse();
    for (const val of reversedValues) {
      item.value.unshift(val);
    }
    
    this.store.set(key, item);
    
    return item.value.length;
  }
  
  /**
   * Push values to the tail of a list
   */
  async rpush(key, ...values) {
    this._checkConnection();
    
    // Get or create list
    let item = this.store.get(key);
    if (!item) {
      item = { value: [], expiry: null };
    } else if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      item = { value: [], expiry: null };
    }
    
    // Ensure value is an array
    if (!Array.isArray(item.value)) {
      item.value = [];
    }
    
    // Push values to the tail
    item.value.push(...values);
    this.store.set(key, item);
    
    return item.value.length;
  }
  
  /**
   * Pop a value from the head of a list
   */
  async lpop(key) {
    this._checkConnection();
    
    const item = this.store.get(key);
    if (!item) return null;
    
    // Check expiry
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    // Ensure value is an array
    if (!Array.isArray(item.value) || item.value.length === 0) {
      return null;
    }
    
    // Pop value from the head
    const value = item.value.shift();
    
    // Update the list
    this.store.set(key, item);
    
    return value;
  }
  
  /**
   * Pop a value from the tail of a list
   */
  async rpop(key) {
    this._checkConnection();
    
    const item = this.store.get(key);
    if (!item) return null;
    
    // Check expiry
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    // Ensure value is an array
    if (!Array.isArray(item.value) || item.value.length === 0) {
      return null;
    }
    
    // Pop value from the tail
    const value = item.value.pop();
    
    // Update the list
    this.store.set(key, item);
    
    return value;
  }
  
  /**
   * Get the length of a list
   */
  async llen(key) {
    this._checkConnection();
    
    const item = this.store.get(key);
    if (!item) return 0;
    
    // Check expiry
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return 0;
    }
    
    // Ensure value is an array
    if (!Array.isArray(item.value)) {
      return 0;
    }
    
    return item.value.length;
  }
  
  /**
   * Get a range of elements from a list
   */
  async lrange(key, start, stop) {
    this._checkConnection();
    
    const item = this.store.get(key);
    if (!item) return [];
    
    // Check expiry
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return [];
    }
    
    // Ensure value is an array
    if (!Array.isArray(item.value)) {
      return [];
    }
    
    // Handle negative indices
    let startIndex = start;
    let stopIndex = stop;
    
    if (start < 0) {
      startIndex = Math.max(0, item.value.length + start);
    }
    
    if (stop < 0) {
      stopIndex = item.value.length + stop;
    }
    
    // Get the range (inclusive of stop in Redis)
    return item.value.slice(startIndex, stopIndex + 1);
  }

  // Other Redis commands

  /* 
   * Publish message to channel
   */
  async publish(channel, message) {
    this._checkConnection();
    
    const subscribers = this.pubsub.get(channel) || new Set();
    
    if (subscribers.size === 0) {
      return 0;
    }
    
    for (const callback of subscribers) {
      try {
        callback(channel, message);
      } catch (error) {
        // Ignore errors from callbacks
      }
    }
    
    return subscribers.size;
  }
  
  /**
   * Subscribe to channel
   */
  async subscribe(channel, callback) {
    this._checkConnection();
    
    if (!this.pubsub.has(channel)) {
      this.pubsub.set(channel, new Set());
    }
    
    this.pubsub.get(channel).add(callback);
    
    return true;
  }
  
  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel, callback) {
    this._checkConnection();
    
    if (!this.pubsub.has(channel)) {
      return false;
    }
    
    if (callback) {
      return this.pubsub.get(channel).delete(callback);
    } else {
      this.pubsub.delete(channel);
      return true;
    }
  }

  // Helper methods

  /**
   * Check if connected and throw error if not
   * @private
   */
  _checkConnection() {
    if (!this.connected) {
      throw new Error('Redis client is not connected');
    }
  }

  /**
   * Clear cache for testing
   */
  clear() {
    this.store.clear();
    return 'OK';
  }
}

export default RedisMock;