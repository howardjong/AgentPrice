/**
 * Basic Socket.IO Test
 * Simple Socket.IO test with minimal functionality
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
    socket.on('ping', () => {
      socket.emit('pong', { time: Date.now() });
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
        io.disconnectSockets(true);
        
        const timeout = setTimeout(() => {
          resolve();
        }, 300);
        
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
        
        try {
          io.close();
        } catch (e) {
          console.error('Error closing Socket.IO server:', e);
        }
      });
    }
  };
}

describe('Socket.IO Basics', () => {
  let env;
  
  beforeEach(() => {
    env = createTestEnv();
  });
  
  afterEach(async () => {
    await env.cleanup();
  });
  
  it('should connect and handle ping/pong', async () => {
    const client = ioc(`http://localhost:${env.port}`, {
      transports: ['websocket'],
      timeout: 300
    });
    
    try {
      // Wait for connection with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 300);
        client.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      // Test ping/pong with timeout
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Ping timeout')), 300);
        client.on('pong', (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
        client.emit('ping');
      });
      
      expect(response).toHaveProperty('time');
      expect(typeof response.time).toBe('number');
    } finally {
      if (client.connected) {
        client.disconnect();
      }
    }
  });
});