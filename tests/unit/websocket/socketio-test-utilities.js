/**
 * Socket.IO Test Utilities
 * 
 * Shared utilities and helpers for Socket.IO testing that ensure:
 * - Fast connection/disconnection
 * - Proper resource cleanup
 * - Short timeouts to prevent test hangs
 * - Tracking of socket instances for reliable cleanup
 */

import { Server as SocketIoServer } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

/**
 * Creates a test Socket.IO environment with proper resource tracking and cleanup
 * This function is designed to prevent memory leaks and timeout issues in tests
 */
export function createSocketTestEnv(options = {}) {
  // Create express app and HTTP server
  const app = express();
  const httpServer = createServer(app);
  
  // Create Socket.IO server with short timeouts for testing
  const io = new SocketIoServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    // Use very short timeouts for faster tests
    pingTimeout: options.pingTimeout || 300,
    pingInterval: options.pingInterval || 200,
    connectTimeout: options.connectTimeout || 500,
    // Use only websocket for faster tests
    transports: options.transports || ['websocket'] 
  });
  
  // Track all socket clients for proper cleanup
  const activeClients = new Set();
  
  // Start server on random port to avoid conflicts
  const serverPort = 3000 + Math.floor(Math.random() * 1000);
  const server = httpServer.listen(serverPort);
  
  // Client URL for connections
  const clientURL = `http://localhost:${serverPort}`;
  
  return {
    io,
    app,
    server,
    port: serverPort,
    clientURL,
    activeClients,
    
    /**
     * Create a client with test-optimized settings
     */
    createClient: (clientOptions = {}) => {
      const client = ioc(clientURL, {
        transports: ['websocket'], // Only websocket for speed
        reconnectionAttempts: clientOptions.reconnectionAttempts ?? 2,
        reconnectionDelay: clientOptions.reconnectionDelay || 100, // Short delay
        timeout: clientOptions.timeout || 500, // Short timeout
        autoConnect: clientOptions.autoConnect !== undefined ? clientOptions.autoConnect : true,
        ...(clientOptions.auth && { auth: clientOptions.auth }),
      });
      
      // Track this client for cleanup
      activeClients.add(client);
      return client;
    },
    
    /**
     * Disconnect all tracked clients
     */
    disconnectAllClients: () => {
      for (const client of activeClients) {
        if (client && client.connected) {
          try {
            client.disconnect();
          } catch (e) {
            console.error("Error disconnecting client:", e);
          }
        }
      }
      activeClients.clear();
    },
    
    /**
     * Create a new namespace with the same server
     */
    createNamespace: (namespaceName) => {
      return io.of(namespaceName);
    },
    
    /**
     * Properly shut down the server and all connections
     * This is crucial for preventing test timeouts
     */
    shutdown: () => {
      return new Promise(resolve => {
        // First disconnect all clients
        for (const client of activeClients) {
          if (client && client.connected) {
            try {
              client.disconnect();
            } catch (e) {
              console.error("Error disconnecting client:", e);
            }
          }
        }
        activeClients.clear();
        
        // Force disconnect all sockets
        try {
          io.disconnectSockets(true);
        } catch (e) {
          console.error("Error disconnecting sockets:", e);
        }
        
        // Close the server with a short timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.log("Server close timed out, forcing shutdown");
          try {
            io.close();
          } catch (e) {
            console.error("Error closing io:", e);
          }
          resolve();
        }, 300);
        
        server.close(() => {
          clearTimeout(timeout);
          try {
            io.close();
          } catch (e) {
            console.error("Error closing io:", e);
          }
          resolve();
        });
      });
    }
  };
}

/**
 * Utility to create a promise with a timeout that rejects if not resolved in time
 * Use this instead of the setTimeout + reject pattern in tests
 */
export function promiseWithTimeout(ms, message = 'Operation timed out') {
  return {
    promise: new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, ms);
      
      // Return the timer so it can be cleared if needed
      return timer;
    }),
    
    /**
     * Resolve this promise from outside
     * @param {Function} resolveAction Function that returns a promise to resolve with
     * @returns {Promise} Promise that resolves with the result or rejects with timeout
     */
    resolveWith: function(resolveAction) {
      let timer;
      
      return Promise.race([
        new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(message));
          }, ms);
        }),
        
        new Promise(async (resolve) => {
          try {
            const result = await resolveAction();
            clearTimeout(timer);
            resolve(result);
          } catch (error) {
            clearTimeout(timer);
            throw error;
          }
        })
      ]);
    }
  };
}

/**
 * Wait for a specific event from a socket.io client
 * @param {Object} client - Socket.io client
 * @param {string} event - Event name to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<any>} Promise that resolves with the event data
 */
export function waitForEvent(client, event, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(event);
      reject(new Error(`Timeout waiting for ${event} event`));
    }, timeoutMs);
    
    client.once(event, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

/**
 * Wait for socket.io client to connect
 * @param {Object} client - Socket.io client
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<void>} Promise that resolves when connected
 */
export function waitForConnect(client, timeoutMs = 500) {
  if (client.connected) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off('connect');
      reject(new Error('Connection timeout'));
    }, timeoutMs);
    
    client.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    
    client.once('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err.message}`));
    });
  });
}