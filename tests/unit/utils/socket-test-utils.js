/**
 * Socket.IO Test Utilities
 * 
 * Enhanced utilities for testing Socket.IO connections with excellent stability and timeout prevention.
 * This module incorporates best practices from the attached document examples, optimized for the
 * project's specific Socket.IO implementation in server/routes.ts.
 * 
 * Key Features:
 * - Dynamic port allocation to prevent conflicts
 * - Robust setup and teardown to prevent resource leaks
 * - Short timeouts for failure detection
 * - Detailed logging for troubleshooting
 * - Direct vs simulation testing modes
 */

import { Server as SocketIoServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import getPort from 'get-port';

/**
 * Creates a Socket.IO test environment with improved stability
 * @param {Object} options - Configuration options
 * @returns {Object} Test environment controller
 */
export async function createSocketTestEnvironment(options = {}) {
  // Generate a random available port to avoid conflicts
  const port = options.port || await getPort();
  
  // Create Express app and HTTP server
  const app = express();
  const httpServer = createServer(app);
  
  // Set up Socket.IO server with optimal test settings
  const io = new SocketIoServer(httpServer, {
    path: options.path || '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    // Use short timeouts for faster test failure detection
    connectTimeout: options.connectTimeout || 1000,
    pingTimeout: options.pingTimeout || 300,
    pingInterval: options.pingInterval || 200
  });
  
  // Start server
  await new Promise((resolve, reject) => {
    httpServer.once('error', (err) => {
      console.error(`[SocketTest] Server failed to start: ${err.message}`);
      reject(err);
    });
    
    httpServer.listen(port, () => {
      console.log(`[SocketTest] Server listening on port ${port}`);
      resolve();
    });
  });
  
  // Track all clients for proper cleanup
  const clients = new Set();
  
  // Basic server-side event handlers (optional, similar to the project's implementation)
  if (options.addBasicHandlers !== false) {
    io.on('connection', (socket) => {
      console.log(`[SocketTest] Client connected: ${socket.id}`);
      
      // Track client metadata like in the main application
      const metadata = {
        id: socket.id,
        lastActivity: Date.now(),
        subscriptions: ['all']
      };
      
      // Add basic handlers similar to server/routes.ts
      socket.join('all');
      
      // Enhanced subscription handler with better room management and debug logging
      socket.on('subscribe', (message) => {
        try {
          const msgString = typeof message === 'string' 
            ? message 
            : JSON.stringify(message);
          
          console.log(`[SocketTest] Subscription from ${socket.id}:`, msgString);
          
          // Extract topics/channels from different message formats
          const topics = [];
          
          if (message) {
            if (Array.isArray(message)) {
              // Handle array format
              topics.push(...message);
            } else if (typeof message === 'object') {
              // Handle object format with topics or channels property
              if (Array.isArray(message.topics)) {
                topics.push(...message.topics);
              } else if (Array.isArray(message.channels)) {
                topics.push(...message.channels);
              } else if (typeof message.topics === 'string') {
                topics.push(message.topics);
              } else if (typeof message.channels === 'string') {
                topics.push(message.channels);
              }
            } else if (typeof message === 'string') {
              // Handle single string format
              topics.push(message);
            }
          }
          
          console.log(`[SocketTest] Parsed topics for ${socket.id}:`, topics);
          
          // Get current rooms before leaving
          const previousRooms = Array.from(socket.rooms)
            .filter(room => room !== socket.id);
          
          // Leave all rooms first (except the default socket.id room)
          previousRooms.forEach(room => {
            socket.leave(room);
            console.log(`[SocketTest] ${socket.id} left room: ${room}`);
          });
          
          // Join requested rooms
          for (const topic of topics) {
            socket.join(topic);
            console.log(`[SocketTest] ${socket.id} joined room: ${topic}`);
          }
          
          // Always add to 'all' room
          socket.join('all');
          console.log(`[SocketTest] ${socket.id} joined room: all`);
          
          // Get updated room list for confirmation
          const currentRooms = Array.from(socket.rooms)
            .filter(room => room !== socket.id);
          
          console.log(`[SocketTest] ${socket.id} is now in rooms:`, currentRooms);
          
          // Include all in the confirmation for clients that expect it
          const confirmTopics = [...topics];
          if (!confirmTopics.includes('all')) {
            confirmTopics.push('all');
          }
          
          // Confirm subscription
          socket.emit('message', {
            type: 'subscription_update',
            status: 'success',
            topics: confirmTopics
          });
          
          console.log(`[SocketTest] Sent subscription confirmation to ${socket.id}`);
        } catch (error) {
          console.error(`[SocketTest] Error in subscribe handler for ${socket.id}:`, error);
          
          // Try to send error response
          try {
            socket.emit('message', {
              type: 'subscription_update',
              status: 'error',
              error: error.message
            });
          } catch (e) {
            console.error(`[SocketTest] Failed to send error response:`, e);
          }
        }
      });
      
      socket.on('ping', () => {
        socket.emit('message', {
          type: 'pong',
          time: Date.now(),
          status: 'ok'
        });
      });
      
      socket.on('message', (data) => {
        try {
          console.log(`[SocketTest] Message from ${socket.id}:`, 
            typeof data === 'string' ? data : JSON.stringify(data));
            
          // Parse message if needed
          const message = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Handle by type (similar to main app)
          if (message.type === 'ping') {
            socket.emit('message', {
              type: 'pong',
              time: Date.now(),
              status: 'ok'
            });
          }
          
          // Other message types can be added as needed
        } catch (error) {
          console.error(`[SocketTest] Error processing message:`, error);
        }
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`[SocketTest] Client disconnected: ${socket.id}, reason: ${reason}`);
      });
      
      socket.on('error', (error) => {
        console.error(`[SocketTest] Socket error for ${socket.id}:`, error);
      });
    });
  }
  
  // Return test environment controller
  return {
    io,
    httpServer,
    app,
    port,
    clientURL: `http://localhost:${port}`,
    
    /**
     * Create a client with test-friendly settings
     * @param {Object} clientOptions - Client configuration
     * @returns {Object} Socket.IO client
     */
    createClient(clientOptions = {}) {
      const defaultOptions = {
        forceNew: true,
        autoConnect: false,
        reconnection: clientOptions.reconnection !== undefined ? 
          clientOptions.reconnection : false,
        reconnectionAttempts: clientOptions.reconnectionAttempts || 2,
        reconnectionDelay: clientOptions.reconnectionDelay || 100,
        reconnectionDelayMax: clientOptions.reconnectionDelayMax || 200,
        timeout: clientOptions.timeout || 1000
      };
      
      const client = SocketIOClient(`http://localhost:${port}`, {
        ...defaultOptions,
        ...clientOptions
      });
      
      // Track client for cleanup
      clients.add(client);
      
      // Add debugging listeners if requested
      if (clientOptions.debug) {
        client.on('connect', () => console.log(`[SocketTest] Client connected: ${client.id}`));
        client.on('disconnect', (reason) => console.log(`[SocketTest] Client disconnected: ${client.id}, reason: ${reason}`));
        client.on('connect_error', (err) => console.log(`[SocketTest] Client connect error: ${err.message}`));
        client.on('error', (err) => console.log(`[SocketTest] Client error: ${err.message}`));
      }
      
      return client;
    },
    
    /**
     * Broadcast a message to all clients on a room
     * @param {string} roomName - Room name
     * @param {Object} message - Message to broadcast 
     * @returns {Array} Array of socket IDs that received the message
     */
    broadcastToRoom(roomName, message) {
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }
      
      // Get sockets in the room
      const room = io.sockets.adapter.rooms.get(roomName);
      
      if (!room) {
        console.warn(`[SocketTest] Warning: Room '${roomName}' does not exist or is empty. Message will not be delivered.`);
        return [];
      }
      
      const socketsInRoom = Array.from(room);
      console.log(`[SocketTest] Room '${roomName}' has ${socketsInRoom.length} socket(s):`);
      socketsInRoom.forEach(socketId => {
        console.log(`[SocketTest]   - Socket ${socketId}`);
      });
      
      // Log all rooms for debugging
      console.log(`[SocketTest] All active rooms:`);
      for (const [roomName, sockets] of io.sockets.adapter.rooms.entries()) {
        // Skip socket ID rooms (Socket.IO creates a room for each socket ID)
        if (io.sockets.adapter.socketRooms?.has(roomName)) {
          continue;
        }
        console.log(`[SocketTest]   - Room '${roomName}': ${Array.from(sockets).length} socket(s)`);
      }
      
      // Send the message
      io.to(roomName).emit('message', message);
      console.log(`[SocketTest] Broadcast to room '${roomName}':`, JSON.stringify(message));
      
      return socketsInRoom;
    },
    
    /**
     * Send a message to a specific client
     * @param {string} socketId - Socket ID
     * @param {Object} message - Message to send
     */
    sendToClient(socketId, message) {
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }
      io.to(socketId).emit('message', message);
      console.log(`[SocketTest] Message to client ${socketId}:`, JSON.stringify(message));
    },
    
    /**
     * Safely shutdown server and clean up all connections
     * This prevents resource leaks and hanging tests
     */
    async shutdown() {
      console.log(`[SocketTest] Starting environment shutdown...`);
      
      const steps = [];
      
      try {
        // 1. Clean up all clients
        steps.push('Disconnecting clients');
        const clientDisconnectPromises = [];
        
        for (const client of clients) {
          try {
            // First disable reconnection to prevent reconnect attempts during shutdown
            if (client.io && client.io.opts) {
              client.io.opts.reconnection = false;
            }
            
            // Remove all listeners
            client.removeAllListeners();
            steps.push(`Removed listeners from client ${client.id || 'unknown'}`);
            
            // Then disconnect
            if (client.connected) {
              const disconnectPromise = new Promise(resolve => {
                // Set a short timeout to prevent hanging
                const timeout = setTimeout(() => {
                  steps.push(`Client disconnect timed out ${client.id || 'unknown'}`);
                  resolve();
                }, 300);
                
                client.once('disconnect', () => {
                  clearTimeout(timeout);
                  steps.push(`Client disconnected ${client.id || 'unknown'}`);
                  resolve();
                });
                
                client.disconnect();
              });
              
              clientDisconnectPromises.push(disconnectPromise);
            }
          } catch (e) {
            steps.push(`Error disconnecting client: ${e.message}`);
          }
        }
        
        // Wait for all clients to disconnect with a maximum timeout
        await Promise.race([
          Promise.all(clientDisconnectPromises),
          new Promise(resolve => setTimeout(resolve, 500))
        ]);
        
        clients.clear();
        steps.push('All clients disconnected');
        
        // 2. Disconnect all server-side sockets
        steps.push('Disconnecting server sockets');
        try {
          io.disconnectSockets(true);
          steps.push('Forced disconnect of all server sockets');
        } catch (e) {
          steps.push(`Error disconnecting server sockets: ${e.message}`);
        }
        
        // 3. Close Socket.IO server
        steps.push('Closing Socket.IO server');
        try {
          io.close();
          steps.push('Socket.IO server closed');
        } catch (e) {
          steps.push(`Error closing Socket.IO server: ${e.message}`);
        }
        
        // 4. Close HTTP server with timeout
        steps.push('Closing HTTP server');
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            steps.push('HTTP server close timed out, forcing shutdown');
            resolve();
          }, 300);
          
          httpServer.close(() => {
            clearTimeout(timeout);
            steps.push('HTTP server closed successfully');
            resolve();
          });
        });
        
        steps.push('Shutdown complete');
        console.log(`[SocketTest] Shutdown steps completed: ${steps.join(' -> ')}`);
      } catch (e) {
        steps.push(`Error during shutdown: ${e.message}`);
        console.error(`[SocketTest] Shutdown error:`, e);
        console.log(`[SocketTest] Shutdown steps (with error): ${steps.join(' -> ')}`);
      }
    }
  };
}

