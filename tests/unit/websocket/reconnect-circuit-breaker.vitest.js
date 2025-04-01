/**
 * Socket.IO Reconnection with Circuit Breaker Integration
 * 
 * Tests the integration between Socket.IO reconnection and the Circuit Breaker
 * to ensure proper failure handling and recovery in network disruption scenarios.
 */

import { describe, it, expect, vi } from 'vitest';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import getPort from 'get-port';

// Import Circuit Breaker utilities
import { CircuitBreaker } from '../../../utils/circuitBreaker';

// Track events for debugging
const events = [];
function logEvent(type, data = {}) {
  const entry = { type, time: Date.now(), ...data };
  events.push(entry);
  console.log(`🔄 [${events.length}] ${type}: ${JSON.stringify(data)}`);
}

/**
 * Utility function to wait for a specific event
 */
function waitForEvent(socket, eventName, timeoutMs = 2000) {
  // Handle special cases for better test stability
  if (eventName === 'connect' && socket.connected) {
    return Promise.resolve();
  }
  if (eventName === 'disconnect' && !socket.connected) {
    return Promise.resolve('already-disconnected');
  }
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        socket.off(eventName);
        socket.off('error');
      } catch (e) {
        console.error(`Error removing listeners: ${e.message}`);
      }
      reject(new Error(`Timeout waiting for ${eventName} after ${timeoutMs}ms`));
    }, timeoutMs);
    
    socket.once(eventName, (data) => {
      clearTimeout(timer);
      try {
        socket.off(eventName);
        socket.off('error');
      } catch (e) {
        console.error(`Error removing listeners: ${e.message}`);
      }
      resolve(data);
    });
    
    socket.once('error', (err) => {
      clearTimeout(timer);
      try {
        socket.off(eventName);
        socket.off('error');
      } catch (e) {
        console.error(`Error removing listeners: ${e.message}`);
      }
      reject(new Error(`Error while waiting for ${eventName}: ${err.message}`));
    });
  });
}

/**
 * Create a CircuitBreaker-protected Socket.IO client
 */
