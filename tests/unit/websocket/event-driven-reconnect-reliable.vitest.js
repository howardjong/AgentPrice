/**
 * Event-Driven Socket.IO Reconnection - Reliable Version
 * 
 * A minimal but robust implementation of event-driven testing for Socket.IO reconnection
 * that uses explicit message passing patterns with typed events to ensure test reliability.
 */

import { describe, it, expect } from 'vitest';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import getPort from 'get-port';

describe('Reliable Event-Driven Socket.IO Reconnection', () => {
  it('should handle server restart and automatic reconnection', async () => {
    console.log('🔄 Starting reliable event-driven reconnection test');
    
    // Track events for debugging
    const events = [];
    function logEvent(type, data = {}) {
      const entry = { type, time: Date.now(), ...data };
      events.push(entry);
      console.log(`🔄 [${events.length}] ${type}: ${JSON.stringify(data)}`);
    }
    
    // Get a random available port
    const port = await getPort();
    logEvent('port-selected', { port });
    
    // Setup
    let httpServer;
    let io;
    let client;
    let serverInstance = 1;
    
    // Create our first server
    httpServer = createServer();
    io = new Server(httpServer);
    
    // Setup server message handlers
    io.on('connection', socket => {
      logEvent('server-connection', { id: socket.id, instance: serverInstance });
      
      // Test message handler
      socket.on('test-message', data => {
        logEvent('server-test-message', { id: socket.id, data });
        
        // Respond with an identifier that includes the server instance
        socket.emit('test-response', {
          original: data,
          serverInstance,
          serverTime: Date.now(),
          socketId: socket.id
        });
      });
    });
    
    // Start the server
    await new Promise(resolve => httpServer.listen(port, resolve));
    logEvent('server-started', { port, instance: serverInstance });
    
    try {
      // Create client with reconnection enabled
      client = SocketIOClient(`http://localhost:${port}`, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 100,
        timeout: 2000
      });
      
      // Setup client event tracking
      client.on('connect', () => {
        logEvent('client-connect', { id: client.id });
      });
      
      client.on('disconnect', reason => {
        logEvent('client-disconnect', { id: client.id, reason });
      });
      
      client.on('connect_error', err => {
        logEvent('client-connect-error', { message: err.message });
      });
      
      // Wait for initial connection
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout waiting for initial connection'));
        }, 3000);
        
        client.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      
      logEvent('initial-connection-complete');
      expect(client.connected).toBe(true);
      
      // Verify connection with a test message
      const initialResponse = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout waiting for test response'));
        }, 2000);
        
        // Setup response handler
        client.once('test-response', response => {
          clearTimeout(timer);
          logEvent('initial-response-received', response);
          resolve(response);
        });
        
        // Send test message
        const testMessage = { type: 'initial', timestamp: Date.now() };
        logEvent('sending-initial-test', testMessage);
        client.emit('test-message', testMessage);
      });
      
      // Verify the server instance in the response
      expect(initialResponse).toBeDefined();
      expect(initialResponse.serverInstance).toBe(1);
      expect(initialResponse.original.type).toBe('initial');
      
      // Store the original socket ID
      const originalSocketId = initialResponse.socketId;
      logEvent('initial-test-verified', { 
        serverInstance: initialResponse.serverInstance,
        socketId: originalSocketId
      });
      
      // Disconnect and restart the server
      logEvent('restarting-server', { closing: true });
      io.close();
      await new Promise(resolve => httpServer.close(resolve));
      logEvent('server-closed');
      
      // Wait for client to detect disconnection
      await new Promise((resolve, reject) => {
        // If already disconnected, resolve immediately
        if (!client.connected) {
          logEvent('already-disconnected');
          resolve();
          return;
        }
        
        const timer = setTimeout(() => {
          reject(new Error('Timeout waiting for disconnect event'));
        }, 2000);
        
        client.once('disconnect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      
      expect(client.connected).toBe(false);
      logEvent('disconnect-verified');
      
      // Create new server instance
      serverInstance = 2;
      httpServer = createServer();
      io = new Server(httpServer);
      
      // Setup server message handlers (same as before but with new instance)
      io.on('connection', socket => {
        logEvent('new-server-connection', { id: socket.id, instance: serverInstance });
        
        socket.on('test-message', data => {
          logEvent('new-server-test-message', { id: socket.id, data });
          
          socket.emit('test-response', {
            original: data,
            serverInstance,
            serverTime: Date.now(),
            socketId: socket.id
          });
        });
      });
      
      // Start the new server on the same port
      await new Promise(resolve => httpServer.listen(port, resolve));
      logEvent('new-server-started', { port, instance: serverInstance });
      
      // Wait for automatic reconnection
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout waiting for reconnection'));
        }, 5000);
        
        client.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      
      expect(client.connected).toBe(true);
      logEvent('reconnection-verified');
      
      // Verify connection to new server
      const reconnectResponse = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout waiting for reconnect test response'));
        }, 2000);
        
        // Setup response handler
        client.once('test-response', response => {
          clearTimeout(timer);
          logEvent('reconnect-response-received', response);
          resolve(response);
        });
        
        // Send test message
        const testMessage = { type: 'reconnect', timestamp: Date.now() };
        logEvent('sending-reconnect-test', testMessage);
        client.emit('test-message', testMessage);
      });
      
      // Verify we're connected to a different server
      expect(reconnectResponse).toBeDefined();
      expect(reconnectResponse.serverInstance).toBe(2);
      expect(reconnectResponse.original.type).toBe('reconnect');
      
      // The socket ID should be different after reconnection
      const newSocketId = reconnectResponse.socketId;
      expect(newSocketId).not.toBe(originalSocketId);
      
      logEvent('reconnection-test-verified', { 
        serverInstance: reconnectResponse.serverInstance,
        originalSocketId, 
        newSocketId 
      });
      
      // Final assertions
      expect(events.filter(e => e.type === 'client-connect').length).toBe(2);
      expect(events.filter(e => e.type === 'client-disconnect').length).toBe(1);
      expect(events.filter(e => e.type.includes('server-connection')).length).toBe(2);
      
      // Successfully connected to a new server instance
      logEvent('test-success');
    } finally {
      // Clean up resources
      logEvent('cleanup');
      
      if (client) {
        try {
          client.disconnect();
          client.removeAllListeners();
        } catch (e) {
          console.error('Error cleaning up client:', e);
        }
      }
      
      if (io) {
        try {
          io.close();
        } catch (e) {
          console.error('Error closing io:', e);
        }
      }
      
      if (httpServer && httpServer.listening) {
        try {
          await new Promise(resolve => httpServer.close(resolve));
        } catch (e) {
          console.error('Error closing httpServer:', e);
        }
      }
      
      logEvent('cleanup-complete');
    }
  }, 15000); // 15 second timeout
});