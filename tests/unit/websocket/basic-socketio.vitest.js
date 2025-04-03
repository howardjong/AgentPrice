/**
 * Basic Socket.IO Test
 * 
 * This test verifies the most basic Socket.IO functionality without
 * complex features that could cause timeouts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

describe('Basic Socket.IO Test', () => {
  // Test environment state
  let server, io, port, client;
  
  beforeEach(() => {
    // Set up fresh server for each test
    const app = express();
    server = createServer(app);
    
    // Create Socket.IO server with minimal config
    io = new Server(server, {
      cors: { origin: '*' },
      transports: ['websocket'],
      pingTimeout: 100,
      pingInterval: 50,
      connectTimeout: 100
    });
    
    // Start server on random port
    port = 3000 + Math.floor(Math.random() * 1000);
    server.listen(port);
  });
  
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    client?.removeAllListeners();
    // Clean up in reverse order of creation
    
    // 1. Disconnect client if it exists
    if (client) {
      if (client.connected) {
        client.disconnect();
      }
      client = null;
    }
    
    // 2. Clean up server with timeout to prevent hanging
    if (server) {
      await new Promise((resolve) => {
        // Force disconnect all sockets
        if (io) {
          try {
            io.disconnectSockets(true);
            io.close();
          } catch (e) {
            console.error('Error closing io:', e);
          }
        }
        
        // Set short timeout for server close
        const timeout = setTimeout(() => {
          console.log('Server close timed out, forcing exit');
          resolve();
        }, 100);
        
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  });
  
  it('should connect and receive events', async () => {
    // Setup the event handler on the server
    io.on('connection', (socket) => {
      socket.on('ping', () => {
        socket.emit('pong', { time: Date.now() });
      });
    });
    
    // Create client - do this late to ensure server is ready
    client = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      timeout: 100
    });
    
    // Wait for connection
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
    
    // Test sending and receiving a simple message
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Pong timeout'));
      }, 300);
      
      client.once('pong', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      
      client.emit('ping');
    });
    
    // Verify response
    expect(response).toHaveProperty('time');
    expect(typeof response.time).toBe('number');
  });
  
  it('should handle custom events', async () => {
    // Setup event handler
    io.on('connection', (socket) => {
      socket.on('custom_event', (data) => {
        socket.emit('custom_response', {
          received: data,
          processed: true
        });
      });
    });
    
    // Create client
    client = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      timeout: 100
    });
    
    // Wait for connection
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
    
    // Send custom event
    const testData = { test: 'data', value: 123 };
    
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Custom response timeout'));
      }, 300);
      
      client.once('custom_response', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      
      client.emit('custom_event', testData);
    });
    
    // Verify response
    expect(response).toHaveProperty('received');
    expect(response).toHaveProperty('processed');
    expect(response.received).toEqual(testData);
    expect(response.processed).toBe(true);
  });
});