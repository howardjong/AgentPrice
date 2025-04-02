/**
 * Stable Socket.IO Tests
 * 
 * This file demonstrates reliable Socket.IO tests that avoid common timeout issues.
 * It uses the enhanced socket test utilities to ensure proper setup/teardown and event handling.
 * 
 * Key improvements:
 * - Short, predictable timeouts for faster failures
 * - Proper resource cleanup to prevent leaks and hanging tests
 * - Dynamic port allocation to avoid conflicts
 * - Explicit event-based waiting rather than arbitrary sleep
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { 
  createSocketTestEnvironment, 
  waitForConnect, 
  waitForEvent, 
  waitForMessageType,
  createReconnectionHandler
} from '../utils/socket-test-utils.js';

// This is marked as sequential to prevent test interference
describe.sequential('Socket.IO Stable Tests', () => {
  // Shared test environment
  let testEnv;
  
  // Set up a fresh test environment before each test
  beforeEach(async () => {
    console.log('Setting up Socket.IO test environment...');
    testEnv = await createSocketTestEnvironment({ debug: true });
    console.log(`Test environment created on port ${testEnv.port}`);
  });
  
  // Clean up all resources after each test
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    console.log('Cleaning up Socket.IO test environment...');
    if (testEnv) {
      await testEnv.shutdown();
      console.log('Test environment shutdown complete');
    }
  });
  
  // Basic connection test - this validates the setup works
  it('should establish connection and send/receive messages', async () => {
    // Create a client with reconnection disabled (for predictability)
    const client = testEnv.createClient({
      reconnection: false,
      debug: true
    });
    
    // Connect and wait for the connection to complete
    await waitForConnect(client, 1000);
    expect(client.connected).toBe(true);
    
    // Send a ping message
    client.emit('ping');
    
    // Wait for pong response and verify it
    const response = await waitForMessageType(client, 'pong', 1000);
    expect(response).toBeDefined();
    expect(response.type).toBe('pong');
    expect(response.status).toBe('ok');
    
    // Disconnect client (cleanup happens in afterEach)
    client.disconnect();
    
    // Wait for disconnect to complete
    await waitForEvent(client, 'disconnect', 1000);
    expect(client.connected).toBe(false);
  });
  
  // Subscription test - validates room-based functionality
  it('should handle subscription to rooms and receive targeted messages', async () => {
    // Create a client 
    const client = testEnv.createClient({
      reconnection: false,
      debug: true
    });
    
    // Connect
    await waitForConnect(client, 1000);
    
    // Subscribe to a specific room
    client.emit('subscribe', { topics: ['updates'] });
    
    // Wait for subscription confirmation
    const confirmation = await waitForMessageType(client, 'subscription_update', 1000);
    expect(confirmation).toBeDefined();
    expect(confirmation.status).toBe('success');
    expect(confirmation.topics).toContain('updates');
    
    // Send a message to the updates room
    testEnv.broadcastToRoom('updates', {
      type: 'update_notification',
      content: 'Test update',
      timestamp: Date.now()
    });
    
    // Wait for the message
    const message = await waitForMessageType(client, 'update_notification', 1000);
    expect(message).toBeDefined();
    expect(message.content).toBe('Test update');
  });
  
  // Test direct client messaging
  it('should send messages directly to specific clients', async () => {
    // Create two clients
    const clientA = testEnv.createClient({ reconnection: false });
    const clientB = testEnv.createClient({ reconnection: false });
    
    // Connect both clients
    await waitForConnect(clientA, 1000);
    await waitForConnect(clientB, 1000);
    
    // Send message directly to client A
    testEnv.sendToClient(clientA.id, {
      type: 'direct_message',
      content: 'Message for client A',
      timestamp: Date.now()
    });
    
    // Client A should receive the message
    const messageA = await waitForMessageType(clientA, 'direct_message', 1000);
    expect(messageA).toBeDefined();
    expect(messageA.content).toBe('Message for client A');
    
    // Client B should not receive the message (we'll use a short timeout)
    try {
      await waitForMessageType(clientB, 'direct_message', 300);
      // If we get here, the test failed because client B received the message
      expect(true).toBe(false); // Force test failure
    } catch (err) {
      // This is the expected path - client B should timeout waiting for the message
      expect(err.message).toContain('Timeout waiting for message type');
    }
  });
  
  // Basic reconnection test - this simulates the client disconnecting and reconnecting
  it('should detect reconnection and handle reconnection messaging', async () => {
    // Create a client with reconnection enabled
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      reconnectionDelayMax: 200
    });
    
    // Create a reconnection handler
    const reconnHandler = createReconnectionHandler(client, { 
      debug: true,
      waitForSystemStatus: false  // Don't wait for system_status in this simple test
    });
    
    // Connect initially
    await waitForConnect(client, 1000);
    expect(client.connected).toBe(true);
    
    // Store original ID
    const originalId = client.id;
    
    // Simulate disconnection and reconnection
    console.log('Simulating network drop...');
    client.disconnect();
    
    // Wait for disconnect event
    await waitForEvent(client, 'disconnect', 1000);
    expect(client.connected).toBe(false);
    
    // Reconnect
    console.log('Reconnecting...');
    client.connect();
    
    // Wait for reconnection using our handler
    const reconnState = await reconnHandler.waitForReconnection(1000);
    
    // Verify reconnection happened
    expect(client.connected).toBe(true);
    expect(reconnState.wasDisconnected).toBe(true);
    expect(reconnState.reconnected).toBe(true);
    expect(reconnState.reconnectCount).toBeGreaterThan(0);
    expect(reconnState.originalId).toBe(originalId);
    
    // Clean up reconnection handler
    reconnHandler.cleanup();
  });
  
  // Test simulating server restart - uses the more comprehensive approach
  it('should reconnect after simulated server restart', async () => {
    // Create a client with reconnection enabled
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 100,
      reconnectionDelayMax: 300 
    });
    
    // Connect initially
    await waitForConnect(client, 1000);
    
    // Store server-side client count for verification
    const initialClientCount = testEnv.io.engine.clientsCount;
    expect(initialClientCount).toBe(1);
    
    // Simulate server restart by stopping and starting the server
    console.log('Simulating server restart...');
    
    // Set up handlers for reconnection
    let disconnected = false;
    let reconnected = false;
    
    client.once('disconnect', () => {
      disconnected = true;
      console.log('Client detected server disconnect');
    });
    
    client.once('connect', () => {
      if (disconnected) {
        reconnected = true;
        console.log('Client reconnected after server restart');
      }
    });
    
    // First, shutdown just the Socket.IO server (but keep the client)
    await new Promise(resolve => {
      // Force disconnect all sockets
      testEnv.io.disconnectSockets(true);
      
      // Close the server
      testEnv.io.close();
      console.log('Socket.IO server closed');
      
      // Give a moment for disconnect to propagate
      setTimeout(resolve, 200);
    });
    
    // Verify client is disconnected
    expect(client.connected).toBe(false);
    expect(disconnected).toBe(true);
    
    // Restart Socket.IO server on the same HTTP server
    testEnv.io = new SocketIoServer(testEnv.httpServer, {
      cors: { origin: '*' },
      pingTimeout: 300,
      pingInterval: 200
    });
    
    console.log('Socket.IO server restarted, waiting for client to reconnect...');
    
    // Add same basic handlers that main server adds
    testEnv.io.on('connection', (socket) => {
      console.log(`[Test] Client reconnected: ${socket.id}`);
      
      // Add back basic message handler
      socket.on('message', (data) => {
        console.log(`[Test] Message from ${socket.id}:`, data);
      });
      
      // Add basic ping/pong
      socket.on('ping', () => {
        socket.emit('message', {
          type: 'pong',
          time: Date.now(),
          status: 'ok'
        });
      });
    });
    
    // Wait for client to reconnect
    await new Promise((resolve, reject) => {
      // Set timeout to avoid hanging test
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for client reconnection'));
      }, 3000);
      
      // Check periodically for reconnection
      const checkInterval = setInterval(() => {
        if (reconnected && client.connected) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    // Verify client reconnected
    expect(client.connected).toBe(true);
    expect(reconnected).toBe(true);
    
    // Send a ping to verify connectivity
    client.emit('ping');
    
    // Wait for pong to verify bidirectional communication
    const response = await waitForMessageType(client, 'pong', 1000);
    expect(response).toBeDefined();
    expect(response.type).toBe('pong');
  });
});