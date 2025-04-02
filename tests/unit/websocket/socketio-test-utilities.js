/**
 * Socket.IO Test Utilities
 * 
 * Provides helper functions and utilities for WebSocket test setup and management
 */

import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import getPort from 'get-port';

/**
 * Creates a test environment for Socket.IO testing
 * @param {Object} options - Socket.IO server options
 * @returns {Object} Test environment with server, client creation, and cleanup methods
 */
export function createSocketTestEnv(options = {}) {
  const app = express();
  const server = createServer(app);
  
  // Track active clients for cleanup
  const activeClients = new Set();
  
  // Create Socket.IO server with provided options
  const io = new Server(server, {
    pingTimeout: options.pingTimeout || 500,
    pingInterval: options.pingInterval || 500,
    connectTimeout: options.connectTimeout || 1000,
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    ...options
  });
  
  // Start the server on a random port
  let serverPort = 8000 + Math.floor(Math.random() * 1000);
  server.listen(serverPort);
  
  // Create a method to create test clients
  const createClient = (clientOptions = {}) => {
    const client = ioc(`http://localhost:${serverPort}`, {
      autoConnect: true,
      reconnection: clientOptions.reconnection !== false,
      reconnectionDelay: clientOptions.reconnectionDelay || 500,
      reconnectionAttempts: clientOptions.reconnectionAttempts || 3,
      forceNew: true,
      ...clientOptions
    });
    
    // Track for cleanup
    activeClients.add(client);
    
    return client;
  };
  
  // Create a shutdown method for cleanup
  const shutdown = async () => {
    console.log('Shutdown steps starting...');
    
    // Helper for sequential cleanup with error handling
    const safeExecute = async (fn, name) => {
      try {
        await fn();
        console.log(`${name} completed`);
        return true;
      } catch (error) {
        console.error(`Error during ${name}:`, error.message);
        return false;
      }
    };
    
    // Keep track of steps for debugging
    const steps = [];
    
    // 1. Disconnect all clients
    steps.push('Disconnecting clients');
    
    // Remove all event listeners from clients first to prevent feedback loops
    for (const client of activeClients) {
      // Safety check since we might be in a partial state
      if (client && typeof client.offAny === 'function') {
        try {
          client.offAny();
          steps.push(`Removed listeners from client ${client.id}`);
        } catch (err) {
          steps.push(`Failed to remove listeners from client ${client.id || 'unknown'}: ${err.message}`);
        }
      }
    }
    
    // Then disconnect clients
    for (const client of activeClients) {
      try {
        if (client && typeof client.disconnect === 'function') {
          client.disconnect();
          steps.push(`Disconnected client ${client.id || 'unknown'}`);
        }
      } catch (err) {
        steps.push(`Failed to disconnect client: ${err.message}`);
      }
    }
    
    // Clear the tracked clients
    activeClients.clear();
    steps.push('Cleared active clients');
    
    // 2. Disconnect all server-side sockets
    steps.push('Disconnecting server sockets');
    try {
      const serverSockets = await io.fetchSockets();
      for (const socket of serverSockets) {
        socket.disconnect(true);
      }
      steps.push('Disconnected all server sockets');
    } catch (err) {
      steps.push(`Failed to disconnect server sockets: ${err.message}`);
    }
    
    // 3. Remove all IO event listeners
    try {
      io.removeAllListeners();
      steps.push('Removed all IO event listeners');
    } catch (err) {
      steps.push(`Failed to remove IO listeners: ${err.message}`);
    }
    
    // 4. Close the server
    steps.push('Closing server');
    await new Promise((resolve) => {
      try {
        server.close(() => resolve());
      } catch (err) {
        steps.push(`Error during server close: ${err.message}`);
        resolve();
      }
    });
    steps.push('Server closed successfully');
    
    // 5. Close IO instance
    try {
      await new Promise((resolve) => {
        try {
          io.close(() => resolve());
        } catch (err) {
          steps.push(`Error during IO close: ${err.message}`);
          resolve();
        }
      });
      steps.push('Closed IO normally');
    } catch (err) {
      steps.push(`Failed to close IO properly: ${err.message}`);
    }
    
    console.log('Shutdown steps completed:', steps.join(' -> '));
  };
  
  return {
    app,
    server,
    io,
    port: serverPort,
    createClient,
    shutdown,
    activeClients
  };
}

/**
 * Wait for a specific event from the client
 * @param {SocketIOClient.Socket} client - Socket.IO client
 * @param {string} event - Event name to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<any>} The event data
 */
export function waitForEvent(client, event, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error(`Client is not connected. Cannot wait for ${event}`));
      return;
    }
    
    const hasListeners = client.hasListeners(event);
    
    // Handle the event
    function handleEvent(data) {
      clearTimeout(timeout);
      client.off(event, handleEvent);
      resolve(data);
    }
    
    // Set up the event listener
    client.on(event, handleEvent);
    
    // Set up a timeout
    const timeout = setTimeout(() => {
      client.off(event, handleEvent);
      reject(new Error(`Timeout waiting for ${event} event after ${timeoutMs}ms. Client status: ${JSON.stringify({
        connected: client.connected,
        id: client.id,
        hasListeners
      })}`));
    }, timeoutMs);
  });
}