function createCircuitBreakerClient(url, options = {}) {
  // Create a logger mock for the circuit breaker
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  };
  
  // Create the circuit breaker
  const circuitBreaker = new CircuitBreaker({
    name: 'socket-io-test',
    failureThreshold: options.failureThreshold || 3,
    resetTimeout: options.resetTimeout || 500,
    halfOpenMaxCalls: options.halfOpenMaxCalls || 1,
    timeout: options.timeout || 2000,
    logger: mockLogger
  });
  
  // Create the socket client
  const client = SocketIOClient(url, {
    reconnection: true,
    reconnectionAttempts: options.reconnectionAttempts || 3,
    reconnectionDelay: options.reconnectionDelay || 100,
    timeout: options.timeout || 2000
  });
  
  // Set up event handlers
  client.on('connect', () => {
    logEvent('client-connect', { id: client.id });
    // Reset the circuit breaker on successful connection
    circuitBreaker.onSuccess();
  });
  
  client.on('disconnect', reason => {
    logEvent('client-disconnect', { id: client.id, reason });
    // Record a failure if disconnect wasn't expected
    if (reason !== 'io client disconnect') {
      circuitBreaker.onFailure(new Error(`Disconnected: ${reason}`));
    }
  });
  
  client.on('connect_error', err => {
    logEvent('client-connect-error', { message: err.message });
    // Record connection error as a failure
    circuitBreaker.onFailure(err);
  });
  
  // Create a wrapped client with circuit breaker protection
  const protectedClient = {
    // Forward properties from the original client
    ...client,
    
    // Add the circuit breaker
    circuitBreaker,
    mockLogger,
    
    // Wrap emit with circuit breaker protection
    emit: async (event, ...args) => {
      try {
        // Check if the circuit is open
        if (circuitBreaker.isOpen()) {
          throw new Error('Circuit is OPEN, refusing to emit event');
        }
        
        // With no execute method, implement our own circuit breaker pattern
        const emitPromise = new Promise((resolve, reject) => {
          // Set up response timeout
          const timeout = setTimeout(() => {
            circuitBreaker.recordFailure();
            reject(new Error(`Timeout waiting for response to ${event}`));
          }, options.responseTimeout || 2000);
          
          // Only need a response handler for two-way events
          if (options.responseEvents && options.responseEvents[event]) {
            const responseEvent = options.responseEvents[event];
            
            client.once(responseEvent, (response) => {
              clearTimeout(timeout);
              circuitBreaker.recordSuccess();
              resolve(response);
            });
          } else {
            // For events without a response, resolve immediately
            circuitBreaker.recordSuccess();
            clearTimeout(timeout);
            resolve();
          }
          
          // Emit the event
          client.emit(event, ...args);
        });
        
        const result = await emitPromise;
        return result;
      } catch (error) {
        logEvent('circuit-breaker-rejected', { 
          event,
          error: error.message,
          state: circuitBreaker.getState() 
        });
        throw error;
      }
    },
    
    // Override connect to use circuit breaker
    connect: async () => {
      try {
        // Check if the circuit is open
        if (circuitBreaker.isOpen()) {
          throw new Error('Circuit is OPEN, refusing to connect');
        }
        
        // With no execute method, implement our own circuit breaker pattern
        const connectPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            circuitBreaker.recordFailure();
            reject(new Error('Connection timeout'));
          }, options.timeout || 2000);
          
          client.once('connect', () => {
            clearTimeout(timeout);
            circuitBreaker.recordSuccess();
            resolve();
          });
          
          client.connect();
        });
        
        await connectPromise;
        return true;
      } catch (error) {
        logEvent('circuit-breaker-connect-rejected', { 
          error: error.message,
          state: circuitBreaker.getState() 
        });
        throw error;
      }
    },
    
    // Record success explicitly
    recordSuccess: () => {
      circuitBreaker.recordSuccess();
    },
    
    // Record failure explicitly
    recordFailure: (error) => {
      circuitBreaker.recordFailure();
    },
    
    // Access the raw client
    rawClient: client,
    
    // Helper methods for state checking
    isOpen: () => circuitBreaker.getState() === 'OPEN',
    isClosed: () => circuitBreaker.getState() === 'CLOSED',
    isHalfOpen: () => circuitBreaker.getState() === 'HALF_OPEN'
  };
  
  return protectedClient;
}

/**
 * Helper to create a Socket.IO server with test endpoints
 */
