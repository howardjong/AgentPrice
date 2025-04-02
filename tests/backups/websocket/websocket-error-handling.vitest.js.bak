/**
 * WebSocket Error Handling Tests
 * 
 * Tests the WebSocket server's error handling capabilities:
 * - Socket error propagation
 * - Server error handling
 * - Client disconnect recovery
 * - Error state management
 * - Timeout handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server as SocketIoServer } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import { createSocketTestEnv, waitForEvent, waitForConnect } from './socketio-test-utilities';

describe('WebSocket Error Handling', () => {
  let testEnv;
  
  beforeEach(() => {
    testEnv = createSocketTestEnv({
      pingTimeout: 300,
      pingInterval: 200,
      connectTimeout: 500
    });
  });
  
  afterEach(async () => {
    if (testEnv) {
      await testEnv.shutdown();
    }
    vi.clearAllMocks();
  });

  /**
   * Test that verifies server-triggered errors are properly
   * communicated to clients and handled
   */
  it('should handle server-triggered errors', async () => {
    // Set up error handler on server
    const errorHandler = vi.fn();
    testEnv.io.on('error', errorHandler);
    
    // Create an event that causes a server error
    testEnv.io.on('connection', (socket) => {
      socket.on('trigger_server_error', () => {
        // This event handler will throw an error
        try {
          throw new Error('Test server error');
        } catch (err) {
          // Server should handle the error
          errorHandler(err);
          // Notify client that error was handled
          socket.emit('error_handled', { message: err.message });
        }
      });
    });
    
    // Connect client and trigger error
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Emit event that will trigger server error
    client.emit('trigger_server_error');
    
    // Wait for error handled response
    const response = await waitForEvent(client, 'error_handled');
    
    // Verify error was handled properly
    expect(errorHandler).toHaveBeenCalled();
    expect(response).toHaveProperty('message', 'Test server error');
    
    // Clean up
    client.disconnect();
  });

  /**
   * Test that verifies client-side socket error handling
   */
  it('should handle client socket errors', async () => {
    // Set up error mock
    const clientErrorHandler = vi.fn();
    
    // Set up server to trigger an error on the client
    testEnv.io.on('connection', (socket) => {
      socket.on('trigger_client_error', () => {
        // Send malformed data to trigger client-side error handling
        socket.emit('malformed_data', { incomplete: true });
      });
    });
    
    // Connect client
    const client = testEnv.createClient();
    
    // Set up client error handler
    client.on('error', clientErrorHandler);
    
    // Wait for connection
    await waitForConnect(client);
    
    // Handle the malformed data error
    client.on('malformed_data', (data) => {
      try {
        // This would normally throw an error in real code
        if (data.incomplete) {
          throw new Error('Malformed data received');
        }
      } catch (err) {
        clientErrorHandler(err);
      }
    });
    
    // Trigger the client error
    client.emit('trigger_client_error');
    
    // Give time for the error to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify error was handled
    expect(clientErrorHandler).toHaveBeenCalled();
    expect(clientErrorHandler.mock.calls[0][0].message).toBe('Malformed data received');
    
    // Clean up
    client.disconnect();
  });

  /**
   * Test that verifies socket middleware error handling
   */
  it('should handle errors in socket middleware', async () => {
    // Reset test environment to add middleware
    if (testEnv) {
      await testEnv.shutdown();
    }
    
    testEnv = createSocketTestEnv();
    
    // Create error middleware
    const middlewareErrorHandler = vi.fn();
    
    // Add middleware that will sometimes throw errors
    testEnv.io.use((socket, next) => {
      try {
        // Check auth data
        const auth = socket.handshake.auth;
        if (auth && auth.throwError) {
          throw new Error('Auth middleware error');
        }
        next();
      } catch (err) {
        middlewareErrorHandler(err);
        next(err); // Propagate error
      }
    });
    
    // Connect client that will trigger middleware error
    const clientWithErrorAuth = testEnv.createClient({
      auth: { throwError: true }
    });
    
    // Set up error handler
    const connectErrorHandler = vi.fn();
    clientWithErrorAuth.on('connect_error', connectErrorHandler);
    
    // Wait for connect_error event with timeout
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 500); // Max wait time
      
      clientWithErrorAuth.on('connect_error', (err) => {
        clearTimeout(timeout);
        resolve();
      });
    });
    
    // Verify error was handled properly
    expect(middlewareErrorHandler).toHaveBeenCalled();
    expect(connectErrorHandler).toHaveBeenCalled();
    
    // Verify client did not connect
    expect(clientWithErrorAuth.connected).toBe(false);
    
    // Create a valid client to verify middleware allows correct connections
    const validClient = testEnv.createClient();
    
    // Should connect successfully
    await waitForConnect(validClient);
    
    // Verify client connected
    expect(validClient.connected).toBe(true);
    
    // Clean up
    validClient.disconnect();
  });

  /**
   * Test that verifies proper handling of connection timeouts
   */
  it('should handle connection timeouts', async () => {
    // Create a server that never completes connection
    if (testEnv) {
      await testEnv.shutdown();
    }
    
    testEnv = createSocketTestEnv({
      connectTimeout: 200 // Very short timeout for testing
    });
    
    // Add middleware that never calls next() to simulate timeout
    testEnv.io.use((socket, next) => {
      // Never call next() to simulate hanging middleware
      // This will trigger a timeout
    });
    
    // Connect client with very short timeout
    const client = testEnv.createClient({
      timeout: 300 // Client timeout should be longer than server timeout
    });
    
    // Track connect_error events
    const connectErrorHandler = vi.fn();
    client.on('connect_error', connectErrorHandler);
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify error was triggered and connection failed
    expect(connectErrorHandler).toHaveBeenCalled();
    expect(client.connected).toBe(false);
  });

  /**
   * Test that verifies error handling when server closes unexpectedly
   */
  it('should handle server close errors', async () => {
    // Set up server with normal behavior
    testEnv.io.on('connection', (socket) => {
      socket.on('message', (data) => {
        socket.emit('response', data);
      });
    });
    
    // Connect client
    const client = testEnv.createClient();
    
    // Set up error and disconnect handlers
    const disconnectHandler = vi.fn();
    client.on('disconnect', disconnectHandler);
    
    // Wait for connection
    await waitForConnect(client);
    
    // Verify basic communication works
    client.emit('message', 'test');
    const response = await waitForEvent(client, 'response');
    expect(response).toBe('test');
    
    // Close server to simulate crash
    testEnv.server.close();
    
    // Wait for disconnect event
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 500);
      client.once('disconnect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    
    // Verify disconnect was detected
    expect(disconnectHandler).toHaveBeenCalled();
    expect(client.connected).toBe(false);
  });

  /**
   * Test that verifies clean disconnection handling
   */
  it('should handle clean disconnections', async () => {
    // Set up server with client tracking
    const connectedClients = new Set();
    
    testEnv.io.on('connection', (socket) => {
      connectedClients.add(socket.id);
      
      socket.on('disconnect', () => {
        connectedClients.delete(socket.id);
      });
    });
    
    // Connect client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Verify client is tracked
    expect(connectedClients.size).toBe(1);
    
    // Disconnect gracefully
    client.disconnect();
    
    // Wait for server to process disconnect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify client is no longer tracked
    expect(connectedClients.size).toBe(0);
  });

  /**
   * Test that verifies handling of socket.io namespace errors
   */
  it('should handle namespace errors', async () => {
    // Create a namespace with error handling
    const namespace = testEnv.io.of('/error-namespace');
    const namespaceErrorHandler = vi.fn();
    
    namespace.on('connection', (socket) => {
      socket.on('trigger_namespace_error', () => {
        try {
          throw new Error('Namespace error');
        } catch (err) {
          namespaceErrorHandler(err);
          socket.emit('namespace_error_handled', { message: err.message });
        }
      });
    });
    
    // Connect client to namespace
    const client = ioc(`${testEnv.clientURL}/error-namespace`, {
      transports: ['websocket'],
      reconnectionAttempts: 0,
      timeout: 500
    });
    
    // Track for cleanup
    testEnv.activeClients.add(client);
    
    // Wait for connection
    await waitForConnect(client);
    
    // Trigger namespace error
    client.emit('trigger_namespace_error');
    
    // Wait for error response
    const response = await waitForEvent(client, 'namespace_error_handled');
    
    // Verify error was properly handled
    expect(namespaceErrorHandler).toHaveBeenCalled();
    expect(response).toHaveProperty('message', 'Namespace error');
    
    // Clean up
    client.disconnect();
  });
});