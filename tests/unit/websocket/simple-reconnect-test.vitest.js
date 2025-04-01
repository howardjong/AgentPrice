/**
 * Simple Socket.IO Reconnection Test
 * 
 * A simplified test for Socket.IO reconnection to isolate potential issues.
 */

import { describe, it, expect } from 'vitest';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import getPort from 'get-port';

describe('Simple Socket.IO Reconnection', () => {
  it('should handle basic reconnection', async () => {
    console.log('Starting simple reconnection test');
    
    // Get a random port
    const port = await getPort();
    
    // Setup
    let httpServer;
    let io;
    let client;
    let serverInstance = 1;
    
    // Create first server
    httpServer = createServer();
    io = new Server(httpServer);
    
    // Setup server connection handler
    io.on('connection', socket => {
      console.log(`Server ${serverInstance}: Client connected: ${socket.id}`);
      
      socket.on('ping', () => {
        console.log(`Server ${serverInstance}: Ping received from ${socket.id}`);
        socket.emit('pong', { 
          time: Date.now(), 
          server: serverInstance 
        });
      });
    });
    
    // Start the server
    await new Promise(resolve => httpServer.listen(port, resolve));
    console.log(`Server ${serverInstance} started on port ${port}`);
    
    try {
      // Create client with reconnection enabled
      client = SocketIOClient(`http://localhost:${port}`, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 100,
        timeout: 5000
      });
      
      // Setup client event tracking
      client.on('connect', () => {
        console.log(`Client connected: ${client.id}`);
      });
      
      client.on('disconnect', reason => {
        console.log(`Client disconnected: ${client.id}, reason: ${reason}`);
      });
      
      client.on('connect_error', err => {
        console.log(`Connection error: ${err.message}`);
      });
      
      client.on('reconnect_attempt', attempt => {
        console.log(`Reconnection attempt ${attempt}`);
      });
      
      // Wait for initial connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);
        
        client.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      console.log('Initial connection complete');
      expect(client.connected).toBe(true);
      
      // Send a ping and wait for pong
      const initialPong = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, 2000);
        
        client.once('pong', (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
        
        console.log('Sending ping to server 1');
        client.emit('ping');
      });
      
      // Verify server 1 response
      expect(initialPong.server).toBe(1);
      console.log('Initial ping-pong verified');
      
      // Store original socket ID
      const originalSocketId = client.id;
      
      // Close the server
      console.log('Closing server 1');
      await new Promise(resolve => {
        io.close();
        httpServer.close(resolve);
      });
      console.log('Server 1 closed');
      
      // Wait for disconnect
      await new Promise((resolve, reject) => {
        if (!client.connected) {
          console.log('Already disconnected');
          resolve();
          return;
        }
        
        const timeout = setTimeout(() => {
          reject(new Error('Disconnect timeout'));
        }, 2000);
        
        client.once('disconnect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      expect(client.connected).toBe(false);
      console.log('Disconnect verified');
      
      // Create server 2
      serverInstance = 2;
      httpServer = createServer();
      io = new Server(httpServer);
      
      // Setup server 2 connection handler (same as server 1)
      io.on('connection', socket => {
        console.log(`Server ${serverInstance}: Client connected: ${socket.id}`);
        
        socket.on('ping', () => {
          console.log(`Server ${serverInstance}: Ping received from ${socket.id}`);
          socket.emit('pong', { 
            time: Date.now(), 
            server: serverInstance 
          });
        });
      });
      
      // Start server 2
      await new Promise(resolve => httpServer.listen(port, resolve));
      console.log(`Server ${serverInstance} started on port ${port}`);
      
      // Wait for reconnection (with a longer timeout since reconnection may take time)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reconnection timeout'));
        }, 5000);
        
        client.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      console.log('Reconnection complete');
      expect(client.connected).toBe(true);
      
      // Verify reconnected to a different socket ID
      expect(client.id).not.toBe(originalSocketId);
      console.log(`Original socket ID: ${originalSocketId}, new socket ID: ${client.id}`);
      
      // Send a ping to server 2
      const reconnectPong = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reconnect ping timeout'));
        }, 2000);
        
        client.once('pong', (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
        
        console.log('Sending ping to server 2');
        client.emit('ping');
      });
      
      // Verify server 2 response
      expect(reconnectPong.server).toBe(2);
      console.log('Reconnect ping-pong verified');
      
      // Test complete
      console.log('Test completed successfully');
    } finally {
      // Cleanup
      if (client) {
        try {
          client.disconnect();
          client.removeAllListeners();
          console.log('Client cleaned up');
        } catch (e) {
          console.error('Error cleaning up client:', e);
        }
      }
      
      if (io) {
        try {
          io.close();
          console.log('IO closed');
        } catch (e) {
          console.error('Error closing io:', e);
        }
      }
      
      if (httpServer && httpServer.listening) {
        try {
          await new Promise(resolve => httpServer.close(resolve));
          console.log('HTTP server closed');
        } catch (e) {
          console.error('Error closing httpServer:', e);
        }
      }
      
      console.log('Cleanup complete');
    }
  }, 30000); // 30 second timeout
});