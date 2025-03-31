/**
 * Socket.IO Test Environment
 * 
 * This class provides a reusable environment for Socket.IO tests, addressing
 * the common issues with WebSocket testing:
 * 
 * 1. Port conflicts and resource cleanup
 * 2. Connection timing and race conditions
 * 3. Reconnection testing instability
 * 4. Test isolation
 * 
 * Usage:
 * ```
 * const testEnv = await setupSocketTestEnvironment();
 * await testEnv.start();
 * 
 * // Create client connections
 * const client = await testEnv.createClient();
 * 
 * // Wait for specific events or use explicit connection verification
 * await testEnv.waitForEvent(client, 'connect');
 * 
 * // Simulate disconnections cleanly
 * await testEnv.disconnectClient(client);
 * 
 * // Clean up resources
 * await testEnv.stop();
 * ```
 */
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const getPort = require('get-port');

/**
 * Socket.IO Test Environment
 */
class SocketTestEnvironment {
  constructor() {
    this.port = null;
    this.app = null;
    this.server = null;
    this.io = null;
    this.clients = new Set();
    this.connectionCount = 0;
    this.disconnectionCount = 0;
    this.events = {};
    this.cleanupCallbacks = [];
  }
  
  /**
   * Start the Socket.IO server on a free port
   */
  async start(options = {}) {
    // Get a free port
    this.port = await getPort();
    
    // Create Express app and HTTP server
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Configure Socket.IO server
    this.io = new Server(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      // Use relatively short timeouts for testing
      pingTimeout: options.pingTimeout || 1000,
      pingInterval: options.pingInterval || 1000,
    });
    
    // Set up connection tracking
    this.io.on('connection', (socket) => {
      this.connectionCount++;
      this.emitEvent('server:connection', socket);
      
      // Track disconnections
      socket.on('disconnect', (reason) => {
        this.disconnectionCount++;
        this.emitEvent('server:disconnect', { socket, reason });
      });
      
      // Set up ping/pong for connection verification
      socket.on('ping-test', () => {
        socket.emit('pong-test', { timestamp: Date.now() });
      });
    });
    
    // Set up basic route for health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    
    // Start the server
    await new Promise(resolve => {
      this.server.listen(this.port, () => {
        resolve();
      });
    });
    
    console.log(`Socket.IO test server running on port ${this.port}`);
    return this;
  }
  
  /**
   * Create a client connected to the test server
   */
  async createClient(options = {}) {
    // Create the client
    const client = ioClient(`http://localhost:${this.port}`, {
      reconnection: options.reconnection !== false,
      reconnectionAttempts: options.reconnectionAttempts || 5,
      reconnectionDelay: options.reconnectionDelay || 500,
      timeout: options.timeout || 3000,
      forceNew: true, // Important for test isolation
    });
    
    // Track the client
    this.clients.add(client);
    
    // Set up manual connection verification
    client.on('connect', () => {
      this.emitEvent('client:connect', client);
    });
    
    client.on('disconnect', (reason) => {
      this.emitEvent('client:disconnect', { client, reason });
    });
    
    // If waitForConnection is true, wait for the connection to be established
    if (options.waitForConnection !== false) {
      await this.waitForConnection(client, options.timeout || 3000);
    }
    
    return client;
  }
  
  /**
   * Wait for a client to establish connection
   */
  async waitForConnection(client, timeout = 3000) {
    // If already connected, return immediately
    if (client.connected) {
      return client;
    }
    
    // Wait for connection event or timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, timeout);
      
      client.once('connect', () => {
        clearTimeout(timeoutId);
        
        // Additional verification with ping/pong
        client.emit('ping-test');
        client.once('pong-test', () => {
          resolve(client);
        });
      });
    });
  }
  
  /**
   * Explicitly disconnect a client with proper cleanup
   */
  async disconnectClient(client, options = {}) {
    if (!client) return;
    
    const timeout = options.timeout || 1000;
    
    // Create a promise that resolves when the client disconnects
    const disconnectPromise = new Promise((resolve) => {
      // If client is already disconnected
      if (!client.connected) {
        return resolve();
      }
      
      // Listen for disconnect event
      const onDisconnect = () => {
        resolve();
      };
      
      client.once('disconnect', onDisconnect);
      
      // Initiate disconnect
      client.disconnect();
      
      // Set timeout to ensure we don't hang
      setTimeout(() => {
        client.off('disconnect', onDisconnect);
        resolve();
      }, timeout);
    });
    
    // Wait for disconnect to complete
    await disconnectPromise;
    
    // Remove from tracked clients
    this.clients.delete(client);
  }
  
  /**
   * Wait for a specific event to occur
   */
  async waitForEvent(emitter, event, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event "${event}" timeout after ${timeout}ms`));
      }, timeout);
      
      emitter.once(event, (...args) => {
        clearTimeout(timer);
        resolve(args);
      });
    });
  }
  
  /**
   * Emit an internal event for test tracking
   */
  emitEvent(event, data) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push({ data, timestamp: Date.now() });
    
    // Clean up old events (keep only the last 100)
    if (this.events[event].length > 100) {
      this.events[event] = this.events[event].slice(-100);
    }
  }
  
  /**
   * Register a cleanup callback
   */
  onCleanup(callback) {
    this.cleanupCallbacks.push(callback);
  }
  
  /**
   * Get server status
   */
  getStatus() {
    return {
      running: !!this.server && this.server.listening,
      port: this.port,
      connections: {
        current: this.io ? this.io.engine.clientsCount : 0,
        total: this.connectionCount,
        disconnections: this.disconnectionCount,
      },
      clients: this.clients.size,
    };
  }
  
  /**
   * Stop the server and clean up resources
   */
  async stop() {
    // Disconnect all clients
    for (const client of this.clients) {
      try {
        await this.disconnectClient(client);
      } catch (error) {
        console.error('Error disconnecting client:', error);
      }
    }
    this.clients.clear();
    
    // Run cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    }
    this.cleanupCallbacks = [];
    
    // Close the server
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    
    if (this.server) {
      await new Promise(resolve => {
        this.server.close(() => {
          resolve();
        });
      });
      this.server = null;
    }
    
    // Reset state
    this.app = null;
    this.port = null;
    this.events = {};
    
    console.log('Socket.IO test environment stopped');
  }
}

module.exports = SocketTestEnvironment;