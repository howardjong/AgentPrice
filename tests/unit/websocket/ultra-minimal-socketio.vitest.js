/**
 * Ultra Minimal Socket.IO Test
 * 
 * This test file contains the absolute minimal test setup to verify
 * basic Socket.IO functionality while avoiding timeout issues.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

// Simplified test environment creation
function createTestEnv() {
  // Create HTTP server with Express
  const app = express();
  const httpServer = createServer(app);
  
  // Create Socket.IO server with minimal options
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
    pingTimeout: 200,
    pingInterval: 100,
    connectTimeout: 300
  });
  
  // Setup basic echo functionality
  io.on('connection', (socket) => {
    socket.on('ping', () => {
      socket.emit('pong', { success: true });
    });
  });
  
  // Start server on random port
  const port = 3000 + Math.floor(Math.random() * 1000);
  const server = httpServer.listen(port);
  
  return {
    port,
    server,
    io,
    cleanup: () => {
      return new Promise((resolve) => {
        // Force close all connections
        try {
          io.disconnectSockets(true);
        } catch (e) {
          console.error('Error disconnecting sockets:', e);
        }
        
        // Set a timeout for server.close()
        const timeout = setTimeout(() => {
          console.log('Server close timed out, forcing exit');
          resolve();
        }, 300);
        
        // Attempt to close the server
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
        
        // Explicitly close io
        try {
          io.close();
        } catch (e) {
          console.error('Error closing IO:', e);
        }
      });
    }
  };
}

describe('Ultra Minimal Socket.IO Test', () => {
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
  
  it('should connect and receive pong response', async () => {
    // Create a client with very short timeouts
    const client = ioc(`http://localhost:${env.port}`, {
      transports: ['websocket'],
      timeout: 300,
    });
    
    try {
      // Wait for connection with a short timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 300);
        
        client.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          reject(new Error(`Connection error: ${err.message}`));
        });
      });
      
      // Send ping and wait for pong
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Pong timeout'));
        }, 300);
        
        client.on('pong', (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
        
        client.emit('ping');
      });
      
      // Check response
      expect(response).toHaveProperty('success');
      expect(response.success).toBe(true);
    } finally {
      // Always disconnect the client
      if (client.connected) {
        client.disconnect();
      }
    }
  });
});