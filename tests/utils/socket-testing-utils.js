/**
 * Socket.IO Testing Utilities
 * 
 * Utilities for testing Socket.IO applications in a reliable way.
 * Implements the patterns from our SOCKET_IO_TESTING_PATTERNS documentation
 * to prevent timeouts and ensure proper resource cleanup.
 */

const io = require('socket.io-client');
const { Server } = require('socket.io');
const express = require('express');
const { createServer } = require('http');

/**
 * Sets up a Socket.IO client with explicit connection control
 * @param {string} url The URL to connect to (e.g., 'http://localhost:3000')
 * @param {Object} options Socket.IO client options
 * @returns {Promise<Object>} A promise that resolves to the connected socket
 */
const setupSocketIOClient = async (url = 'http://localhost:3000', options = {}) => {
  // Create socket with explicit error and connection timeout handling
  const socket = io(url, {
    reconnection: false,  // Disable automatic reconnection for tests
    timeout: 5000,        // Set a reasonable connection timeout
    forceNew: true,       // Force a new connection
    ...options
  });
  
  // Create a promise that resolves on connect or rejects on error or timeout
  return new Promise((resolve, reject) => {
    // Set a timeout limit for the connection
    const connectTimeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, 3000);
    
    // Handle successful connection
    socket.on('connect', () => {
      clearTimeout(connectTimeout);
      resolve(socket);
    });
    
    // Handle connection errors
    socket.on('connect_error', (err) => {
      clearTimeout(connectTimeout);
      socket.disconnect();
      reject(new Error(`Socket connection error: ${err.message}`));
    });
  });
};

/**
 * Sets up a test server with Socket.IO
 * @returns {Promise<Object>} A promise that resolves to an object containing server, cleanup function, and URL
 */
const setupSocketServer = async () => {
  // Create Express app and HTTP server
  const app = express();
  const httpServer = createServer(app);
  
  // Create Socket.IO server
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  
  // Start server on dynamic port
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  const serverUrl = `http://localhost:${port}`;
  
  // Set up connection handling
  io.on('connection', (socket) => {
    // Default connection handling
    socket.on('disconnect', () => {
      // Clean up resources on disconnect
    });
  });
  
  // Create a cleanup function
  const cleanup = async () => {
    return new Promise((resolve) => {
      io.close(() => {
        httpServer.close(() => {
          resolve();
        });
      });
    });
  };
  
  return {
    app,
    httpServer,
    io,
    serverUrl,
    cleanup
  };
};

/**
 * Wait for a specific event with timeout
 * @param {Object} socket The socket.io client or server socket
 * @param {string} event The event to wait for
 * @param {number} timeout Maximum time to wait in milliseconds
 * @returns {Promise<any>} A promise that resolves to the event data
 */
const waitForEvent = (socket, event, timeout = 2000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);
    
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
};

/**
 * Create a mock socket for unit testing
 * @returns {Object} A mock socket object with essential Socket.IO methods mocked
 */
const createSocketMock = () => {
  const events = {};
  
  return {
    // Mock emit method
    emit: vi.fn((event, ...args) => {
      // Call any registered listeners
      if (events[event]) {
        events[event].forEach(listener => listener(...args));
      }
      return true;
    }),
    
    // Mock on method
    on: vi.fn((event, callback) => {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].push(callback);
    }),
    
    // Mock once method
    once: vi.fn((event, callback) => {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].push((...args) => {
        // Remove this listener after first call
        const index = events[event].indexOf(callback);
        if (index !== -1) {
          events[event].splice(index, 1);
        }
        callback(...args);
      });
    }),
    
    // Mock removeListener
    removeListener: vi.fn((event, callback) => {
      if (events[event]) {
        const index = events[event].indexOf(callback);
        if (index !== -1) {
          events[event].splice(index, 1);
        }
      }
    }),
    
    // Mock disconnect
    disconnect: vi.fn(() => {
      if (events['disconnect']) {
        events['disconnect'].forEach(listener => listener());
      }
    }),
    
    // Socket state properties
    connected: true,
    id: 'mock-socket-id'
  };
};

/**
 * Comprehensive cleanup function for Socket.IO tests
 * @param {Array} clients Array of client sockets to clean up
 * @param {Object} io The Socket.IO server instance
 * @param {Object} httpServer The HTTP server instance
 * @returns {Promise<void>} A promise that resolves when cleanup is complete
 */
const cleanup = async (clients = [], io = null, httpServer = null) => {
  try {
    // Disconnect clients first
    if (clients && clients.length) {
      for (const client of clients) {
        if (client && typeof client.disconnect === 'function') {
          client.disconnect();
          
          // Wait a bit for disconnect to complete
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    // Close the IO server
    if (io) {
      await new Promise((resolve) => {
        io.close(() => resolve());
      });
    }
    
    // Close the HTTP server
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  } catch (error) {
    console.error('Error during Socket.IO cleanup:', error);
  }
};

/**
 * Verify the state of a socket
 * @param {Object} socket The socket to verify
 * @param {Object} expectedState Object with expected state properties
 */
const verifySocketState = (socket, expectedState) => {
  expect(socket.connected).toBe(expectedState.connected);
  
  if (expectedState.connected) {
    expect(socket.id).toBeTruthy();
  }
};

module.exports = {
  setupSocketIOClient,
  setupSocketServer,
  waitForEvent,
  createSocketMock,
  cleanup,
  verifySocketState
};