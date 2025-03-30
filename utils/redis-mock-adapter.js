/**
 * Redis Mock Adapter
 * 
 * This adapter wraps our RedisMock to make it compatible
 * with the ioredis API interface. It can be used as a drop-in
 * replacement for real Redis connections in tests.
 */

import RedisMock from './redis-mock.js';

/**
 * Redis Mock Adapter that implements the ioredis interface
 */
class RedisMockAdapter {
  constructor(options = {}) {
    this.mock = new RedisMock(options);
    this.options = options;
    this.status = 'wait';  // ioredis connection status
    
    // Expose all methods from the mock
    this._proxyMethods();
    
    // Setup event handling
    this._setupEvents();
  }

  /**
   * Connect to the mock Redis
   */
  async connect() {
    this.status = 'connecting';
    await this.mock.connect();
    this.status = 'ready';
    return this;
  }

  /**
   * Disconnect from the mock Redis
   */
  async disconnect() {
    if (this.status !== 'end') {
      this.status = 'end';
      await this.mock.disconnect();
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
   * Set up event handling to mimic ioredis behavior
   * @private
   */
  _setupEvents() {
    // Forward events from mock to adapter
    this.mock.on('connect', () => {
      this.status = 'connect';
      this.emit('connect');
    });
    
    this.mock.on('ready', () => {
      this.status = 'ready';
      this.emit('ready');
    });
    
    this.mock.on('end', () => {
      this.status = 'end';
      this.emit('end');
    });
    
    this.mock.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * Proxy all methods from the mock to this adapter
   * @private
   */
  _proxyMethods() {
    // Get all method names from the mock
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.mock))
      .filter(name => {
        return typeof this.mock[name] === 'function' && 
               name !== 'constructor' &&
               !name.startsWith('_');
      });
    
    // Proxy each method
    for (const method of methods) {
      if (!this[method]) {
        this[method] = async (...args) => {
          return this.mock[method](...args);
        };
      }
    }
  }

  /**
   * Create a duplicate instance for multi commands
   */
  multi() {
    const multi = {
      commands: [],
      queue: [],
      
      exec: async () => {
        const results = [];
        for (const { method, args } of multi.queue) {
          try {
            const result = await this.mock[method](...args);
            results.push([null, result]);
          } catch (error) {
            results.push([error, null]);
          }
        }
        return results;
      }
    };
    
    // Add command methods
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.mock))
      .filter(name => {
        return typeof this.mock[name] === 'function' && 
               name !== 'constructor' &&
               !name.startsWith('_') &&
               name !== 'multi' &&
               name !== 'exec';
      });
    
    for (const method of methods) {
      multi[method] = (...args) => {
        multi.commands.push(method);
        multi.queue.push({ method, args });
        return multi;
      };
    }
    
    return multi;
  }

  /**
   * Emit an event (ioredis compatible)
   * @private
   */
  emit(event, ...args) {
    if (this.listeners && typeof this.listeners[event] === 'function') {
      this.listeners[event](...args);
    }
    
    return true;
  }

  /**
   * Register event listener (ioredis compatible)
   */
  on(event, callback) {
    if (!this.listeners) {
      this.listeners = {};
    }
    
    this.listeners[event] = callback;
    
    // Execute connect callback immediately if already connected
    if (event === 'connect' && this.status === 'ready') {
      setTimeout(() => callback(), 0);
    }
    
    return this;
  }

  /**
   * Unregister event listener (ioredis compatible)
   */
  off(event, callback) {
    if (this.listeners && this.listeners[event]) {
      delete this.listeners[event];
    }
    
    return this;
  }

  /**
   * Register one-time event listener (ioredis compatible)
   */
  once(event, callback) {
    if (!this.listeners) {
      this.listeners = {};
    }
    
    const onceCallback = (...args) => {
      delete this.listeners[event];
      callback(...args);
    };
    
    this.listeners[event] = onceCallback;
    
    // Execute connect callback immediately if already connected
    if (event === 'connect' && this.status === 'ready') {
      setTimeout(() => onceCallback(), 0);
    }
    
    return this;
  }

  /**
   * Clear cache for testing
   */
  clear() {
    return this.mock.clear();
  }
}

export default RedisMockAdapter;