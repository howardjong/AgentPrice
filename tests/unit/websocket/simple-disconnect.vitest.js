/**
 * Minimal Socket.IO Disconnect Test
 * 
 * This test uses a completely simplified approach to test disconnection,
 * focusing on reliability over complexity.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';

describe('Minimal Socket.IO Disconnect', () => {
  let server;
  let io;
  let port;
  let serverURL;
  let cleanupActions = [];
  
  // Set up global test environment
  beforeAll(() => {
    // Track all cleanup actions 
    cleanupActions = [];
    console.log('Setting up test suite');
  });
  
  // Ensure cleanup in all cases
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
  
  // Set up a fresh environment for each test
  beforeEach(() => {
    console.log('Setting up test environment');
    
    // Create HTTP server
    server = createServer();
    
    // Create Socket.IO server with minimal options
    io = new Server(server, {
      transports: ['websocket'],
      pingTimeout: 100,
      pingInterval: 50,
      connectTimeout: 200
    });
    
    // Choose random port to avoid conflicts
    port = 3000 + Math.floor(Math.random() * 1000);
    serverURL = `http://localhost:${port}`;
    
    // Start server
    server.listen(port);
    console.log(`Server started on port ${port}`);
    
    // Register cleanup
    cleanupActions.push(async () => {
      return new Promise(resolve => {
        if (server && server.listening) {
          console.log('Closing HTTP server');
          server.close(resolve);
        } else {
          resolve();
        }
      });
    });
  });
  
  // Clean up after each test
  afterEach(() => {
    console.log('Test completed, cleanup will be handled in afterAll');
  });
  
  it('should disconnect a client when requested', async () => {
    // Set up server-side handler
    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      socket.on('disconnect_me', () => {
        console.log(`Disconnecting client: ${socket.id}`);
        socket.disconnect(true);
      });
    });
    
    // Create client
    const client = ioc(serverURL, {
      transports: ['websocket'],
      reconnection: false
    });
    
    // Register cleanup for client
    cleanupActions.push(() => {
      console.log('Cleaning up client');
      client.removeAllListeners();
      if (client.connected) {
        client.disconnect();
      }
    });
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 1000);
      
      client.on('connect', () => {
        clearTimeout(timeout);
        console.log('Client connected');
        resolve();
      });
      
      client.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Connection error: ${err.message}`));
      });
    });
    
    // Verify connection
    expect(client.connected).toBe(true);
    
    // Request disconnect
    console.log('Requesting disconnect');
    client.emit('disconnect_me');
    
    // Wait for disconnect
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Disconnect timeout'));
      }, 1000);
      
      client.on('disconnect', () => {
        clearTimeout(timeout);
        console.log('Client disconnected');
        resolve();
      });
    });
    
    // Verify disconnection
    expect(client.connected).toBe(false);
    
    // Explicitly clean up client resources
    client.removeAllListeners();
    
    // Explicitly stop server and IO
    io.close();
    
    // Log test completion
    console.log('Disconnect test completed');
  });
});