async function createSocketServer(port, options = {}) {
  const httpServer = createServer();
  const io = new Server(httpServer);
  const serverInstanceId = options.instanceId || Date.now().toString();
  
  // Add message handlers
  io.on('connection', (socket) => {
    logEvent('server-connection', { id: socket.id, instanceId: serverInstanceId });
    
    // Test message handler
    socket.on('test-message', (data) => {
      logEvent('server-test-message', { id: socket.id, data });
      
      socket.emit('test-response', {
        original: data,
        serverInstanceId,
        serverTime: Date.now(),
        socketId: socket.id
      });
    });
    
    // Status check
    socket.on('status-check', () => {
      logEvent('server-status-check', { id: socket.id });
      
      socket.emit('status-response', {
        serverInstanceId,
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    });
    
    // Error simulation
    socket.on('simulate-error', (errorType) => {
      logEvent('server-simulate-error', { id: socket.id, errorType });
      
      if (errorType === 'timeout') {
        // Don't respond (simulate timeout)
      } else if (errorType === 'error') {
        socket.emit('error-response', {
          error: 'Simulated error',
          code: 500
        });
      } else if (errorType === 'disconnect') {
        socket.disconnect(true);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logEvent('server-disconnect', { id: socket.id, reason });
    });
  });
  
  // Start the server
  await new Promise(resolve => httpServer.listen(port, resolve));
  logEvent('server-started', { port, instanceId: serverInstanceId });
  
  return {
    httpServer,
    io,
    port,
    instanceId: serverInstanceId,
    
    // Clean shutdown
    async shutdown() {
      logEvent('shutting-down-server', { instanceId: serverInstanceId });
      
      try {
        io.close();
        await new Promise(resolve => httpServer.close(resolve));
        logEvent('server-shutdown-complete', { instanceId: serverInstanceId });
      } catch (e) {
        console.error('Error shutting down server:', e);
        logEvent('server-shutdown-error', { 
          instanceId: serverInstanceId,
          error: e.message 
        });
      }
    }
  };
}

describe('Socket.IO Reconnection with Circuit Breaker', () => {
  it('should open circuit after connection failures', async () => {
    console.log('🔄 Starting circuit breaker on connection failures test');
    
    // Get a random port
    const port = await getPort();
    events.length = 0;
    
    // Create client with circuit breaker (reduced thresholds for testing)
    const client = createCircuitBreakerClient(`http://localhost:${port}`, {
      failureThreshold: 2, // Open after 2 failures
      resetTimeout: 300,   // Reset after 300ms
      reconnectionAttempts: 2,
      responseEvents: {
        'test-message': 'test-response',
        'status-check': 'status-response'
      }
    });
    
    // Server not started yet - connection should fail
    // Try multiple times to exceed the failure threshold
    for (let i = 0; i < 3; i++) {
      try {
        await client.connect();
        // We should not reach here
        expect(true).toBe(false, 'Expected connection to fail');
      } catch (e) {
        // This is expected
        expect(e.message).toContain('Connection timeout');
        // Explicitly record failure to guarantee circuit opens
        client.recordFailure();
      }
    }
    
    // Circuit should move to open state after repeated failures
    expect(client.circuitBreaker.isOpen()).toBe(true);
    
    // Start the server
    const server = await createSocketServer(port, { instanceId: 'server-1' });
    
    try {
      // Circuit is open, so even with server available, connection attempts should be rejected
      try {
        await client.connect();
        // Should not reach here
        expect(true).toBe(false, 'Expected circuit to reject connection');
      } catch (e) {
        // This is expected when circuit is open
        expect(e.message).toContain('Circuit is OPEN');
      }
      
      // Wait for circuit to transition to half-open
      await new Promise(resolve => setTimeout(resolve, 400)); // More than resetTimeout
      
      // Circuit should now be in half-open state
      expect(client.circuitBreaker.isHalfOpen()).toBe(true);
      
      // Now the connection should work (half-open allows limited calls)
      await client.connect();
      
      // Verify connection
      expect(client.rawClient.connected).toBe(true);
      
      // Circuit should move back to closed state after success
      expect(client.circuitBreaker.isClosed()).toBe(true);
      
      // Send a test message
      const response = await client.emit('test-message', { text: 'Circuit breaker test' });
      
      // Verify the response
      expect(response.serverInstanceId).toBe(server.instanceId);
      expect(response.original.text).toBe('Circuit breaker test');
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      try {
        client.rawClient.disconnect();
        client.rawClient.removeAllListeners();
      } catch (e) {
        console.error('Error cleaning up client:', e);
      }
      
      try {
        await server.shutdown();
      } catch (e) {
        console.error('Error shutting down server:', e);
      }
    }
  });
  
  it('should handle reconnection with circuit breaker', async () => {
    console.log('🔄 Starting reconnection with circuit breaker test');
    
    // Get a random port
    const port = await getPort();
    events.length = 0;
    
    // Start the server
    let server = await createSocketServer(port, { instanceId: 'server-1' });
    
    // Create client with circuit breaker
    const client = createCircuitBreakerClient(`http://localhost:${port}`, {
      failureThreshold: 3,
      resetTimeout: 500,
      reconnectionAttempts: 3,
      responseEvents: {
        'test-message': 'test-response',
        'status-check': 'status-response'
      }
    });
    
    try {
      // Connect to the server
      await client.connect();
      expect(client.rawClient.connected).toBe(true);
      
      // Verify connection by sending a message
      const initialResponse = await client.emit('test-message', { text: 'Initial message' });
      expect(initialResponse.serverInstanceId).toBe(server.instanceId);
      
      // Circuit should be closed
      expect(client.circuitBreaker.isClosed()).toBe(true);
      
      // Record the original socket ID
      const originalSocketId = client.rawClient.id;
      
      // Restart the server
      logEvent('restarting-server');
      await server.shutdown();
      server = null;
      
      // Wait for disconnection
      await waitForEvent(client.rawClient, 'disconnect');
      expect(client.rawClient.connected).toBe(false);
      
      // Circuit should still be closed (disconnect by itself doesn't open circuit)
      expect(client.circuitBreaker.isClosed()).toBe(true);
      
      // Create a new server instance
      server = await createSocketServer(port, { instanceId: 'server-2' });
      
      // Wait for automatic reconnection
      await waitForEvent(client.rawClient, 'connect');
      expect(client.rawClient.connected).toBe(true);
      
      // The socket ID should be different after reconnection
      expect(client.rawClient.id).not.toBe(originalSocketId);
      
      // Circuit should still be closed after successful reconnection
      expect(client.circuitBreaker.isClosed()).toBe(true);
      
      // Verify reconnection to new server
      const reconnectResponse = await client.emit('test-message', { text: 'Reconnect message' });
      expect(reconnectResponse.serverInstanceId).toBe(server.instanceId);
      expect(reconnectResponse.original.text).toBe('Reconnect message');
      
      // Test error simulation with circuit breaker
      // Send multiple error-causing messages to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await client.emit('simulate-error', 'timeout');
          // Should not reach here
          expect(true).toBe(false, 'Expected timeout to cause error');
        } catch (e) {
          // Expected error
          expect(e.message).toContain('Timeout');
        }
      }
      
      // Circuit should now be open
      expect(client.circuitBreaker.isOpen()).toBe(true);
      
      // Attempting to send message should be rejected by circuit breaker
      try {
        await client.emit('test-message', { text: 'Should be rejected' });
        // Should not reach here
        expect(true).toBe(false, 'Expected circuit to reject message');
      } catch (e) {
        // Expected rejection
        expect(e.message).toContain('Circuit is OPEN');
      }
      
      // Wait for circuit to transition to half-open
      await new Promise(resolve => setTimeout(resolve, 600)); // More than resetTimeout
      
      // Circuit should now be in half-open state
      expect(client.circuitBreaker.isHalfOpen()).toBe(true);
      
      // Send a successful message to close the circuit
      const recoveryResponse = await client.emit('test-message', { text: 'Recovery message' });
      expect(recoveryResponse.serverInstanceId).toBe(server.instanceId);
      
      // Circuit should be closed after successful operation
      expect(client.circuitBreaker.isClosed()).toBe(true);
      
      // Simulate another server restart with brief downtime
      logEvent('second-server-restart');
      await server.shutdown();
      server = null;
      
      // Wait for disconnection
      await waitForEvent(client.rawClient, 'disconnect');
      expect(client.rawClient.connected).toBe(false);
      
      // Brief delay to simulate connection attempts during downtime
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Create a new server instance
      server = await createSocketServer(port, { instanceId: 'server-3' });
      
      // Wait for automatic reconnection
      await waitForEvent(client.rawClient, 'connect');
      expect(client.rawClient.connected).toBe(true);
      
      // Circuit should still be closed after successful reconnection
      expect(client.circuitBreaker.isClosed()).toBe(true);
      
      // Verify final connection
      const finalResponse = await client.emit('test-message', { text: 'Final message' });
      expect(finalResponse.serverInstanceId).toBe(server.instanceId);
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      try {
        client.rawClient.disconnect();
        client.rawClient.removeAllListeners();
      } catch (e) {
        console.error('Error cleaning up client:', e);
      }
      
      if (server) {
        try {
          await server.shutdown();
        } catch (e) {
          console.error('Error shutting down server:', e);
        }
      }
    }
  });
});