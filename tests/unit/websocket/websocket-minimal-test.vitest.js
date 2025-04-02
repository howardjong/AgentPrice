/**
 * Minimal WebSocket Test
 * Just testing the most basic functionality to debug timeouts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

// Setup test environment
function createTestEnv() {
  // Create HTTP server with Express
  const app = express();
  const httpServer = createServer(app);
  
  // Create Socket.IO server
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket']
  });
  
  // Setup basic echo functionality
  io.on('connection', (socket) => {
    socket.on('echo', (data) => {
      socket.emit('echo_response', data);
    });
  });
  
  // Start server on random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  const server = httpServer.listen(port);
  
  return {
    port,
    server,
    io,
    cleanup: () => {
      return new Promise((resolve) => {
        // Force close all connections
        io.disconnectSockets(true);
        
        // Set a timeout for server.close()
        const timeout = setTimeout(() => {
          console.log('Server close timed out, forcing exit');
          resolve();
        }, 500);
        
        // Attempt to close the server
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
        
        // Clean IO explicitly
        try {
          io.close();
        } catch (e) {
          console.error('Error closing IO:', e);
        }
      });
    }
  };
}

// A single very basic test with early timeouts
describe('Minimal WebSocket Test', () => {
  let env;
  
  beforeEach(() => {
    env = createTestEnv();
  });
  
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    // Ensure cleanup runs even if test fails
    if (env && env.cleanup) {
      await env.cleanup();
    }
  });
  
  it('should connect and echo a message', async () => {
    // Create a client with very short timeouts
    const client = ioc(`http://localhost:${env.port}`, {
      transports: ['websocket'],
      timeout: 500,
      reconnectionAttempts: 1
    });
    
    try {
      // Wait for connection with a short timeout
      await Promise.race([
        new Promise((resolve) => client.on('connect', resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 500))
      ]);
      
      // Send and receive a message
      const response = await Promise.race([
        new Promise((resolve) => {
          client.on('echo_response', (data) => resolve(data));
          client.emit('echo', { test: 'hello' });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Echo timeout')), 500))
      ]);
      
      expect(response).toEqual({ test: 'hello' });
    } finally {
      // Always disconnect the client
      if (client.connected) {
        client.disconnect();
      }
    }
  });
});