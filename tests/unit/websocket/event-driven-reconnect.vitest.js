/**
 * Event-Driven Socket.IO Reconnection Testing
 * 
 * This test demonstrates how to test reconnection behavior using event simulation
 * rather than actual server restarts. This approach is more reliable for automated tests
 * while still verifying application behavior during reconnection scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSocketTestEnv, waitForEvent, waitForConnect } from './socketio-test-utilities';

describe('Socket.IO Event-Driven Reconnection Testing', () => {
  let testEnv;
  
  beforeEach(() => {
    // Create clean test environment for each test
    testEnv = createSocketTestEnv();
    console.log(`Test server created on port ${testEnv.port}`);
  });
  
  afterEach(async () => {
    // Clean up all resources
    await testEnv.shutdown();
    console.log('Test environment shut down');
  });
  
  it('should handle programmatic disconnect and reconnect events', async () => {
    // Setup application reconnection handlers on the server side
    const reconnectionHandlers = {
      onClientDisconnect: null,
      onClientReconnect: null
    };
    
    // Configure server with handlers for reconnection events
    testEnv.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Handler for simulated network disconnection
      socket.on('simulate_network_drop', () => {
        console.log(`Simulating network drop for client: ${socket.id}`);
        
        // Force disconnect but allow reconnection
        socket.disconnect();
        
        // In a real application, this would trigger cleanup/recovery logic
        if (reconnectionHandlers.onClientDisconnect) {
          reconnectionHandlers.onClientDisconnect(socket.id);
        }
      });
      
      // Handler for reconnection event
      socket.on('reconnected', () => {
        console.log(`Client signaled reconnection: ${socket.id}`);
        
        // In a real application, this would restore session state
        if (reconnectionHandlers.onClientReconnect) {
          reconnectionHandlers.onClientReconnect(socket.id);
        }
        
        // Acknowledge the reconnection
        socket.emit('reconnection_acknowledged');
      });
    });
    
    // Mock application behavior by setting up reconnection handlers
    let disconnectCount = 0;
    let reconnectCount = 0;
    
    reconnectionHandlers.onClientDisconnect = (clientId) => {
      console.log(`Application cleanup triggered for client: ${clientId}`);
      disconnectCount++;
    };
    
    reconnectionHandlers.onClientReconnect = (clientId) => {
      console.log(`Application state restored for client: ${clientId}`);
      reconnectCount++;
    };
    
    // Create client with reconnection enabled
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      autoConnect: false
    });
    
    // Manual reconnection handling
    let manualReconnectComplete = false;
    client.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${reason}`);
      
      // Simulate manual reconnection logic in application
      setTimeout(() => {
        console.log('Attempting manual reconnection');
        client.connect();
        
        // Signal our application-level reconnection event once transport reconnects
        client.once('connect', () => {
          console.log('Client transport reconnected, signaling application reconnection');
          client.emit('reconnected');
          manualReconnectComplete = true;
        });
      }, 200);
    });
    
    // Connect client
    client.connect();
    await waitForConnect(client, 1000);
    console.log('Initial connection established');
    
    // Verify initial connection
    expect(client.connected).toBe(true);
    
    // Simulate network drop by requesting server-side disconnect
    console.log('Triggering simulated network drop');
    client.emit('simulate_network_drop');
    
    // Wait for disconnect event
    await waitForEvent(client, 'disconnect', 1000);
    console.log('Client detected disconnection');
    
    // Verify disconnect
    expect(client.connected).toBe(false);
    
    // Wait for reconnection acknowledgment from server
    await waitForEvent(client, 'reconnection_acknowledged', 2000);
    console.log('Reconnection completed and acknowledged by server');
    
    // Verify reconnection
    expect(client.connected).toBe(true);
    expect(manualReconnectComplete).toBe(true);
    
    // Verify application handlers were called
    expect(disconnectCount).toBe(1);
    expect(reconnectCount).toBe(1);
    
    // Clean up client
    client.removeAllListeners();
    client.disconnect();
  });
  
  it('should handle custom reconnection message sequence', async () => {
    // Track application state recovery
    let serverRecoveryState = {
      clientId: null,
      pendingMessages: ['message1', 'message2'],
      lastProcessedId: 123,
      recoveryCompleted: false
    };
    
    // Configure server with handlers for reconnection sequence
    testEnv.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Save client ID
      serverRecoveryState.clientId = socket.id;
      
      // Handle recovery request
      socket.on('request_recovery', (lastProcessedId) => {
        console.log(`Recovery requested with last ID: ${lastProcessedId}`);
        
        // Send any pending messages that weren't processed
        if (lastProcessedId < serverRecoveryState.lastProcessedId) {
          socket.emit('recovery_data', {
            pendingMessages: serverRecoveryState.pendingMessages,
            lastProcessedId: serverRecoveryState.lastProcessedId
          });
        }
        
        serverRecoveryState.recoveryCompleted = true;
      });
      
      // Simulate server-initiated disconnect for testing
      socket.on('simulate_server_restart', () => {
        // In real app, server would shut down, but here we just disconnect client
        socket.disconnect();
      });
    });
    
    // Create client with application-level reconnection logic
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100
    });
    
    // Track client recovery state
    let clientRecoveryState = {
      lastProcessedId: 100, // Intentionally behind server to test recovery
      recoveredMessages: [],
      connected: false,
      reconnected: false
    };
    
    // Set up reconnection logic
    client.on('connect', () => {
      clientRecoveryState.connected = true;
      
      // If this is a reconnection, implement recovery protocol
      if (clientRecoveryState.reconnected) {
        console.log('Reconnected, requesting recovery data');
        client.emit('request_recovery', clientRecoveryState.lastProcessedId);
      }
    });
    
    client.on('disconnect', () => {
      clientRecoveryState.connected = false;
      clientRecoveryState.reconnected = true;
    });
    
    // Handle recovery data
    client.on('recovery_data', (data) => {
      console.log('Received recovery data:', data);
      clientRecoveryState.recoveredMessages = data.pendingMessages;
      clientRecoveryState.lastProcessedId = data.lastProcessedId;
    });
    
    // Wait for initial connection
    await waitForConnect(client, 1000);
    expect(clientRecoveryState.connected).toBe(true);
    
    // Trigger server disconnect/restart simulation
    console.log('Triggering simulated server restart');
    client.emit('simulate_server_restart');
    
    // Wait for disconnect
    await waitForEvent(client, 'disconnect', 1000);
    expect(clientRecoveryState.connected).toBe(false);
    
    // Socket.IO will automatically try to reconnect
    // Wait for reconnection and then recovery data
    await waitForEvent(client, 'connect', 2000);
    await waitForEvent(client, 'recovery_data', 2000);
    
    // Verify recovery completed successfully
    expect(clientRecoveryState.connected).toBe(true);
    expect(clientRecoveryState.recoveredMessages.length).toBe(2);
    expect(clientRecoveryState.lastProcessedId).toBe(123);
    expect(serverRecoveryState.recoveryCompleted).toBe(true);
    
    // Clean up
    client.removeAllListeners();
    client.disconnect();
  });
});