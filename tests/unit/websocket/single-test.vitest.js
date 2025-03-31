/**
 * Single Test File for Socket.IO
 * 
 * This contains a single test to verify basic Socket.IO functionality
 * without complex reconnection logic that could cause timeouts.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

describe('Socket.IO Single Test', () => {
  // Test environment state
  let server, io, client, port;
  
  // Basic setup and teardown for each test
  afterEach(async () => {
    // Always disconnect client first
    if (client && client.connected) {
      client.disconnect();
    }
    
    // Then close server if it exists
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
        
        // Close HTTP server with timeout
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
  
  it('should connect and exchange basic messages', async () => {
    // Create express app and HTTP server
    const app = express();
    server = createServer(app);
    
    // Set up Socket.IO server
    io = new Server(server, {
      cors: { origin: '*' },
      transports: ['websocket'],
      pingTimeout: 100,
      pingInterval: 50,
      connectTimeout: 200
    });
    
    // Setup simple echo handler
    io.on('connection', (socket) => {
      socket.on('echo', (data) => {
        socket.emit('echo_response', data);
      });
    });
    
    // Start server on random port
    port = 3000 + Math.floor(Math.random() * 1000);
    server.listen(port);
    
    // Connect client
    client = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      timeout: 200
    });
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 200);
      
      client.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      client.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Connection error: ${err.message}`));
      });
    });
    
    // Send echo request and wait for response
    const echoData = { message: 'Hello, Socket.IO!' };
    
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Echo response timeout'));
      }, 200);
      
      client.on('echo_response', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      
      client.emit('echo', echoData);
    });
    
    // Verify response
    expect(response).toEqual(echoData);
    
    // Verify client is connected
    expect(client.connected).toBe(true);
    
    // Disconnect client explicitly
    client.disconnect();
  });
});