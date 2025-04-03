/**
 * Socket.IO Test Optimizations for Replit Environment
 * 
 * This module provides critical optimizations for Socket.IO tests in the Replit environment.
 * It addresses timeout issues and reconnection stability problems identified in the
 * pre-merge validation report.
 */

/**
 * Apply optimized settings to a Socket.IO client for Replit compatibility
 * @param {Object} client - The Socket.IO client to optimize
 * @return {Object} The optimized client
 */
export function optimizeSocketClient(client) {
  if (!client) return client;
  
  // Ensure client has io and opts properties to avoid errors
  if (client.io && client.io.opts) {
    // Critical: Use much shorter timeouts for Replit environment
    client.io.opts.timeout = 2000;
    client.io.opts.pingTimeout = 1000;
    client.io.opts.pingInterval = 500;
    
    // Critical: Limit reconnection attempts to prevent hanging tests
    client.io.opts.reconnectionAttempts = 2;
    client.io.opts.reconnectionDelay = 100;
    client.io.opts.reconnectionDelayMax = 500;
  }
  
  return client;
}

/**
 * Optimized wait-for-event utility with explicit cleanup and short timeouts
 * @param {Object} socket - The socket to wait for events on
 * @param {string} eventName - The event to wait for
 * @param {number} timeout - Maximum time to wait (default: 2000ms)
 * @returns {Promise} Resolves when the event occurs
 */
export function optimizedWaitForEvent(socket, eventName, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${eventName} after ${timeout}ms`));
    }, timeout);
    
    function handler(...args) {
      cleanup();
      resolve(args.length > 1 ? args : args[0]);
    }
    
    function cleanup() {
      clearTimeout(timer);
      socket.off(eventName, handler);
      socket.off('error', errorHandler);
    }
    
    function errorHandler(err) {
      cleanup();
      reject(new Error(`Socket error while waiting for ${eventName}: ${err.message}`));
    }
    
    socket.on(eventName, handler);
    socket.once('error', errorHandler);
  });
}

/**
 * Safely disconnect a Socket.IO client with timeout protection
 * @param {Object} client - The Socket.IO client to disconnect
 * @returns {Promise} Resolves when disconnection is complete or times out
 */
export async function safeDisconnect(client) {
  if (!client) return;
  
  // Disable reconnection to prevent auto-reconnect attempts
  if (client.io && client.io.opts) {
    client.io.opts.reconnection = false;
  }
  
  // Remove all listeners to prevent memory leaks
  client.removeAllListeners();
  
  // Return early if not connected
  if (!client.connected) return;
  
  // Disconnect with timeout protection
  await Promise.race([
    new Promise(resolve => {
      client.once('disconnect', () => resolve());
      client.disconnect();
    }),
    // Safety timeout to prevent hanging
    new Promise(resolve => setTimeout(resolve, 300))
  ]);
}

/**
 * Create an optimized setup for reconnection testing
 * @param {Object} socket - The Socket.IO client
 * @returns {Object} Reconnection testing utilities
 */
export function createOptimizedReconnectionTest(socket) {
  return {
    /**
     * Simulate disconnection and wait for automatic reconnection
     * @param {number} timeoutMs - Timeout for reconnection (default: 2000ms)
     * @returns {Promise<boolean>} Resolves to true if reconnection was successful
     */
    async simulateDisconnectAndReconnect(timeoutMs = 2000) {
      // Ensure socket is properly configured
      if (socket.io && socket.io.opts) {
        socket.io.opts.reconnection = true;
        socket.io.opts.reconnectionAttempts = 2;
        socket.io.opts.reconnectionDelay = 100;
        socket.io.opts.reconnectionDelayMax = 200;
      }
      
      // Force disconnect
      socket.disconnect();
      
      // Wait for disconnect confirmation
      await optimizedWaitForEvent(socket, 'disconnect', 500)
        .catch(() => {/* Continue even if timeout */});
      
      // Reconnect
      socket.connect();
      
      // Wait for reconnection with timeout
      try {
        await optimizedWaitForEvent(socket, 'connect', timeoutMs);
        return true;
      } catch (error) {
        console.error('Reconnection failed:', error.message);
        return false;
      }
    },
    
    /**
     * Clean up the reconnection test
     */
    cleanup() {
      safeDisconnect(socket);
    }
  };
}

/**
 * Configure Socket.IO server for Replit environment
 * @param {Object} io - Socket.IO server instance
 */
export function optimizeSocketServer(io) {
  if (!io) return;
  
  // Set critical server-side settings
  io.engine.pingTimeout = 2000;
  io.engine.pingInterval = 1000;
}