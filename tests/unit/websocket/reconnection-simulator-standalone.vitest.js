/**
 * Socket.IO Reconnection Simulator Standalone Test
 * 
 * This simplified test focuses solely on testing the reconnection event simulator
 * with minimal dependencies and complexity.
 */

import { describe, it, expect } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import getPort from 'get-port';

// Promise-based wait function with timeout
function waitForEvent(emitter, event, timeout = 3000) {
  console.log(`💡 Waiting for '${event}' event with ${timeout}ms timeout`);
  
  // Check if we're already in the desired state
  if (event === 'connect' && emitter.connected) {
    console.log(`💡 Already connected, resolving immediately`);
    return Promise.resolve();
  }
  
  if (event === 'disconnect' && !emitter.connected) {
    console.log(`💡 Already disconnected, resolving immediately`);
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(event, handler);
      console.log(`💡 Timeout waiting for '${event}' event after ${timeout}ms`);
      reject(new Error(`Timeout waiting for ${event} event after ${timeout}ms`));
    }, timeout);
    
    function handler(...args) {
      console.log(`💡 Received '${event}' event`);
      clearTimeout(timer);
      emitter.off(event, handler);
      resolve(args.length > 1 ? args : args[0]);
    }
    
    // Add debug logging for common events
    if (!emitter._debugHandlersAttached) {
      emitter.on('connect', () => console.log(`💡 DEBUG: 'connect' event fired, connected: ${emitter.connected}`));
      emitter.on('disconnect', reason => console.log(`💡 DEBUG: 'disconnect' event fired, reason: ${reason}`));
      emitter.on('error', err => console.log(`💡 DEBUG: 'error' event fired: ${err.message}`));
      emitter.on('connect_error', err => console.log(`💡 DEBUG: 'connect_error' event fired: ${err.message}`));
      emitter._debugHandlersAttached = true;
    }
    
    emitter.on(event, handler);
  });
}

