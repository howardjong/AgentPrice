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

// Setup test environment
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
  
  // Create Socket.IO server with error handlers
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket']
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
  httpServer.listen(port);
  
  return {
    io,
    httpServer,
    port,
    errorHandlers,
    createClient: () => {
      return ioc(`http://localhost:${port}`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 100,
        timeout: 1000
      });
    },
    cleanup: () => {
      return new Promise((resolve) => {
        httpServer.close(() => {
          io.close();
          resolve();
        });
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
    await testEnv.cleanup();
  });
  
  it('should connect successfully and handle basic communication', () => {
    return new Promise((resolve, reject) => {
      const client = testEnv.createClient();
      const testData = { message: 'hello' };
      
      client.on('connect', () => {
        client.emit('echo', testData);
      });
      
      client.on('echo_response', (data) => {
        try {
          expect(data).toEqual(testData);
          client.disconnect();
          resolve();
        } catch (err) {
          client.disconnect();
          reject(err);
        }
      });
      
      client.on('connect_error', (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client.disconnect();
        reject(new Error('Test timed out waiting for echo response'));
      }, 5000);
    });
  });
  
  it('should handle socket errors gracefully', () => {
    return new Promise((resolve, reject) => {
      const client = testEnv.createClient();
      
      client.on('connect', () => {
        // Trigger a socket error
        client.emit('trigger_error', 'socket');
      });
      
      // Short timeout to allow error handling to execute
      setTimeout(() => {
        try {
          // Verify error handler was called
          expect(testEnv.errorHandlers.socket).toHaveBeenCalled();
          client.disconnect();
          resolve();
        } catch (err) {
          client.disconnect();
          reject(err);
        }
      }, 100);
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client.disconnect();
        reject(new Error('Test timed out waiting for socket error handling'));
      }, 5000);
    });
  });
  
  it('should maintain server stability after socket errors', () => {
    return new Promise((resolve, reject) => {
      const client1 = testEnv.createClient();
      
      client1.on('connect', () => {
        // Trigger a socket error
        client1.emit('trigger_error', 'socket');
        
        // Wait a bit then connect another client to test server stability
        setTimeout(() => {
          const client2 = testEnv.createClient();
          
          client2.on('connect', () => {
            // If we can connect and communicate, server is still stable
            client2.emit('echo', { test: 'server-stability' });
          });
          
          client2.on('echo_response', (data) => {
            try {
              expect(data.test).toBe('server-stability');
              client1.disconnect();
              client2.disconnect();
              resolve();
            } catch (err) {
              client1.disconnect();
              client2.disconnect();
              reject(err);
            }
          });
          
          client2.on('connect_error', (err) => {
            client1.disconnect();
            reject(new Error(`Failed to connect second client - server unstable: ${err.message}`));
          });
        }, 100);
      });
      
      client1.on('connect_error', (err) => {
        reject(new Error(`Connection error for first client: ${err.message}`));
      });
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client1.disconnect();
        reject(new Error('Test timed out waiting for server stability test'));
      }, 5000);
    });
  });
  
  it('should handle abrupt disconnections gracefully', () => {
    return new Promise((resolve, reject) => {
      const client = testEnv.createClient();
      let reconnected = false;
      
      client.on('connect', () => {
        if (!reconnected) {
          // First connection, trigger a disconnect
          client.emit('trigger_error', 'disconnect');
          reconnected = true;
        } else {
          // Reconnected successfully
          client.disconnect();
          resolve();
        }
      });
      
      client.on('disconnect', (reason) => {
        // The client should automatically attempt to reconnect
        console.log('Client disconnected:', reason);
      });
      
      // If reconnection fails after attempts, fail the test
      setTimeout(() => {
        if (!reconnected) {
          client.disconnect();
          reject(new Error('Client failed to reconnect after disconnection'));
        }
      }, 1000);
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client.disconnect();
        reject(new Error('Test timed out waiting for reconnection'));
      }, 5000);
    });
  });
  
  it('should isolate errors to individual sockets', () => {
    return new Promise((resolve, reject) => {
      // Connect two clients
      const client1 = testEnv.createClient();
      const client2 = testEnv.createClient();
      
      let client1Connected = false;
      let client2Connected = false;
      let client1Received = false;
      let client2Received = false;
      
      function checkCompletion() {
        if (client1Connected && client2Connected && 
            client1Received && client2Received) {
          client1.disconnect();
          client2.disconnect();
          resolve();
        }
      }
      
      client1.on('connect', () => {
        client1Connected = true;
        
        // Trigger an error on this socket
        client1.emit('trigger_error', 'socket');
        
        // Also emit an echo message
        client1.emit('echo', { client: 1 });
      });
      
      client2.on('connect', () => {
        client2Connected = true;
        
        // Just emit a normal message
        client2.emit('echo', { client: 2 });
      });
      
      client1.on('echo_response', (data) => {
        try {
          expect(data.client).toBe(1);
          client1Received = true;
          checkCompletion();
        } catch (err) {
          client1.disconnect();
          client2.disconnect();
          reject(err);
        }
      });
      
      client2.on('echo_response', (data) => {
        try {
          expect(data.client).toBe(2);
          client2Received = true;
          checkCompletion();
        } catch (err) {
          client1.disconnect();
          client2.disconnect();
          reject(err);
        }
      });
      
      client1.on('connect_error', (err) => {
        client2.disconnect();
        reject(new Error(`Client 1 connection error: ${err.message}`));
      });
      
      client2.on('connect_error', (err) => {
        client1.disconnect();
        reject(new Error(`Client 2 connection error: ${err.message}`));
      });
      
      // Fail the test if we don't complete within a reasonable time
      setTimeout(() => {
        if (!client1Received || !client2Received) {
          client1.disconnect();
          client2.disconnect();
          reject(new Error('Test timed out waiting for echo responses'));
        }
      }, 5000);
    });
  });
});