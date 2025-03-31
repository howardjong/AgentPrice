/**
 * Ultra-Simplified Socket.IO Disconnect Test
 * 
 * This test focuses on verifying the most basic disconnect functionality
 * with minimal complexity to demonstrate reliable testing patterns.
 * It uses improved error handling and explicit cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';

// Test constants
const PORT = 3000 + Math.floor(Math.random() * 1000);
const SERVER_URL = `http://localhost:${PORT}`;
const CONNECT_TIMEOUT = 500;
const RECONNECT_TIMEOUT = 1000;

describe('Socket.IO Basic Reconnection', () => {
  // Test resources that need explicit cleanup
  let httpServer;
  let io;
  let client;
  let cleanupActions = [];
  
  // Set up a global test environment
  beforeAll(() => {
    // Initialize cleanup tracking
    cleanupActions = [];
    console.log('Setting up test environment');
  });
  
  // Clean up all resources after tests
  afterAll(async () => {
    console.log('Running final cleanup');
    
    // Execute all cleanup actions in reverse order
    while (cleanupActions.length > 0) {
      const cleanup = cleanupActions.pop();
      try {
        await cleanup();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
    console.log('All cleanup completed');
  });
  
  // Create a fresh Socket.IO server for each test
  beforeEach(async () => {
    console.log(`Setting up server on port ${PORT}`);
    
    try {
      // Create and start HTTP server
      httpServer = createServer();
      
      // Create Socket.IO server with minimal configuration
      io = new Server(httpServer, {
        transports: ['websocket'],
        pingTimeout: 100,
        pingInterval: 50,
        connectTimeout: 200
      });
      
      // Register connection handler
      io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        
        // Simple message echo
        socket.on('ping', () => {
          console.log(`Received ping from ${socket.id}`);
          socket.emit('pong');
        });
      });
      
      // Start server
      await new Promise((resolve, reject) => {
        try {
          httpServer.listen(PORT, () => {
            console.log(`Server listening on ${PORT}`);
            resolve();
          });
          
          httpServer.on('error', (err) => {
            console.error('HTTP server error:', err);
            reject(err);
          });
        } catch (err) {
          console.error('Failed to start server:', err);
          reject(err);
        }
      });
      
      // Register server cleanup
      cleanupActions.push(async () => {
        return new Promise((resolve) => {
          console.log('Cleaning up Socket.IO server');
          if (io) {
            io.close();
            io = null;
          }
          resolve();
        });
      });
      
      cleanupActions.push(async () => {
        return new Promise((resolve) => {
          console.log('Cleaning up HTTP server');
          if (httpServer && httpServer.listening) {
            httpServer.close(resolve);
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      console.error('Setup failed:', err);
      throw err;
    }
  });
  
  // Clean up after each test
  afterEach(() => {
    console.log('Test completed, cleanup will be handled in afterAll');
  });
  
  // Test socket connection
  it('should connect, disconnect, and reconnect a client', async () => {
    try {
      // Create client with reconnection enabled
      client = ioc(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 3
      });
      
      // Register client cleanup
      cleanupActions.push(() => {
        console.log('Cleaning up client');
        if (client) {
          client.removeAllListeners();
          if (client.connected) {
            client.disconnect();
          }
          client = null;
        }
      });
      
      // Wait for initial connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, CONNECT_TIMEOUT);
        
        client.once('connect', () => {
          clearTimeout(timeout);
          console.log('Client connected');
          resolve();
        });
        
        client.once('connect_error', (err) => {
          clearTimeout(timeout);
          reject(new Error(`Connection error: ${err.message}`));
        });
      });
      
      // Verify connection
      expect(client.connected).toBe(true);
      
      // Test communication
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, CONNECT_TIMEOUT);
        
        client.once('pong', () => {
          clearTimeout(timeout);
          resolve('pong received');
        });
        
        client.emit('ping');
      });
      
      expect(response).toBe('pong received');
      
      // Forcibly close server (simulating crash)
      console.log('Simulating server crash...');
      io.close();
      await new Promise(resolve => {
        httpServer.close(resolve);
      });
      
      // Recreate server
      console.log('Recreating server...');
      httpServer = createServer();
      io = new Server(httpServer, {
        transports: ['websocket'],
        pingTimeout: 100,
        pingInterval: 50,
        connectTimeout: 200
      });
      
      io.on('connection', (socket) => {
        console.log(`Client reconnected: ${socket.id}`);
        socket.on('ping', () => {
          socket.emit('pong');
        });
      });
      
      // Start server again
      await new Promise((resolve) => {
        httpServer.listen(PORT, resolve);
      });
      
      // Wait for reconnection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reconnection timeout'));
        }, RECONNECT_TIMEOUT);
        
        // Need to use 'connect' event for reconnection as well
        client.once('connect', () => {
          clearTimeout(timeout);
          console.log('Client reconnected');
          resolve();
        });
      });
      
      // Verify reconnection
      expect(client.connected).toBe(true);
      
      // Test communication after reconnection
      const reconnectResponse = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Ping timeout after reconnect'));
        }, CONNECT_TIMEOUT);
        
        client.once('pong', () => {
          clearTimeout(timeout);
          resolve('pong received after reconnect');
        });
        
        client.emit('ping');
      });
      
      expect(reconnectResponse).toBe('pong received after reconnect');
      
      // Clean up client explicitly here for guaranteed cleanup
      client.removeAllListeners();
      client.disconnect();
      
      // Clean up server explicitly
      io.close();
      await new Promise(resolve => {
        httpServer.close(resolve);
      });
      
      console.log('Test completed successfully');
    } catch (err) {
      console.error('Test failed:', err);
      
      // Attempt cleanup even on test failure
      try {
        if (client) {
          client.removeAllListeners();
          if (client.connected) {
            client.disconnect();
          }
        }
        
        if (io) {
          io.close();
        }
        
        if (httpServer && httpServer.listening) {
          await new Promise(resolve => {
            httpServer.close(resolve);
          });
        }
      } catch (cleanupErr) {
        console.error('Cleanup failed:', cleanupErr);
      }
      
      throw err;
    }
  }, 10000); // Increase test timeout to 10 seconds
});