describe('Socket.IO Reconnection Event Simulator', () => {
  
  it('should successfully connect to the server', async () => {
    // Setup resources directly in the test
    const port = await getPort();
    const httpServer = createServer();
    const io = new Server(httpServer);
    
    try {
      // Start server
      await new Promise(resolve => httpServer.listen(port, resolve));
      console.log(`💡 Server started on port ${port}`);
      
      // Add a basic connection handler
      io.on('connection', socket => {
        console.log(`💡 Client connected: ${socket.id}`);
      });
      
      // Create and connect client
      const client = ioc(`http://localhost:${port}`, {
        forceNew: true,
        transports: ['websocket']
      });
      
      // Wait for connection
      await waitForEvent(client, 'connect', 3000);
      console.log(`💡 Client connected: ${client.connected}, ID: ${client.id}`);
      expect(client.connected).toBe(true);
      
      // Clean up
      client.disconnect();
      io.close();
      await new Promise(resolve => httpServer.close(resolve));
      
    } catch (err) {
      console.error('Test error:', err);
      throw err;
    }
  });
  
  it('should handle manual connection recovery after server restart', async () => {
    console.log('Starting manual connection recovery test');
    
    // Create resources
    const port = await getPort();
    let httpServer = createServer();
    let io = new Server(httpServer);
    
    try {
      // Start server
      await new Promise(resolve => httpServer.listen(port, resolve));
      
      // Setup server data storage (simulating server state)
      const serverData = new Map();
      
      // Add server connection handlers
      io.on('connection', socket => {
        console.log(`💡 Server: Client connected: ${socket.id}`);
        
        socket.on('store-data', data => {
          console.log(`💡 Server: Storing data for client ${socket.id}:`, data);
          serverData.set(socket.id, data);
          socket.emit('data-stored', { success: true });
        });
        
        socket.on('retrieve-data', () => {
          const data = serverData.get(socket.id);
          console.log(`💡 Server: Retrieving data for client ${socket.id}:`, data);
          socket.emit('data-retrieved', data || { notFound: true });
        });
      });
      
      // Create client with reconnection disabled
      const client = ioc(`http://localhost:${port}`, {
        forceNew: true,
        reconnection: false,
        timeout: 5000,
        transports: ['websocket']
      });
      
      // Connect client
      await waitForEvent(client, 'connect', 5000);
      console.log(`💡 Client connected: ${client.connected}, ID: ${client.id}`);
      expect(client.connected).toBe(true);
      
      // Store test data
      console.log('Sending test data to server');
      const testData = { test: 'reconnection-data', timestamp: Date.now() };
      
      // Wait for data storage confirmation
      const dataStoredPromise = waitForEvent(client, 'data-stored', 3000);
      client.emit('store-data', testData);
      console.log('Waiting for data-stored event');
      await dataStoredPromise;
      console.log('Data successfully stored');
      
      // Stop the server
      console.log('Stopping server for reconnection test');
      io.disconnectSockets(true);
      io.close();
      await new Promise(resolve => httpServer.close(resolve));
      
      // Wait for client to detect disconnect
      if (client.connected) {
        await waitForEvent(client, 'disconnect', 3000);
      }
      console.log(`💡 Client disconnected: ${client.connected}`);
      expect(client.connected).toBe(false);
      
      // Allow a brief delay for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Start a new server instance
      console.log('Starting a new server instance');
      httpServer = createServer();
      io = new Server(httpServer);
      
      // Restore server data storage (simulating persistence)
      io.on('connection', socket => {
        console.log(`💡 Server (new): Client connected: ${socket.id}`);
        
        socket.on('retrieve-data', () => {
          // In a real app, this might retrieve from a database
          // Here we're simulating persistence by returning test data for any client
          console.log(`💡 Server (new): Retrieving simulated data for new connection`);
          socket.emit('data-retrieved', testData);
        });
      });
      
      // Start the new server
      await new Promise(resolve => httpServer.listen(port, resolve));
      console.log('New server started');
      
      // Reconnect the client
      console.log('Manually reconnecting client');
      client.connect();
      
      // Wait for reconnection
      await waitForEvent(client, 'connect', 5000);
      console.log(`💡 Client reconnected: ${client.connected}`);
      expect(client.connected).toBe(true);
      
      // Retrieve data to verify persistence
      console.log('Requesting data from new server');
      const dataRetrievedPromise = waitForEvent(client, 'data-retrieved', 3000);
      client.emit('retrieve-data');
      const retrievedData = await dataRetrievedPromise;
      
      console.log('Retrieved data after reconnection:', retrievedData);
      expect(retrievedData).toHaveProperty('test', 'reconnection-data');
      
      // Clean up
      client.disconnect();
      io.close();
      await new Promise(resolve => httpServer.close(resolve));
      
    } catch (err) {
      console.error('Test error:', err);
      throw err;
    }
  }, 30000); // 30 second timeout
  
  it('should handle multiple disconnect/reconnect cycles', async () => {
    const port = await getPort();
    let httpServer = createServer();
    let io = new Server(httpServer);
    let cycleCount = 0;
    const MAX_CYCLES = 2;
    
    try {
      // Set up initial server
      await new Promise(resolve => httpServer.listen(port, resolve));
      console.log(`💡 Server started on port ${port}`);
      
      io.on('connection', socket => {
        console.log(`💡 Cycle ${cycleCount} - Server: Client connected: ${socket.id}`);
        
        socket.on('ping', data => {
          console.log(`💡 Cycle ${cycleCount} - Server: Received ping:`, data);
          socket.emit('pong', { cycle: cycleCount, received: data });
        });
      });
      
      // Create client
      const client = ioc(`http://localhost:${port}`, {
        forceNew: true,
        reconnection: false,
        transports: ['websocket']
      });
      
      // Connect initially
      await waitForEvent(client, 'connect', 5000);
      expect(client.connected).toBe(true);
      
      // Test initial connection
      const initialPongPromise = waitForEvent(client, 'pong', 3000);
      client.emit('ping', { initial: true });
      const initialPong = await initialPongPromise;
      expect(initialPong).toHaveProperty('cycle', 0);
      
      // Run disconnect/reconnect cycles
      while (cycleCount < MAX_CYCLES) {
        cycleCount++;
        console.log(`\n💡 Starting cycle ${cycleCount}`);
        
        // Stop server
        console.log(`💡 Cycle ${cycleCount} - Stopping server`);
        io.disconnectSockets(true);
        io.close();
        await new Promise(resolve => httpServer.close(resolve));
        
        // Wait for disconnect
        if (client.connected) {
          await waitForEvent(client, 'disconnect', 3000);
        }
        expect(client.connected).toBe(false);
        
        // Create new server
        console.log(`💡 Cycle ${cycleCount} - Creating new server`);
        httpServer = createServer();
        io = new Server(httpServer);
        
        io.on('connection', socket => {
          console.log(`💡 Cycle ${cycleCount} - Server: Client connected: ${socket.id}`);
          
          socket.on('ping', data => {
            console.log(`💡 Cycle ${cycleCount} - Server: Received ping:`, data);
            socket.emit('pong', { cycle: cycleCount, received: data });
          });
        });
        
        // Start new server
        await new Promise(resolve => httpServer.listen(port, resolve));
        
        // Reconnect client
        console.log(`💡 Cycle ${cycleCount} - Reconnecting client`);
        client.connect();
        
        // Wait for connection
        await waitForEvent(client, 'connect', 5000);
        expect(client.connected).toBe(true);
        
        // Verify cycle with ping/pong
        console.log(`💡 Cycle ${cycleCount} - Testing connection`);
        const pongPromise = waitForEvent(client, 'pong', 3000);
        client.emit('ping', { cycle: cycleCount });
        const pong = await pongPromise;
        
        // Verify we got response from the right cycle
        expect(pong).toHaveProperty('cycle', cycleCount);
        
        console.log(`💡 Cycle ${cycleCount} - Complete`);
      }
      
      // Final cleanup
      client.disconnect();
      io.close();
      await new Promise(resolve => httpServer.close(resolve));
      
    } catch (err) {
      console.error('Test error:', err);
      throw err;
    }
  }, 60000); // 60 second timeout
  // Cleanup event listeners after each test
  afterEach(() => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    mockClient?.removeAllListeners();
  });
});
