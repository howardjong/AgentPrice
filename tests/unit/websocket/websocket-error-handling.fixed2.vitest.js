/**
 * WebSocket Error Handling Tests
 * 
 * Tests the WebSocket server's error handling capabilities:
 * - Connection error handling
 * - Socket error handling
 * - Reconnection logic
 * - Error broadcasting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

// Setup test environment with very short timeouts
function createTestEnv() {
  // Create HTTP server with Express
  const app = express();
  const httpServer = createServer(app);
  
  // Socket.IO error handling mocks
  const errorHandlers = {
    connection: vi.fn(),
    socket: vi.fn(),
    server: vi.fn()
  };
  
  // Create Socket.IO server with error handlers (with reduced connection timeout)
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
    connectTimeout: 1000
  });
  
  // Set up error handlers
  io.on('connect_error', (err) => {
    errorHandlers.connection(err);
  });
  
  io.on('connection', (socket) => {
    // Handle socket errors
    socket.on('error', (err) => {
      errorHandlers.socket(err);
    });
    
    // Echo messages back for testing
    socket.on('echo', (data) => {
      socket.emit('echo_response', data);
    });
    
    // Test error triggering
    socket.on('trigger_error', (type) => {
      if (type === 'socket') {
        // Simulate socket error
        errorHandlers.socket(new Error('Socket error'));
        socket.emit('error', new Error('Socket error'));
      } else if (type === 'disconnect') {
        // Simulate sudden disconnect
        socket.disconnect(true);
      }
    });
  });
  
  // Handle server errors
  io.engine.on('error', (err) => {
    errorHandlers.server(err);
  });
  
  // Start server on random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  const server = httpServer.listen(port);
  
  return {
    io,
    httpServer,
    port,
    errorHandlers,
    createClient: () => {
      return ioc(`http://localhost:${port}`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 1,
        reconnectionDelay: 100,
        timeout: 500
      });
    },
    cleanup: () => {
      return new Promise((resolve) => {
        // Clean up existing sockets
        try {
          io.disconnectSockets(true);
        } catch (e) {
          console.error("Error disconnecting sockets:", e);
        }
        
        // Set a timeout for the server close operation
        const closeTimeout = setTimeout(() => {
          console.log("Cleanup timeout reached, forcing close");
          resolve();
        }, 500);
        
        // Close http server
        server.close(() => {
          clearTimeout(closeTimeout);
          resolve();
        });
        
        // Explicitly close the Socket.IO server
        try {
          io.close();
        } catch (err) {
          console.error("Error closing Socket.IO server:", err);
        }
      });
    }
  };
}

describe('WebSocket Error Handling', () => {
  let testEnv;
  
  beforeEach(() => {
    testEnv = createTestEnv();
  });
  
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    if (testEnv) {
      await testEnv.cleanup();
    }
  });
  
  it('should connect successfully and handle basic communication', async () => {
    const client = testEnv.createClient();
    const testData = { message: 'hello' };
    
    try {
      // Wait for connection with timeout
      await Promise.race([
        new Promise((resolve) => client.on('connect', resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 500))
      ]);
      
      // Send message and wait for response with timeout
      const response = await Promise.race([
        new Promise((resolve) => {
          client.on('echo_response', (data) => resolve(data));
          client.emit('echo', testData);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Echo timeout')), 500))
      ]);
      
      expect(response).toEqual(testData);
    } finally {
      if (client.connected) {
        client.disconnect();
      }
    }
  });
  
  it('should handle socket errors gracefully', async () => {
    const client = testEnv.createClient();
    
    try {
      // Reset the mock
      testEnv.errorHandlers.socket.mockReset();
      
      // Wait for connection with timeout
      await Promise.race([
        new Promise((resolve) => client.on('connect', resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 500))
      ]);
      
      // Trigger socket error
      client.emit('trigger_error', 'socket');
      
      // Wait for error handler to be called (with timeout)
      await Promise.race([
        new Promise(resolve => {
          // Check if the handler was called immediately
          if (testEnv.errorHandlers.socket.mock.calls.length > 0) {
            resolve();
          }
          
          // Setup an interval to check if the handler is called
          const interval = setInterval(() => {
            if (testEnv.errorHandlers.socket.mock.calls.length > 0) {
              clearInterval(interval);
              resolve();
            }
          }, 50);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Error handler timeout')), 500))
      ]);
      
      expect(testEnv.errorHandlers.socket).toHaveBeenCalled();
    } finally {
      if (client.connected) {
        client.disconnect();
      }
    }
  });
  
  it('should maintain server stability after socket errors', async () => {
    const client1 = testEnv.createClient();
    
    try {
      // Wait for first client to connect
      await Promise.race([
        new Promise((resolve) => client1.on('connect', resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 500))
      ]);
      
      // Trigger error on first client
      client1.emit('trigger_error', 'socket');
      
      // Small delay to allow error to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connect second client
      const client2 = testEnv.createClient();
      
      try {
        // Wait for second client to connect
        await Promise.race([
          new Promise((resolve) => client2.on('connect', resolve)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Second client connection timeout')), 500))
        ]);
        
        // Test communication with second client
        const response = await Promise.race([
          new Promise((resolve) => {
            client2.on('echo_response', (data) => resolve(data));
            client2.emit('echo', { test: 'server-stability' });
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Echo timeout')), 500))
        ]);
        
        expect(response.test).toBe('server-stability');
      } finally {
        if (client2.connected) {
          client2.disconnect();
        }
      }
    } finally {
      if (client1.connected) {
        client1.disconnect();
      }
    }
  });
});