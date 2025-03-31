/**
 * Minimal WebSocket Error Test
 * Testing only the most basic error functionality
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
  const socketErrorHandler = vi.fn();
  
  // Create Socket.IO server with minimal handlers
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket']
  });
  
  // Setup basic echo functionality and error triggering
  io.on('connection', (socket) => {
    socket.on('echo', (data) => {
      socket.emit('echo_response', data);
    });
    
    socket.on('trigger_error', () => {
      socketErrorHandler(new Error('Test error'));
      socket.emit('error_triggered');
    });
    
    socket.on('error', (err) => {
      socketErrorHandler(err);
    });
  });
  
  // Start server on random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  const server = httpServer.listen(port);
  
  return {
    port,
    server,
    io,
    socketErrorHandler,
    cleanup: () => {
      io.disconnectSockets(true);
      io.close();
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 300);
        
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };
}

describe('Minimal WebSocket Error Tests', () => {
  let env;
  
  beforeEach(() => {
    env = createTestEnv();
  });
  
  afterEach(async () => {
    await env.cleanup();
  });
  
  it('should handle basic error triggering', async () => {
    // Reset the mock
    env.socketErrorHandler.mockReset();
    
    // Create client
    const client = ioc(`http://localhost:${env.port}`, {
      transports: ['websocket'],
      timeout: 300
    });
    
    try {
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 300);
        client.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      // Trigger error and wait for confirmation
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Error trigger timeout')), 300);
        client.on('error_triggered', () => {
          clearTimeout(timeout);
          resolve();
        });
        client.emit('trigger_error');
      });
      
      // Wait a bit for the error handler to be called
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify error handler was called
      expect(env.socketErrorHandler).toHaveBeenCalled();
    } finally {
      // Always disconnect
      if (client.connected) {
        client.disconnect();
      }
    }
  });
});