/**
 * Event-Driven Socket.IO Reconnection Test
 * 
 * This test implements an event-driven approach for Socket.IO reconnection testing
 * inspired by Server-Sent Events (SSE) patterns. It uses explicit event tracking
 * and promises to avoid timeout issues and create more stable tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import getPort from 'get-port';

describe('Event-Driven Socket.IO Reconnection', () => {
  let port;
  let app;
  let httpServer;
  let io;
  let client;
  let receivedMessages = [];
  let serverEventLog = [];
  let clientEventLog = [];
  
  /**
   * Wait for a specific event with detailed tracking
   */
  function waitForEvent(emitter, eventName, timeout = 2000) {
    const startTime = Date.now();
    
    console.log(`[${Date.now() - startTime}ms] 🔄 Waiting for '${eventName}' event (timeout: ${timeout}ms)`);
    
    return new Promise((resolve, reject) => {
      // Create a unique ID for this wait operation for logging
      const waitId = `wait-${eventName}-${Date.now()}`;
      
      // Set timeout to avoid hanging
      const timer = setTimeout(() => {
        logEvent(waitId, 'timeout', { eventName, elapsed: Date.now() - startTime });
        
        // Log all received messages for debugging
        console.log(`[${Date.now() - startTime}ms] 🔄 TIMEOUT waiting for '${eventName}' event after ${timeout}ms`);
        console.log(`[${Date.now() - startTime}ms] 🔄 Received ${receivedMessages.length} messages while waiting:`);
        receivedMessages.forEach((msg, i) => {
          console.log(`[${Date.now() - startTime}ms] 🔄   - [${i}] ${JSON.stringify(msg)}`);
        });
        
        // Show event logs
        console.log(`[${Date.now() - startTime}ms] 🔄 Client events (${clientEventLog.length}):`);
        clientEventLog.slice(-10).forEach(log => {
          console.log(`[${Date.now() - startTime}ms] 🔄   - ${log.time}ms: ${log.event} ${log.data ? JSON.stringify(log.data) : ''}`);
        });
        
        console.log(`[${Date.now() - startTime}ms] 🔄 Server events (${serverEventLog.length}):`);
        serverEventLog.slice(-10).forEach(log => {
          console.log(`[${Date.now() - startTime}ms] 🔄   - ${log.time}ms: ${log.event} ${log.data ? JSON.stringify(log.data) : ''}`);
        });
        
        cleanup();
        reject(new Error(`Timeout waiting for ${eventName} event after ${timeout}ms`));
      }, timeout);
      
      // Handler function for the event
      function handler(...args) {
        const elapsed = Date.now() - startTime;
        logEvent(waitId, 'received', { eventName, elapsed });
        console.log(`[${elapsed}ms] 🔄 Received '${eventName}' event`);
        clearTimeout(timer);
        cleanup();
        resolve(args.length > 1 ? args : args[0]);
      }
      
      // Clean up function to remove listeners
      function cleanup() {
        try {
          emitter.off(eventName, handler);
          emitter.off('error', errorHandler);
          
          if (eventName !== 'disconnect') {
            emitter.off('disconnect', disconnectHandler);
          }
        } catch (e) {
          console.error(`[${Date.now() - startTime}ms] 🔄 Error removing listeners:`, e);
        }
      }
      
      // Special case for connect event if already connected
      if (eventName === 'connect' && emitter.connected) {
        logEvent(waitId, 'already-connected', {});
        console.log(`[${Date.now() - startTime}ms] 🔄 Socket already connected, resolving immediately`);
        clearTimeout(timer);
        cleanup();
        resolve();
        return;
      }
      
      // Special case for disconnect event if already disconnected
      if (eventName === 'disconnect' && !emitter.connected) {
        logEvent(waitId, 'already-disconnected', {});
        console.log(`[${Date.now() - startTime}ms] 🔄 Socket already disconnected, resolving immediately`);
        clearTimeout(timer);
        cleanup();
        resolve('already-disconnected');
        return;
      }
      
      // Error handler
      function errorHandler(err) {
        logEvent(waitId, 'error', { message: err.message });
        console.log(`[${Date.now() - startTime}ms] 🔄 Error while waiting for '${eventName}':`, err.message);
      }
      
      // Disconnect handler (to detect unexpected disconnects)
      function disconnectHandler(reason) {
        logEvent(waitId, 'unexpected-disconnect', { reason });
        console.log(`[${Date.now() - startTime}ms] 🔄 Unexpected disconnect while waiting for '${eventName}': ${reason}`);
        if (eventName !== 'disconnect') {
          // Only treat as an error if we're not waiting for disconnect
          console.log(`[${Date.now() - startTime}ms] 🔄 This may affect the test - socket disconnected while waiting for ${eventName}`);
        }
      }
      
      // Set up handlers
      logEvent(waitId, 'setup', { eventName });
      emitter.on(eventName, handler);
      emitter.once('error', errorHandler);
      
      if (eventName !== 'disconnect') {
        emitter.once('disconnect', disconnectHandler);
      }
    });
  }
  
  /**
   * Log an event for debugging
   */
  function logEvent(source, event, data) {
    const entry = {
      source,
      event,
      data,
      time: Date.now()
    };
    
    if (source.startsWith('client')) {
      clientEventLog.push(entry);
      // Keep the log at a reasonable size
      if (clientEventLog.length > 100) {
        clientEventLog = clientEventLog.slice(-100);
      }
    } else if (source.startsWith('server')) {
      serverEventLog.push(entry);
      // Keep the log at a reasonable size
      if (serverEventLog.length > 100) {
        serverEventLog = serverEventLog.slice(-100);
      }
    }
  }
  
  /**
   * Wait for a message of a specific type
   */
  function waitForMessageType(socket, messageType, timeout = 2000) {
    const startTime = Date.now();
    console.log(`[${Date.now() - startTime}ms] 🔄 Waiting for message type '${messageType}' (timeout: ${timeout}ms)`);
    
    return new Promise((resolve, reject) => {
      const waitId = `wait-message-${messageType}-${Date.now()}`;
      logEvent(waitId, 'setup', { messageType });
      
      // Track all messages received while waiting
      const messagesReceived = [];
      
      // Set timeout to avoid hanging
      const timer = setTimeout(() => {
        logEvent(waitId, 'timeout', { 
          messageType, 
          elapsed: Date.now() - startTime,
          messagesReceived: messagesReceived.length
        });
        
        console.log(`[${Date.now() - startTime}ms] 🔄 TIMEOUT waiting for message type '${messageType}' after ${timeout}ms`);
        console.log(`[${Date.now() - startTime}ms] 🔄 Received ${messagesReceived.length} other messages while waiting:`);
        messagesReceived.forEach((msg, i) => {
          console.log(`[${Date.now() - startTime}ms] 🔄   - [${i}] type=${msg.type || 'unknown'} ${JSON.stringify(msg)}`);
        });
        
        cleanup();
        reject(new Error(`Timeout waiting for message type '${messageType}' after ${timeout}ms`));
      }, timeout);
      
      // Clean up function
      function cleanup() {
        try {
          socket.off('message', messageHandler);
          socket.off('error', errorHandler);
          socket.off('disconnect', disconnectHandler);
        } catch (e) {
          console.error(`[${Date.now() - startTime}ms] 🔄 Error removing listeners:`, e);
        }
      }
      
      // Message handler
      function messageHandler(data) {
        try {
          // Parse message if needed
          const message = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Track for debugging
          if (messagesReceived.length < 20) { // Limit to prevent memory issues
            messagesReceived.push(message);
          }
          
          logEvent(waitId, 'message-received', { type: message.type || 'unknown' });
          
          // Check if it's the message we're looking for
          if (message.type === messageType) {
            const elapsed = Date.now() - startTime;
            logEvent(waitId, 'target-message-found', { elapsed });
            console.log(`[${elapsed}ms] 🔄 Found target message type '${messageType}'`);
            clearTimeout(timer);
            cleanup();
            resolve(message);
          } else {
            console.log(`[${Date.now() - startTime}ms] 🔄 Received message type '${message.type || 'unknown'}', waiting for '${messageType}'`);
          }
        } catch (e) {
          logEvent(waitId, 'message-handler-error', { message: e.message });
          console.error(`[${Date.now() - startTime}ms] 🔄 Error in message handler:`, e);
        }
      }
      
      // Error handler
      function errorHandler(err) {
        logEvent(waitId, 'error', { message: err.message });
        console.log(`[${Date.now() - startTime}ms] 🔄 Socket error while waiting for message type '${messageType}':`, err.message);
      }
      
      // Disconnect handler
      function disconnectHandler(reason) {
        logEvent(waitId, 'disconnect', { reason });
        console.log(`[${Date.now() - startTime}ms] 🔄 Socket disconnected while waiting for message type '${messageType}':`, reason);
        clearTimeout(timer);
        cleanup();
        reject(new Error(`Socket disconnected while waiting for message type '${messageType}': ${reason}`));
      }
      
      // Set up handlers
      socket.on('message', messageHandler);
      socket.once('error', errorHandler);
      socket.once('disconnect', disconnectHandler);
    });
  }
  
  // Setup before each test
  beforeEach(async () => {
    // Clear event logs and message tracking
    receivedMessages = [];
    serverEventLog = [];
    clientEventLog = [];
    
    // Get a random available port
    port = await getPort();
    console.log(`🔄 Using port ${port}`);
    
    // Set up Express app and HTTP server
    app = express();
    httpServer = createServer(app);
    
    // Set up Socket.IO server with optimized test settings
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      connectTimeout: 1000,
      pingTimeout: 1000,
      pingInterval: 1000
    });
    
    // Set up server-side event handling
    io.on('connection', (socket) => {
      logEvent('server-socket-' + socket.id, 'connect', {});
      console.log(`🔄 Server: Client connected - ${socket.id}`);
      
      // Handler for system status requests
      socket.on('system_status', () => {
        logEvent('server-socket-' + socket.id, 'system_status_request', {});
        console.log(`🔄 Server: Received system_status request from ${socket.id}`);
        
        socket.emit('message', {
          type: 'system_status',
          status: 'ok',
          time: Date.now(),
          socketId: socket.id
        });
      });
      
      // Ping handler for connection testing
      socket.on('ping', (data) => {
        logEvent('server-socket-' + socket.id, 'ping', data);
        console.log(`🔄 Server: Received ping from ${socket.id} - ${JSON.stringify(data)}`);
        
        socket.emit('message', {
          type: 'pong',
          time: Date.now(),
          received: data
        });
      });
      
      // Generic message handler
      socket.on('message', (data) => {
        try {
          const message = typeof data === 'string' ? JSON.parse(data) : data;
          logEvent('server-socket-' + socket.id, 'message', message);
          console.log(`🔄 Server: Received message from ${socket.id} - ${JSON.stringify(message)}`);
          
          // Echo the message back with a timestamp
          socket.emit('message', {
            type: 'echo',
            time: Date.now(),
            original: message
          });
        } catch (e) {
          console.error(`🔄 Server: Error processing message:`, e);
        }
      });
      
      // Track disconnections
      socket.on('disconnect', (reason) => {
        logEvent('server-socket-' + socket.id, 'disconnect', { reason });
        console.log(`🔄 Server: Client disconnected - ${socket.id} - Reason: ${reason}`);
      });
    });
    
    // Start server
    await new Promise(resolve => httpServer.listen(port, resolve));
    console.log(`🔄 Server started on port ${port}`);
    
    // Create client
    client = SocketIOClient(`http://localhost:${port}`, {
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
      timeout: 2000
    });
    
    // Set up client-side event tracking
    client.on('connect', () => {
      logEvent('client-' + (client.id || 'unknown'), 'connect', {});
      console.log(`🔄 Client connected, ID: ${client.id}`);
    });
    
    client.on('disconnect', (reason) => {
      logEvent('client-' + (client.id || 'unknown'), 'disconnect', { reason });
      console.log(`🔄 Client disconnected, reason: ${reason}`);
    });
    
    client.on('connect_error', (err) => {
      logEvent('client-' + (client.id || 'unknown'), 'connect_error', { message: err.message });
      console.log(`🔄 Client connect error: ${err.message}`);
    });
    
    client.on('error', (err) => {
      logEvent('client-' + (client.id || 'unknown'), 'error', { message: err.message });
      console.log(`🔄 Client error: ${err.message}`);
    });
    
    // Track all messages
    client.on('message', (data) => {
      try {
        const message = typeof data === 'string' ? JSON.parse(data) : data;
        logEvent('client-' + (client.id || 'unknown'), 'message', message);
        
        // Track for debugging
        if (receivedMessages.length < 100) {
          receivedMessages.push(message);
        }
        
        console.log(`🔄 Client received message: ${JSON.stringify(message)}`);
      } catch (e) {
        console.error(`🔄 Client: Error processing message:`, e);
      }
    });
  });
  
  // Clean up after each test
  afterEach(async () => {
    console.log('🔄 Cleaning up test resources');
    
    try {
      // 1. Disconnect client
      if (client) {
        try {
          if (client.connected) {
            console.log('🔄 Disconnecting client');
            client.disconnect();
          }
          
          client.removeAllListeners();
          console.log('🔄 Client cleaned up');
        } catch (e) {
          console.error('🔄 Error disconnecting client:', e);
        }
      }
      
      // 2. Close Socket.IO server
      if (io) {
        try {
          console.log('🔄 Closing Socket.IO server');
          io.disconnectSockets(true);
          io.close();
          console.log('🔄 Socket.IO server closed');
        } catch (e) {
          console.error('🔄 Error closing Socket.IO server:', e);
        }
      }
      
      // 3. Close HTTP server
      if (httpServer && httpServer.listening) {
        try {
          console.log('🔄 Closing HTTP server');
          await new Promise(resolve => httpServer.close(resolve));
          console.log('🔄 HTTP server closed');
        } catch (e) {
          console.error('🔄 Error closing HTTP server:', e);
        }
      }
      
      console.log('🔄 Test cleanup completed');
    } catch (e) {
      console.error('🔄 Unexpected error during cleanup:', e);
    }
  });
  
  /**
   * Test case: Event-driven approach with explicit tracking
   */
  it('should reconnect automatically and maintain functionality after server restart', async () => {
    console.log('🔄 Starting test: automatic reconnection after server restart');
    
    // Wait for initial connection
    console.log('🔄 Waiting for initial connection...');
    await waitForEvent(client, 'connect', 5000);
    expect(client.connected).toBe(true);
    console.log(`🔄 Initial connection established, socket ID: ${client.id}`);
    
    // Verify connection with ping-pong
    console.log('🔄 Testing initial connection with ping-pong...');
    client.emit('ping', { test: 'initial', timestamp: Date.now() });
    
    const initialPong = await waitForMessageType(client, 'pong', 2000);
    expect(initialPong).toBeDefined();
    expect(initialPong.received.test).toBe('initial');
    console.log('🔄 Initial ping-pong successful');
    
    // Request system status
    console.log('🔄 Requesting initial system status...');
    client.emit('system_status');
    
    const initialStatus = await waitForMessageType(client, 'system_status', 2000);
    expect(initialStatus).toBeDefined();
    expect(initialStatus.status).toBe('ok');
    console.log('🔄 Initial system status received');
    
    // Store the original server fingerprint
    const originalServerId = initialStatus.socketId;
    console.log(`🔄 Original server socket ID: ${originalServerId}`);
    
    // Stop the server
    console.log('🔄 Stopping server to simulate disconnection...');
    io.disconnectSockets(true);
    io.close();
    
    await new Promise(resolve => {
      httpServer.close(() => {
        console.log('🔄 Server stopped');
        resolve();
      });
    });
    
    // Wait for client to detect disconnection
    console.log('🔄 Waiting for client to detect disconnection...');
    await waitForEvent(client, 'disconnect', 5000);
    expect(client.connected).toBe(false);
    console.log('🔄 Client detected disconnection');
    
    // Create a new server on the same port
    console.log('🔄 Starting new server on same port...');
    httpServer = createServer();
    io = new Server(httpServer);
    
    // Set up server-side event handling for the new server
    io.on('connection', (socket) => {
      logEvent('new-server-' + socket.id, 'connect', {});
      console.log(`🔄 New Server: Client connected - ${socket.id}`);
      
      // Handler for system status requests with a different fingerprint
      socket.on('system_status', () => {
        logEvent('new-server-' + socket.id, 'system_status_request', {});
        console.log(`🔄 New Server: Received system_status request from ${socket.id}`);
        
        socket.emit('message', {
          type: 'system_status',
          status: 'ok',
          time: Date.now(),
          socketId: socket.id,
          newServer: true // Flag to identify the new server
        });
      });
      
      // Ping handler for the new server
      socket.on('ping', (data) => {
        logEvent('new-server-' + socket.id, 'ping', data);
        console.log(`🔄 New Server: Received ping from ${socket.id} - ${JSON.stringify(data)}`);
        
        socket.emit('message', {
          type: 'pong',
          time: Date.now(),
          received: data,
          newServer: true // Flag to identify the new server
        });
      });
      
      // Track disconnections
      socket.on('disconnect', (reason) => {
        logEvent('new-server-' + socket.id, 'disconnect', { reason });
        console.log(`🔄 New Server: Client disconnected - ${socket.id} - Reason: ${reason}`);
      });
    });
    
    // Start the new server
    await new Promise(resolve => httpServer.listen(port, resolve));
    console.log(`🔄 New server started on port ${port}`);
    
    // Wait for client to reconnect automatically
    console.log('🔄 Waiting for client to reconnect automatically...');
    await waitForEvent(client, 'connect', 10000);
    expect(client.connected).toBe(true);
    console.log(`🔄 Client reconnected, new socket ID: ${client.id}`);
    
    // Verify connection with ping-pong to the new server
    console.log('🔄 Testing connection to new server with ping-pong...');
    client.emit('ping', { test: 'new-server', timestamp: Date.now() });
    
    const newServerPong = await waitForMessageType(client, 'pong', 2000);
    expect(newServerPong).toBeDefined();
    expect(newServerPong.received.test).toBe('new-server');
    expect(newServerPong.newServer).toBe(true);
    console.log('🔄 New server ping-pong successful');
    
    // Request system status from the new server
    console.log('🔄 Requesting system status from new server...');
    client.emit('system_status');
    
    const newServerStatus = await waitForMessageType(client, 'system_status', 2000);
    expect(newServerStatus).toBeDefined();
    expect(newServerStatus.status).toBe('ok');
    expect(newServerStatus.newServer).toBe(true);
    console.log('🔄 New server system status received');
    
    // Verify we are connected to a different server instance
    expect(newServerStatus.socketId).not.toBe(originalServerId);
    console.log(`🔄 New server socket ID: ${newServerStatus.socketId} (different from original: ${originalServerId})`);
    
    console.log('🔄 Test completed successfully');
  }, 30000); // 30 second timeout
  
  /**
   * Test case: Multiple disconnects and reconnects
   */
  it('should handle multiple reconnections with consistent behavior', async () => {
    console.log('🔄 Starting test: multiple reconnections');
    
    // Create lists to track messages across reconnects
    const reconnectEvents = [];
    const serverResponses = [];
    
    // Add special tracking for connect/disconnect events
    client.on('connect', () => {
      reconnectEvents.push({
        type: 'connect',
        time: Date.now(),
        socketId: client.id
      });
    });
    
    client.on('disconnect', (reason) => {
      reconnectEvents.push({
        type: 'disconnect',
        time: Date.now(),
        reason,
        socketId: client.id
      });
    });
    
    // Track all server responses
    client.on('message', (data) => {
      try {
        if (data.type === 'pong') {
          serverResponses.push({
            type: 'pong',
            time: Date.now(),
            attempt: data.received.attempt,
            serverId: data.serverId
          });
        }
      } catch (e) {
        console.error('🔄 Error tracking server response:', e);
      }
    });
    
    // Wait for initial connection
    console.log('🔄 Waiting for initial connection...');
    await waitForEvent(client, 'connect', 5000);
    expect(client.connected).toBe(true);
    console.log(`🔄 Initial connection established, socket ID: ${client.id}`);
    
    // Function to restart the server and return the new instance ID
    async function restartServer() {
      // Stop the server
      console.log('🔄 Stopping server...');
      io.disconnectSockets(true);
      io.close();
      
      await new Promise(resolve => {
        httpServer.close(() => {
          console.log('🔄 Server stopped');
          resolve();
        });
      });
      
      // Wait for client to detect disconnection
      console.log('🔄 Waiting for client to detect disconnection...');
      await waitForEvent(client, 'disconnect', 5000);
      expect(client.connected).toBe(false);
      console.log('🔄 Client detected disconnection');
      
      // Create a new server with a unique identifier
      const serverId = `server-${Date.now()}`;
      console.log(`🔄 Starting new server (${serverId}) on same port...`);
      httpServer = createServer();
      io = new Server(httpServer);
      
      // Set up server-side event handling with the unique ID
      io.on('connection', (socket) => {
        console.log(`🔄 Server ${serverId}: Client connected - ${socket.id}`);
        
        socket.on('ping', (data) => {
          console.log(`🔄 Server ${serverId}: Received ping - ${JSON.stringify(data)}`);
          socket.emit('message', {
            type: 'pong',
            time: Date.now(),
            received: data,
            serverId // Include server identifier in response
          });
        });
      });
      
      // Start the new server
      await new Promise(resolve => httpServer.listen(port, resolve));
      console.log(`🔄 New server (${serverId}) started on port ${port}`);
      
      // Wait for client to reconnect automatically
      console.log('🔄 Waiting for client to reconnect...');
      await waitForEvent(client, 'connect', 10000);
      expect(client.connected).toBe(true);
      console.log(`🔄 Client reconnected to server ${serverId}, socket ID: ${client.id}`);
      
      return serverId;
    }
    
    // Perform 3 server restarts
    const serverIds = [];
    
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`🔄 === Reconnection attempt ${attempt + 1} ===`);
      
      // Skip first restart for the first iteration (server already running)
      if (attempt > 0) {
        const serverId = await restartServer();
        serverIds.push(serverId);
      }
      
      // Test the connection with ping-pong
      console.log(`🔄 Testing connection with ping-pong (attempt ${attempt + 1})...`);
      client.emit('ping', { 
        test: `reconnect-${attempt + 1}`, 
        timestamp: Date.now(),
        attempt: attempt + 1
      });
      
      const pong = await waitForMessageType(client, 'pong', 2000);
      expect(pong).toBeDefined();
      expect(pong.received.test).toBe(`reconnect-${attempt + 1}`);
      console.log(`🔄 Ping-pong successful for attempt ${attempt + 1}`);
      
      // Delay between iterations
      if (attempt < 2) {
        console.log('🔄 Waiting 1 second before next reconnection test...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Verify reconnect events
    console.log('🔄 Verifying reconnect events...');
    expect(reconnectEvents.filter(e => e.type === 'connect').length).toBeGreaterThanOrEqual(3);
    expect(reconnectEvents.filter(e => e.type === 'disconnect').length).toBeGreaterThanOrEqual(2);
    
    // Verify unique server IDs in responses
    console.log('🔄 Verifying responses from different server instances...');
    const uniqueServerIds = new Set(serverResponses.map(r => r.serverId).filter(Boolean));
    expect(uniqueServerIds.size).toBeGreaterThanOrEqual(2);
    
    // Log event counts
    console.log(`🔄 Reconnect events: ${reconnectEvents.length} (${reconnectEvents.filter(e => e.type === 'connect').length} connects, ${reconnectEvents.filter(e => e.type === 'disconnect').length} disconnects)`);
    console.log(`🔄 Server responses: ${serverResponses.length} from ${uniqueServerIds.size} different servers`);
    
    console.log('🔄 Test completed successfully');
  }, 30000); // 30 second timeout
});