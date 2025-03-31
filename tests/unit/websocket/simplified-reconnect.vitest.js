/**
 * Simplified Reconnection Test
 * 
 * This test focuses on reconnection with a self-contained setup and teardown,
 * avoiding the use of beforeEach/afterEach to ensure complete test control.
 */

import { describe, it, expect } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import getPort from 'get-port';

// Wait for a specific event to occur on an emitter
function waitForEvent(emitter, event, timeout = 2000) {
  console.log(`🔄🔄 Waiting for '${event}' event (timeout: ${timeout}ms)`);
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.log(`🔄🔄 TIMEOUT waiting for '${event}' event after ${timeout}ms`);
      emitter.off(event, handler);
      reject(new Error(`Timeout waiting for ${event} event after ${timeout}ms`));
    }, timeout);

    function handler(...args) {
      console.log(`🔄🔄 Received '${event}' event`);
      clearTimeout(timer);
      emitter.off(event, handler);
      resolve(args.length > 1 ? args : args[0]);
    }

    // Check if event is already in 'connected' state for connect event
    if (event === 'connect' && emitter.connected) {
      console.log(`🔄🔄 Socket already connected, resolving immediately`);
      clearTimeout(timer);
      resolve();
      return;
    }
    
    // Add debug handler for common events
    if (['connect', 'disconnect', 'error', 'connect_error'].includes(event)) {
      emitter.on('connect', () => console.log(`🔄🔄 DEBUG: 'connect' event fired`));
      emitter.on('disconnect', (reason) => console.log(`🔄🔄 DEBUG: 'disconnect' event fired, reason: ${reason}`));
      emitter.on('error', (err) => console.log(`🔄🔄 DEBUG: 'error' event fired: ${err.message}`));
      emitter.on('connect_error', (err) => console.log(`🔄🔄 DEBUG: 'connect_error' event fired: ${err.message}`));
    }

    emitter.on(event, handler);
  });
}

describe('Simplified Socket.IO Reconnection', () => {
  
  it('should reconnect after server restart', async () => {
    console.log('🔄 TEST STARTED');
    
    // Set up test resources in the test itself, not in beforeEach
    const port = await getPort();
    console.log(`🔄 Using port ${port}`);
    
    let httpServer = createServer();
    let io = new Server(httpServer);
    
    // Set up basic server handlers
    io.on('connection', (socket) => {
      console.log(`🔄 Server: Client connected - ${socket.id}`);
      
      socket.on('ping', (data) => {
        console.log(`🔄 Server: Received ping - ${JSON.stringify(data)}`);
        socket.emit('pong', { received: data });
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`🔄 Server: Client disconnected - ${socket.id} - Reason: ${reason}`);
      });
    });
    
    // Start server
    await new Promise(resolve => httpServer.listen(port, resolve));
    console.log(`🔄 Server started on port ${port}`);
    
    // Create client
    const client = ioc(`http://localhost:${port}`, {
      forceNew: true,          // Create a new connection
      autoConnect: true,       // Connect automatically 
      reconnection: false,     // No auto reconnection
      timeout: 3000,           // Connection timeout
      transports: ['websocket'] // Use WebSocket only for consistency
    });
    
    // Wait for connection
    try {
      await waitForEvent(client, 'connect', 3000);
      console.log(`🔄 Client connected, ID: ${client.id}`);
      
      // Verify connection with ping-pong
      const pongPromise = new Promise(resolve => {
        client.once('pong', (data) => {
          console.log(`🔄 Client: Received pong - ${JSON.stringify(data)}`);
          resolve(data);
        });
      });
      
      console.log('🔄 Client: Sending ping');
      client.emit('ping', { test: 'initial-connection' });
      
      await pongPromise;
      console.log('🔄 Initial ping-pong successful');
      
      // Register disconnect handler before stopping server
      console.log('🔄 Registering explicit disconnect listener');
      client.on('disconnect', (reason) => {
        console.log(`🔄 EXPLICIT HANDLER: Client disconnected, reason: ${reason}`);
      });
      
      // Stop the server
      console.log('🔄 Stopping server');
      io.disconnectSockets(true);
      io.close();
      
      await new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            console.error('🔄 Error closing server:', err);
            reject(err);
          } else {
            console.log('🔄 Server stopped successfully');
            resolve();
          }
        });
      });
      
      // Add small delay to allow disconnect event to propagate
      console.log('🔄 Waiting 200ms for disconnect event to propagate');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Wait for client to detect disconnect
      console.log(`🔄 Client connected status before waiting: ${client.connected}`);
      if (!client.connected) {
        console.log('🔄 Client already disconnected, skipping wait');
      } else {
        await waitForEvent(client, 'disconnect', 3000);
      }
      console.log(`🔄 Client disconnected: ${client.connected}`);
      expect(client.connected).toBe(false);
      
      // Create a new server on the same port
      console.log('🔄 Creating new server on same port');
      httpServer = createServer();
      io = new Server(httpServer);
      
      // Set up basic server handlers
      io.on('connection', (socket) => {
        console.log(`🔄 Server (new): Client connected - ${socket.id}`);
        
        socket.on('ping', (data) => {
          console.log(`🔄 Server (new): Received ping - ${JSON.stringify(data)}`);
          socket.emit('pong', { received: data, newServer: true });
        });
      });
      
      // Start server
      await new Promise(resolve => httpServer.listen(port, resolve));
      console.log(`🔄 New server started on port ${port}`);
      
      // Manually reconnect client - first make sure it's disconnected
      console.log('🔄 Manually reconnecting client');
      if (client.connected) {
        console.log('🔄 Forcing disconnect since client is still connected');
        client.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Create a new client connection
      console.log('🔄 Creating new client connection');
      client.connect();
      
      // Wait for reconnect with longer timeout
      console.log(`🔄 Waiting for client to connect, current state: ${client.connected}`);
      await waitForEvent(client, 'connect', 5000);
      console.log(`🔄 Client reconnected: ${client.connected}`);
      expect(client.connected).toBe(true);
      
      // Verify connection with another ping-pong
      const reconnectPongPromise = new Promise(resolve => {
        client.once('pong', (data) => {
          console.log(`🔄 Client: Received pong after reconnect - ${JSON.stringify(data)}`);
          resolve(data);
        });
      });
      
      console.log('🔄 Client: Sending ping after reconnect');
      client.emit('ping', { test: 'after-reconnect' });
      
      const reconnectPongResponse = await reconnectPongPromise;
      console.log('🔄 Reconnect ping-pong successful');
      expect(reconnectPongResponse.newServer).toBe(true);
      
    } catch (error) {
      console.error('🔄 Test error:', error);
      throw error;
    } finally {
      // Clean up resources
      console.log('🔄 Cleaning up test resources');
      
      if (client) {
        try {
          client.disconnect();
          client.removeAllListeners();
        } catch (e) {
          console.error('🔄 Error cleaning up client:', e);
        }
      }
      
      if (io) {
        try {
          io.disconnectSockets(true);
          io.close();
        } catch (e) {
          console.error('🔄 Error closing io:', e);
        }
      }
      
      if (httpServer && httpServer.listening) {
        try {
          await new Promise(resolve => httpServer.close(resolve));
        } catch (e) {
          console.error('🔄 Error closing httpServer:', e);
        }
      }
      
      console.log('🔄 Test cleanup completed');
    }
    
    console.log('🔄 TEST COMPLETED SUCCESSFULLY');
  }, 30000); // 30s timeout
});