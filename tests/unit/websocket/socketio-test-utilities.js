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
        // Track shutdown steps for better error diagnosis
        const shutdownSteps = [];
        
        try {
          // First disconnect all clients and remove all event listeners
          shutdownSteps.push('Disconnecting clients');
          for (const client of activeClients) {
            if (client) {
              // Remove all listeners first to prevent reconnection attempts
              try {
                client.removeAllListeners();
                shutdownSteps.push(`Removed listeners from client ${client.id || 'unknown'}`);
              } catch (e) {
                console.error("Error removing client listeners:", e);
              }
              
              // Then disconnect if connected
              if (client.connected) {
                try {
                  client.disconnect();
                  shutdownSteps.push(`Disconnected client ${client.id || 'unknown'}`);
                } catch (e) {
                  console.error("Error disconnecting client:", e);
                }
              }
            }
          }
          activeClients.clear();
          shutdownSteps.push('Cleared active clients');
          
          // Force disconnect all sockets on the server
          shutdownSteps.push('Disconnecting server sockets');
          try {
            io.disconnectSockets(true);
            shutdownSteps.push('Disconnected all server sockets');
          } catch (e) {
            console.error("Error disconnecting server sockets:", e);
          }
          
          // Remove all event listeners from the io instance
          try {
            io.removeAllListeners();
            shutdownSteps.push('Removed all IO event listeners');
          } catch (e) {
            console.error("Error removing IO listeners:", e);
          }
          
          // Close the server with a short timeout to prevent hanging
          shutdownSteps.push('Closing server');
          const timeout = setTimeout(() => {
            console.log("Server close timed out, forcing shutdown");
            shutdownSteps.push('Server close timed out');
            
            try {
              io.close();
              shutdownSteps.push('Closed IO after timeout');
            } catch (e) {
              console.error("Error closing io after timeout:", e);
            }
            
            console.log('Shutdown steps completed:', shutdownSteps.join(' -> '));
            resolve();
          }, 300);
          
          server.close(() => {
            clearTimeout(timeout);
            shutdownSteps.push('Server closed successfully');
            
            try {
              io.close();
              shutdownSteps.push('Closed IO normally');
            } catch (e) {
              console.error("Error closing io:", e);
            }
            
            console.log('Shutdown steps completed:', shutdownSteps.join(' -> '));
            resolve();
          });
        } catch (e) {
          console.error('Unexpected error during shutdown:', e);
          shutdownSteps.push(`ERROR: ${e.message}`);
          console.log('Shutdown steps (with error):', shutdownSteps.join(' -> '));
          resolve(); // Still resolve to prevent test hanging
        }
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
 * Wait for a specific event from a socket.io client with improved error handling
 * @param {Object} client - Socket.io client
 * @param {string} event - Event name to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<any>} Promise that resolves with the event data
 */
export function waitForEvent(client, event, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    // Handle case where client is not connected
    if (!client.connected) {
      console.warn(`Warning: Waiting for event ${event} on disconnected client`);
    }
    
    // Create a cleanup function for consistent listener removal
    const cleanupListeners = () => {
      try {
        client.off(event);
        client.off('error');
        client.off('disconnect');
      } catch (err) {
        console.error(`Error removing event listeners for ${event}:`, err);
      }
    };
    
    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      cleanupListeners();
      
      // Include client status in the error for better debugging
      const status = {
        connected: client.connected,
        id: client.id || 'unknown',
        hasListeners: client.hasListeners ? client.hasListeners(event) : 'unknown'
      };
      
      reject(new Error(`Timeout waiting for ${event} event after ${timeoutMs}ms. Client status: ${JSON.stringify(status)}`));
    }, timeoutMs);
    
    // Listen for the requested event
    client.once(event, (data) => {
      clearTimeout(timeout);
      cleanupListeners();
      resolve(data);
    });
    
    // Also listen for errors that might prevent the event
    client.once('error', (err) => {
      clearTimeout(timeout);
      cleanupListeners();
      reject(new Error(`Error while waiting for ${event}: ${err.message}`));
    });
    
    // Listen for disconnects that would prevent the event
    client.once('disconnect', (reason) => {
      clearTimeout(timeout);
      cleanupListeners();
      reject(new Error(`Client disconnected while waiting for ${event}. Reason: ${reason}`));
    });
  });
}

/**
 * Wait for socket.io client to connect with robust error handling
 * @param {Object} client - Socket.io client
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<void>} Promise that resolves when connected
 */
export function waitForConnect(client, timeoutMs = 500) {
  // If already connected, resolve immediately
  if (client.connected) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    // Set up event cleanup function to ensure proper resource management
    const cleanupEvents = () => {
      try {
        client.off('connect');
        client.off('connect_error');
        client.off('connect_timeout');
        client.off('error');
      } catch (err) {
        console.error('Error cleaning up connection event listeners:', err);
      }
    };
    
    // Set a timeout to avoid hanging
    const timeout = setTimeout(() => {
      cleanupEvents();
      
      // Track status information for better debugging
      const status = {
        connected: client.connected,
        connecting: client.connecting,
        id: client.id,
        disconnected: client.disconnected
      };
      
      reject(new Error(`Connection timeout after ${timeoutMs}ms. Client status: ${JSON.stringify(status)}`));
    }, timeoutMs);
    
    // Success handler
    client.once('connect', () => {
      clearTimeout(timeout);
      cleanupEvents();
      resolve();
    });
    
    // Error handlers for different failure scenarios
    client.once('connect_error', (err) => {
      clearTimeout(timeout);
      cleanupEvents();
      reject(new Error(`Connection error: ${err.message}`));
    });
    
    client.once('connect_timeout', () => {
      clearTimeout(timeout);
      cleanupEvents();
      reject(new Error('Connection attempt timed out'));
    });
    
    client.once('error', (err) => {
      clearTimeout(timeout);
      cleanupEvents();
      reject(new Error(`Socket error: ${err.message}`));
    });
    
    // Ensure connection is attempted
    if (!client.connected && !client.connecting) {
      client.connect();
    }
  });
}