/**
 * Wait for a socket.io client to connect successfully
 * @param {Object} socket - Socket.io client
 * @param {number} timeoutMs - Timeout in ms
 * @returns {Promise<void>} Resolves when connected
 */
export function waitForConnect(socket, timeoutMs = 1000) {
  // If already connected, resolve immediately
  if (socket.connected) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    // Clean up function to prevent memory leaks
    const cleanupEvents = () => {
      try {
        socket.off('connect');
        socket.off('connect_error');
        socket.off('error');
      } catch (err) {
        console.error('[SocketTest] Error cleaning up event listeners:', err);
      }
    };
    
    // Set timeout to avoid hanging
    const timeout = setTimeout(() => {
      cleanupEvents();
      reject(new Error(`Connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Listen for connect event
    socket.once('connect', () => {
      clearTimeout(timeout);
      cleanupEvents();
      resolve();
    });
    
    // Listen for errors
    socket.once('connect_error', (err) => {
      clearTimeout(timeout);
      cleanupEvents();
      reject(new Error(`Connection error: ${err.message}`));
    });
    
    socket.once('error', (err) => {
      clearTimeout(timeout);
      cleanupEvents();
      reject(new Error(`Socket error: ${err.message}`));
    });
    
    // Ensure connection attempt if needed
    if (!socket.connected && !socket.connecting) {
      socket.connect();
    }
  });
}

/**
 * Wait for a specific event from a socket.io client
 * @param {Object} socket - Socket.io client
 * @param {string} eventName - Event to wait for
 * @param {number} timeoutMs - Timeout in ms
 * @returns {Promise<any>} Resolves with event data
 */
export function waitForEvent(socket, eventName, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    // Set timeout to avoid hanging
    const timeout = setTimeout(() => {
      try {
        socket.off(eventName);
        socket.off('error');
        socket.off('disconnect');
      } catch (e) {
        console.error(`[SocketTest] Error removing listeners: ${e.message}`);
      }
      reject(new Error(`Timeout waiting for event '${eventName}' after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Listen for the requested event
    socket.once(eventName, (data) => {
      clearTimeout(timeout);
      try {
        socket.off(eventName);
        socket.off('error');
        socket.off('disconnect');
      } catch (e) {
        console.error(`[SocketTest] Error removing listeners: ${e.message}`);
      }
      resolve(data);
    });
    
    // Listen for errors that might prevent the event
    socket.once('error', (err) => {
      clearTimeout(timeout);
      try {
        socket.off(eventName);
        socket.off('error');
        socket.off('disconnect');
      } catch (e) {
        console.error(`[SocketTest] Error removing listeners: ${e.message}`);
      }
      reject(new Error(`Error while waiting for ${eventName}: ${err.message}`));
    });
    
    // Listen for disconnects that would prevent the event
    socket.once('disconnect', (reason) => {
      clearTimeout(timeout);
      try {
        socket.off(eventName);
        socket.off('error');
        socket.off('disconnect');
      } catch (e) {
        console.error(`[SocketTest] Error removing listeners: ${e.message}`);
      }
      reject(new Error(`Client disconnected while waiting for ${eventName}. Reason: ${reason}`));
    });
  });
}

/**
 * Wait for a message of a specific type from a socket.io client
 * This is specific to our app's message format where messages come on the 'message' event
 * with a 'type' field
 * 
 * @param {Object} socket - Socket.io client
 * @param {string} messageType - Message type to wait for
 * @param {number} timeoutMs - Timeout in ms
 * @returns {Promise<any>} Resolves with message data
 */
export function waitForMessageType(socket, messageType, timeoutMs = 1000) {
  console.log(`[SocketTest] Waiting for message type '${messageType}' from client ${socket.id || 'unknown'}...`);
  
  return new Promise((resolve, reject) => {
    // Ensure socket is connected
    if (!socket.connected) {
      console.warn(`[SocketTest] Warning: Socket not connected while waiting for '${messageType}'`);
    }
    
    // Track messages for better debugging
    const receivedMessages = [];
    
    // Timeout to avoid hanging
    const timeout = setTimeout(() => {
      cleanup();
      console.error(`[SocketTest] Timeout waiting for message type '${messageType}' after ${timeoutMs}ms`);
      console.error(`[SocketTest] Received ${receivedMessages.length} other messages while waiting:`);
      receivedMessages.forEach((msg, i) => {
        console.error(`[SocketTest] - Message ${i + 1}: type=${msg.type || 'unknown'}`);
      });
      
      reject(new Error(`Timeout waiting for message type '${messageType}' after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Message handler
    const messageHandler = (data) => {
      try {
        // Parse message if needed
        const message = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Track all messages for debugging
        if (receivedMessages.length < 10) { // Limit to prevent memory issues
          receivedMessages.push(message);
        }
        
        console.log(`[SocketTest] Received message type '${message.type || 'unknown'}', waiting for '${messageType}'`);
        
        // Check if it's the message we're looking for
        if (message.type === messageType) {
          console.log(`[SocketTest] Found target message type '${messageType}'`);
          cleanup();
          clearTimeout(timeout);
          resolve(message);
        }
      } catch (e) {
        console.error(`[SocketTest] Error in message handler: ${e.message}`);
      }
    };
    
    // Error handler
    const errorHandler = (err) => {
      console.error(`[SocketTest] Socket error while waiting for '${messageType}': ${err.message}`);
      cleanup();
      clearTimeout(timeout);
      reject(new Error(`Error while waiting for message type ${messageType}: ${err.message}`));
    };
    
    // Disconnect handler
    const disconnectHandler = (reason) => {
      console.error(`[SocketTest] Socket disconnected while waiting for '${messageType}': ${reason}`);
      cleanup();
      clearTimeout(timeout);
      reject(new Error(`Client disconnected while waiting for message type ${messageType}. Reason: ${reason}`));
    };
    
    // Clean up function
    const cleanup = () => {
      try {
        socket.off('message', messageHandler);
        socket.off('error', errorHandler);
        socket.off('disconnect', disconnectHandler);
        console.log(`[SocketTest] Cleaned up listeners for '${messageType}'`);
      } catch (e) {
        console.error(`[SocketTest] Error removing listeners: ${e.message}`);
      }
    };
    
    // Set up event listeners
    socket.on('message', messageHandler);
    socket.once('error', errorHandler);
    socket.once('disconnect', disconnectHandler);
    
    console.log(`[SocketTest] Listeners attached for message type '${messageType}'`);
  });
}

/**
 * Create a client reconnection handler that works with our app's Socket.IO setup
 * @param {Object} socket - Socket.IO client
 * @param {Object} options - Configuration options
 * @returns {Object} - Reconnection handler
 */
export function createReconnectionHandler(socket, options = {}) {
  // Track state
  const state = {
    wasDisconnected: false,
    reconnectCount: 0,
    reconnected: false,
    lastDisconnectReason: null,
    originalId: socket.id || 'pending'
  };
  
  // Debug logging
  const log = (...args) => {
    if (options.debug) {
      console.log('[ReconnectionHandler]', ...args);
    }
  };
  
  // Save original ID when first connected
  socket.once('connect', () => {
    state.originalId = socket.id;
    log(`Initial connection established. Original ID: ${socket.id}`);
  });
  
  // Track disconnections
  socket.on('disconnect', (reason) => {
    state.wasDisconnected = true;
    state.lastDisconnectReason = reason;
    log(`Disconnected: ${reason}`);
  });
  
  // Track reconnections
  socket.on('connect', () => {
    if (state.wasDisconnected) {
      state.reconnectCount++;
      state.reconnected = true;
      log(`Reconnected. New ID: ${socket.id}, previous ID: ${state.originalId}`);
      
      // Simulate the app's reconnection behavior
      if (options.autoRequestStatus !== false) {
        socket.emit('request_status');
      }
    }
  });
  
  return {
    /**
     * Get current reconnection state
     * @returns {Object} State object
     */
    getState() {
      return { ...state };
    },
    
    /**
     * Wait for reconnection to complete
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Object>} - Reconnection state
     */
    async waitForReconnection(timeoutMs = 2000) {
      log('Waiting for reconnection...');
      
      // Wait for the socket to reconnect
      if (!socket.connected) {
        log('Socket not connected, waiting for connect event');
        try {
          await waitForEvent(socket, 'connect', timeoutMs);
        } catch (err) {
          log(`Reconnection failed: ${err.message}`);
          throw err;
        }
      }
      
      log('Transport connected, waiting for application messages...');
      
      // Wait for system status message (indicates full reconnection in our app)
      if (options.waitForSystemStatus !== false) {
        try {
          await waitForMessageType(socket, 'system_status', timeoutMs);
          log('Received system status message');
        } catch (err) {
          log(`Didn't receive system status after reconnect: ${err.message}`);
          throw err;
        }
      }
      
      return { ...state };
    },
    
    /**
     * Simulate a network drop and wait for reconnection
     * @param {number} timeoutMs - Timeout for reconnection
     * @returns {Promise<Object>} - Reconnection state
     */
    async simulateNetworkDropAndReconnect(timeoutMs = 2000) {
      // Reset state for new test
      state.wasDisconnected = false;
      state.reconnected = false;
      state.reconnectCount = 0;
      
      log('Simulating network drop...');
      
      // Save initial connection state
      const wasConnected = socket.connected;
      
      // Disconnect the socket
      if (socket.connected) {
        socket.disconnect();
      }
      
      // If we were connected before, wait for the disconnect confirmation
      if (wasConnected) {
        try {
          // Wait for disconnect event with shorter timeout
          await waitForEvent(socket, 'disconnect', 500)
            .catch(err => {
              log(`Warning: ${err.message}, but continuing anyway`);
            });
        } catch (e) {
          log(`Error waiting for disconnect: ${e.message}`);
        }
      }
      
      log('Reconnecting socket...');
      
      // Ensure socket is set to reconnect
      if (socket.io && socket.io.opts) {
        socket.io.opts.reconnection = true;
        socket.io.opts.reconnectionAttempts = 3;
        socket.io.opts.reconnectionDelay = 100;
      }
      
      // Reconnect the socket
      socket.connect();
      
      // Wait for reconnection
      try {
        await waitForEvent(socket, 'connect', 1000);
        log('Socket reconnected');
        
        // Update state
        state.wasDisconnected = true;
        state.reconnected = true;
        state.reconnectCount++;
        
        return { ...state };
      } catch (err) {
        log(`Reconnection failed: ${err.message}`);
        throw new Error(`Failed to reconnect: ${err.message}`);
      }
    },
    
    /**
     * Clean up the handler
     */
    cleanup() {
      log('Cleaning up reconnection handler');
      socket.off('disconnect');
      socket.off('connect');
    }
  };
}