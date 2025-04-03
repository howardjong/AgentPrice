/**
 * Optimized Socket.IO Reconnection Test
 * 
 * This test demonstrates the use of optimized utilities for Socket.IO testing
 * in the Replit environment. It addresses the specific issues highlighted
 * in the pre-merge validation report.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import getPort from 'get-port';
import { 
  optimizeSocketClient, 
  optimizedWaitForEvent, 
  safeDisconnect,
  createOptimizedReconnectionTest,
  optimizeSocketServer
} from '../utils/socket-test-optimization.js';

describe('Optimized Socket.IO Reconnection Test', () => {
  let port;
  let app;
  let httpServer;
  let io;
  let client;
  
  beforeEach(async () => {
    // Get a random available port
    port = await getPort();
    
    // Set up Express app and HTTP server
    app = express();
    httpServer = createServer(app);
    
    // Set up Socket.IO server
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });
    
    // Apply optimization to the server
    optimizeSocketServer(io);
    
    // Basic server-side event handling
    io.on('connection', (socket) => {
      console.log(`Server: Client connected - ${socket.id}`);
      
      socket.on('ping', () => {
        socket.emit('pong', { time: Date.now() });
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`Server: Client disconnected - ${socket.id}, reason: ${reason}`);
      });
    });
    
    // Start server
    await new Promise(resolve => httpServer.listen(port, resolve));
    
    // Create client with reconnection enabled
    client = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true
    });
    
    // Apply optimizations to the client
    optimizeSocketClient(client);
  });
  
  afterEach(async () => {
    // Use safe disconnect for the client
    await safeDisconnect(client);
    
    // Close server with timeout protection
    await Promise.race([
      new Promise(resolve => {
        io?.close(() => {
          httpServer?.close(resolve);
        });
      }),
      new Promise(resolve => setTimeout(resolve, 500))
    ]);
  });
  
  /**
   * Test case: Basic reconnection with optimized settings
   */
  it('should reconnect automatically with optimized settings', async () => {
    // Set up reconnection tester
    const reconnectionTest = createOptimizedReconnectionTest(client);
    
    try {
      // Connect initially
      await optimizedWaitForEvent(client, 'connect', 2000);
      expect(client.connected).toBe(true);
      
      // Test initial connection with ping-pong
      client.emit('ping');
      await optimizedWaitForEvent(client, 'pong', 1000);
      
      // Simulate disconnect and reconnect
      const reconnected = await reconnectionTest.simulateDisconnectAndReconnect(2000);
      expect(reconnected).toBe(true);
      expect(client.connected).toBe(true);
      
      // Verify connection still works after reconnection
      client.emit('ping');
      await optimizedWaitForEvent(client, 'pong', 1000);
    } finally {
      // Always clean up
      reconnectionTest.cleanup();
    }
  }, 10000); // 10 second timeout (much shorter than previous 30 second timeout)
});