/**
 * Wait for client to connect
 * @param {SocketIOClient.Socket} client - Socket.IO client
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export function waitForConnect(client, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    // If already connected, resolve immediately
    if (client.connected) {
      resolve();
      return;
    }
    
    // Setup handlers
    const onConnect = () => {
      clearTimeout(timeout);
      cleanup();
      resolve();
    };
    
    const onConnectError = (error) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(`Connection error: ${error.message}`));
    };
    
    const onError = (error) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(`Socket error: ${error.message}`));
    };
    
    const cleanup = () => {
      client.off('connect', onConnect);
      client.off('connect_error', onConnectError);
      client.off('error', onError);
    };
    
    // Set listeners
    client.on('connect', onConnect);
    client.on('connect_error', onConnectError);
    client.on('error', onError);
    
    // Set timeout
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Make sure we're trying to connect
    if (!client.connected && !client.connecting) {
      client.connect();
    }
  });
}

/**
 * Helper to add timeout to any promise
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout error message
 * @returns {Object} Object with resolveWith method to wrap the promise
 */
export function promiseWithTimeout(ms, message) {
  return {
    resolveWith: (promiseFactory) => {
      let timeoutId;
      
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message || `Operation timed out after ${ms}ms`));
        }, ms);
      });
      
      return Promise.race([
        promiseFactory().finally(() => clearTimeout(timeoutId)),
        timeoutPromise
      ]);
    }
  };
}

/**
 * Create a list of deferred events to track multiple events in order
 * @param {string[]} eventNames - List of event names to track
 * @returns {Object} Event tracker with add and waitForAll methods
 */
export function createEventTracker(eventNames) {
  const events = new Map();
  
  // Initialize tracking for each event
  for (const name of eventNames) {
    events.set(name, {
      occurred: false,
      time: null,
      data: null,
      resolvers: []
    });
  }
  
  return {
    // Record an event occurrence
    add: (eventName, data = null) => {
      const event = events.get(eventName);
      if (event) {
        event.occurred = true;
        event.time = Date.now();
        event.data = data;
        
        // Resolve any promises waiting on this event
        for (const resolve of event.resolvers) {
          resolve(data);
        }
        event.resolvers = [];
      }
    },
    
    // Wait for all specified events to occur
    waitForAll: async (eventsToWait = eventNames, timeoutMs = 1000) => {
      const promises = eventsToWait.map(name => {
        const event = events.get(name);
        if (!event) {
          return Promise.reject(new Error(`Unknown event: ${name}`));
        }
        
        if (event.occurred) {
          return Promise.resolve(event.data);
        }
        
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            // Remove this resolver to avoid memory leaks
            const index = event.resolvers.indexOf(resolve);
            if (index !== -1) {
              event.resolvers.splice(index, 1);
            }
            reject(new Error(`Timeout waiting for event: ${name}`));
          }, timeoutMs);
          
          // Custom resolver that clears the timeout
          const wrappedResolver = (data) => {
            clearTimeout(timeoutId);
            resolve(data);
          };
          
          event.resolvers.push(wrappedResolver);
        });
      });
      
      return Promise.all(promises);
    },
    
    // Check if event occurred
    hasOccurred: (eventName) => {
      const event = events.get(eventName);
      return event ? event.occurred : false;
    },
    
    // Get event data
    getData: (eventName) => {
      const event = events.get(eventName);
      return event ? event.data : null;
    },
    
    // Reset event tracker
    reset: () => {
      for (const [name, event] of events.entries()) {
        event.occurred = false;
        event.time = null;
        event.data = null;
        // Reject any pending promises
        for (const resolver of event.resolvers) {
          resolver(new Error('Event tracker reset'));
        }
        event.resolvers = [];
      }
    }
  };
}

/**
 * Generate randomized message content for testing
 * @param {number} size - Size of the message in bytes (approximate)
 * @returns {string} Random message content
 */
export function generateRandomMessage(size) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Split a large message into chunks for testing partial messages
 * @param {Object} message - Message object to split
 * @param {number} chunkSize - Size of each chunk in bytes
 * @returns {Array<string>} Array of message chunks
 */
export function splitMessageIntoChunks(message, chunkSize = 1024) {
  const messageStr = JSON.stringify(message);
  const chunks = [];
  
  for (let i = 0; i < messageStr.length; i += chunkSize) {
    chunks.push(messageStr.substring(i, i + chunkSize));
  }
  
  return chunks;
}

/**
 * Generate a sequence of events at controlled intervals
 * @param {Function} eventEmitter - Function to call for each event
 * @param {number} count - Number of events to emit
 * @param {number} interval - Interval between events in ms
 * @param {Array} eventData - Array of data to emit (will cycle if count > length)
 * @returns {Promise<void>} Promise that resolves when all events are emitted
 */
export async function emitControlledSequence(eventEmitter, count, interval, eventData = []) {
  for (let i = 0; i < count; i++) {
    const data = eventData.length > 0 ? eventData[i % eventData.length] : i;
    eventEmitter(data, i);
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}