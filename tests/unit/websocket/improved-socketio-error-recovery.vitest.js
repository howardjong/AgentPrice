/**
 * Improved Socket.IO Error Recovery Tests
 * 
 * These tests verify that Socket.IO error recovery mechanisms work correctly,
 * avoiding timeouts and ensuring proper cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSocketTestEnv, waitForEvent, waitForConnect } from './socketio-test-utilities';

describe('Socket.IO Error Recovery Mechanisms - Improved', () => {
  let testEnv;
  
  beforeEach(() => {
    // Setup test environment with fast timeouts
    testEnv = createSocketTestEnv();
  });
  
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    // Ensure all clients are disconnected first
    testEnv.disconnectAllClients();
    // Clean up server
    await testEnv.shutdown();
    vi.clearAllMocks();
  });

  it('should handle server errors gracefully', async () => {
    // Simulate server-side error handling
    testEnv.io.on('connection', (socket) => {
      // Setup a handler that will throw an error
      socket.on('trigger_error', () => {
        try {
          // Simulate an internal server error
          throw new Error('Simulated server error');
        } catch (err) {
          // But catch it and emit an error event
          socket.emit('server_error', { 
            message: 'Internal server error',
            code: 500
          });
        }
      });
    });
    
    // Create client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Trigger the error on the server
    client.emit('trigger_error');
    
    // Wait for server_error event
    const error = await waitForEvent(client, 'server_error', 300);
    
    // Verify the error data
    expect(error).toBeDefined();
    expect(error.message).toBe('Internal server error');
    expect(error.code).toBe(500);
    
    // Verify client is still connected despite the error
    expect(client.connected).toBe(true);
    
    // Explicitly disconnect to ensure cleanup
    client.disconnect();
  });
  
  it('should handle reconnection properly', async () => {
    // Create a flag to track connections
    let connectionCount = 0;
    
    // Setup connection handler
    testEnv.io.on('connection', (socket) => {
      connectionCount++;
      socket.emit('welcome', { connectionCount });
      
      // Add handler to simulate disconnection
      socket.on('force_disconnect', () => {
        socket.disconnect(true);
      });
    });
    
    // Create client with reconnection enabled (2 attempts only)
    const client = testEnv.createClient({
      reconnectionAttempts: 2,
      reconnectionDelay: 100
    });
    
    // Wait for initial connection
    await waitForConnect(client);
    
    // Get initial welcome message
    const initialWelcome = await waitForEvent(client, 'welcome', 300);
    expect(initialWelcome.connectionCount).toBe(1);
    
    // Set up reconnect event promise before disconnecting
    const reconnectPromise = waitForEvent(client, 'reconnect', 500);
    
    // Force disconnect from server side
    client.emit('force_disconnect');
    
    // Wait for reconnection event
    await reconnectPromise;
    
    // Wait for welcome message after reconnection
    const reconnectWelcome = await waitForEvent(client, 'welcome', 500);
    expect(reconnectWelcome.connectionCount).toBe(2);
    
    // Verify client is connected
    expect(client.connected).toBe(true);
    
    // Disconnect client
    client.disconnect();
  });
  
  it('should handle authentication failures properly', async () => {
    // Set up authentication middleware
    testEnv.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
      if (token !== 'valid-token') {
        return next(new Error('Invalid authentication token'));
      }
      
      // Valid token, allow connection
      socket.authenticated = true;
      next();
    });
    
    // First try with invalid token - should fail
    const invalidClient = testEnv.createClient();
    invalidClient.auth = { token: 'invalid-token' };
    
    // Wait for error event
    try {
      await waitForConnect(invalidClient, 300);
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      // Should fail with auth error
      expect(error.message).toContain('Connection error: Invalid authentication token');
    }
    
    // Ensure disconnected
    invalidClient.disconnect();
    
    // Now try with valid token - should succeed
    const validClient = testEnv.createClient();
    validClient.auth = { token: 'valid-token' };
    
    await waitForConnect(validClient, 300);
    
    // Valid client should connect successfully
    expect(validClient.connected).toBe(true);
    validClient.disconnect();
  });
  
  it('should handle namespace errors properly', async () => {
    // Create a specific namespace with authentication
    const adminNamespace = testEnv.createNamespace('/admin');
    
    // Set up authentication for the admin namespace
    adminNamespace.use((socket, next) => {
      const isAdmin = socket.handshake.auth.isAdmin;
      
      if (!isAdmin) {
        return next(new Error('Admin privileges required'));
      }
      
      next();
    });
    
    // Connect to the main namespace first (should work)
    const mainClient = testEnv.createClient();
    await waitForConnect(mainClient, 300);
    
    // Now try the admin namespace without privileges - should fail
    const regularClient = testEnv.createClient({
      auth: { isAdmin: false }
    });
    regularClient.close(); // Disconnect from default namespace
    
    // Create client for admin namespace without privileges
    const unauthorizedClient = testEnv.io.connect(`${testEnv.clientURL}/admin`);
    
    try {
      await waitForConnect(unauthorizedClient, 300);
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      // Should fail with admin privileges error
      expect(error.message).toContain('Connection error');
    }
    
    // Ensure disconnected
    if (unauthorizedClient.connected) {
      unauthorizedClient.disconnect();
    }
    
    // Try with admin privileges - should work
    const adminClient = testEnv.io.connect(`${testEnv.clientURL}/admin`, {
      auth: { isAdmin: true }
    });
    
    await waitForConnect(adminClient, 300);
    
    // Admin client should connect successfully
    expect(adminClient.connected).toBe(true);
    
    // Clean up
    adminClient.disconnect();
    mainClient.disconnect();
  });
  
  it('should recover middleware failures with backoff strategy', async () => {
    // Create counter for failure simulations
    let connectionAttempts = 0;
    
    // Setup middleware that will fail initially but succeed after multiple attempts
    testEnv.io.use((socket, next) => {
      connectionAttempts++;
      
      if (connectionAttempts <= 2) {
        // Fail the first two attempts
        next(new Error(`Middleware failure #${connectionAttempts}`));
      } else {
        // Succeed on the third attempt
        next();
      }
    });
    
    // Create client with reconnection enabled
    const client = testEnv.createClient({
      reconnectionAttempts: 5,
      reconnectionDelay: 50
    });
    
    // Store connect errors for later verification
    const connectErrors = [];
    
    // Listen for connect errors
    client.on('connect_error', (err) => {
      connectErrors.push(err.message);
    });
    
    // Wait for successful connection (may take multiple attempts)
    const connectPromise = new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 1000);
    });
    
    // Race promises
    await Promise.race([connectPromise, timeoutPromise]);
    
    // Verify errors and connection
    expect(connectErrors.length).toBeGreaterThanOrEqual(2);
    expect(connectErrors[0]).toBe('Middleware failure #1');
    expect(connectErrors[1]).toBe('Middleware failure #2');
    expect(client.connected).toBe(true);
    
    // Clean up
    client.disconnect();
  });
});