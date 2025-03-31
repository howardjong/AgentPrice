/**
 * Event-Driven Socket.IO Reconnection Testing (Improved)
 * 
 * This test demonstrates how to test reconnection behavior using event simulation
 * rather than actual server restarts. This approach is more reliable for automated tests
 * while still verifying application behavior during reconnection scenarios.
 * 
 * Key improvements:
 * - Uses standard Socket.IO events for reconnection detection
 * - Implements explicit waiting for each step of the reconnection process
 * - Uses proper cleanup to prevent resource leaks and timeout issues
 * - Provides detailed logging for better test diagnostics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSocketTestEnv, waitForEvent, waitForConnect } from './socketio-test-utilities';
import { createClientReconnectionHandler } from './reconnection-event-simulator';

describe('Socket.IO Event-Driven Reconnection Testing', () => {
  let testEnv;
  let activeClients = [];
  
  // Debug logging
  const log = (...args) => {
    console.log('[Test]', ...args);
  };
  
  beforeEach(() => {
    // Create clean test environment for each test
    testEnv = createSocketTestEnv();
    log(`Test server created on port ${testEnv.port}`);
    activeClients = [];
  });
  
  afterEach(async () => {
    log('Running test cleanup');
    
    // Clean up all clients 
    for (const client of activeClients) {
      try {
        if (client.cleanup) {
          // Use our enhanced cleanup if available
          client.cleanup();
        } else if (client.socket) {
          // For wrapped clients
          if (client.socket.io && client.socket.io.opts) {
            client.socket.io.opts.reconnection = false;
          }
          client.socket.removeAllListeners();
          if (client.socket.connected) {
            client.socket.disconnect();
          }
        } else {
          // Regular Socket.IO client
          if (client.io && client.io.opts) {
            client.io.opts.reconnection = false;
          }
          client.removeAllListeners();
          if (client.connected) {
            client.disconnect();
          }
        }
      } catch (err) {
        log(`Error cleaning up client: ${err.message}`);
      }
    }
    
    // Clean up test environment
    await testEnv.shutdown();
    log('Test environment shut down');
  });
  
  it('should handle programmatic disconnect and reconnect events', async () => {
    // Setup application reconnection handlers on the server side
    const reconnectionHandlers = {
      onClientDisconnect: null,
      onClientReconnect: null
    };
    
    // Configure server with handlers for reconnection events
    testEnv.io.on('connection', (socket) => {
      log(`Client connected: ${socket.id}`);
      
      // Handler for simulated network disconnection
      socket.on('simulate_network_drop', () => {
        log(`Simulating network drop for client: ${socket.id}`);
        
        // In a real application, this would trigger cleanup/recovery logic
        if (reconnectionHandlers.onClientDisconnect) {
          reconnectionHandlers.onClientDisconnect(socket.id);
        }
        
        // Force disconnect but allow reconnection
        socket.disconnect();
      });
      
      // Handle explicit application reconnection
      socket.on('app_reconnected', () => {
        log(`Client signaled application reconnection: ${socket.id}`);
        
        // In a real application, this would restore session state
        if (reconnectionHandlers.onClientReconnect) {
          reconnectionHandlers.onClientReconnect(socket.id);
        }
        
        // Acknowledge the reconnection
        socket.emit('app_reconnection_acknowledged');
      });
    });
    
    // Mock application behavior by setting up reconnection handlers
    let disconnectCount = 0;
    let reconnectCount = 0;
    
    reconnectionHandlers.onClientDisconnect = (clientId) => {
      log(`Application cleanup triggered for client: ${clientId}`);
      disconnectCount++;
    };
    
    reconnectionHandlers.onClientReconnect = (clientId) => {
      log(`Application state restored for client: ${clientId}`);
      reconnectCount++;
    };
    
    // Create client with reconnection enabled but limited attempts
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      autoConnect: false
    });
    
    // Track the client for cleanup
    activeClients.push(client);
    
    // Create a reconnection handler for cleaner event tracking
    const clientHandler = {
      socket: client,
      appReconnected: false,
      
      // Application-specific handlers
      handleDisconnect: function(reason) {
        log(`Application handling disconnect: ${reason}`);
      },
      
      handleReconnect: function() {
        log('Application handling reconnection');
        this.appReconnected = true;
        // Signal application-level reconnection to server
        this.socket.emit('app_reconnected');
      }
    };
    
    // Add to tracked clients for cleanup
    activeClients.push(clientHandler);
    
    // Set up client disconnect handler
    client.on('disconnect', (reason) => {
      log(`Client disconnected: ${reason}`);
      clientHandler.handleDisconnect(reason);
      
      // Socket.IO will handle the transport reconnection automatically
    });
    
    // Set up client reconnect handler (uses standard Socket.IO event)
    client.on('connect', () => {
      // Skip initial connection
      if (clientHandler.appReconnected === false && client.connected) {
        log('Initial connection established');
      } else if (clientHandler.appReconnected === false) {
        log('Transport reconnection detected');
        // This means the socket transport reconnected, signal application-level reconnection
        clientHandler.handleReconnect();
      }
    });
    
    // Set up reconnection acknowledgment handler
    client.on('app_reconnection_acknowledged', () => {
      log('Server acknowledged application reconnection');
    });
    
    // Connect client
    client.connect();
    await waitForConnect(client, 1000);
    
    // Verify initial connection
    expect(client.connected).toBe(true);
    
    // Simulate network drop by requesting server-side disconnect
    log('Triggering simulated network drop');
    client.emit('simulate_network_drop');
    
    // Wait for disconnect event
    await waitForEvent(client, 'disconnect', 1000);
    
    // Verify disconnect
    expect(client.connected).toBe(false);
    
    // Socket.IO should automatically attempt to reconnect
    // Wait for reconnection (standard Socket.IO event)
    await waitForEvent(client, 'connect', 2000);
    
    // At this point, the transport is reconnected, but application needs to complete its reconnection
    
    // Wait for application-level reconnection acknowledgment
    await waitForEvent(client, 'app_reconnection_acknowledged', 2000);
    log('Reconnection complete and acknowledged');
    
    // Verify reconnection state
    expect(client.connected).toBe(true);
    expect(clientHandler.appReconnected).toBe(true);
    
    // Verify application handlers were called
    expect(disconnectCount).toBe(1);
    expect(reconnectCount).toBe(1);
  });
  
  it('should handle custom recovery sequence using the reconnection handler', async () => {
    // Track application state recovery
    let serverState = {
      pendingMessages: ['message1', 'message2'],
      lastProcessedId: 123,
      recoveryRequested: false,
      recoveryCompleted: false
    };
    
    // Configure server with handlers for data recovery
    testEnv.io.on('connection', (socket) => {
      log(`Client connected: ${socket.id}`);
      
      // Handle recovery request
      socket.on('request_recovery', (lastProcessedId) => {
        log(`Recovery requested with last ID: ${lastProcessedId}`);
        serverState.recoveryRequested = true;
        
        // Send any pending messages that weren't processed
        if (lastProcessedId < serverState.lastProcessedId) {
          socket.emit('recovery_data', {
            pendingMessages: serverState.pendingMessages,
            lastProcessedId: serverState.lastProcessedId
          });
        }
        
        serverState.recoveryCompleted = true;
      });
      
      // Simulate server-initiated disconnect for testing
      socket.on('simulate_server_restart', () => {
        log('Simulating server-initiated disconnect');
        // Disconnect the client from server-side
        socket.disconnect();
      });
    });
    
    // Create client with automatic reconnection enabled
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      forceNew: true
    });
    
    // Create a reconnection handler for this client
    const reconnectionHandler = createClientReconnectionHandler(client, {
      debug: true,
      recoveryData: { lastSequence: 100 } // Intentionally behind server to test recovery
    });
    
    // Track these for cleanup
    activeClients.push(client);
    activeClients.push(reconnectionHandler); // This will use the cleanup method
    
    // Track client application state
    let appState = {
      recoveredMessages: [],
      lastProcessedId: 0,
      initialConnectionComplete: false,
      reconnectionComplete: false
    };
    
    // Add custom recovery handling
    client.on('recovery_data', (data) => {
      log('Application received recovery data:', data);
      appState.recoveredMessages = data.pendingMessages;
      appState.lastProcessedId = data.lastProcessedId;
    });
    
    // Wait for initial connection
    await waitForConnect(client, 1000);
    appState.initialConnectionComplete = true;
    expect(client.connected).toBe(true);
    
    // Trigger server disconnect simulation
    log('Triggering simulated server restart');
    client.emit('simulate_server_restart');
    
    // Wait for disconnect
    await waitForEvent(client, 'disconnect', 1000);
    expect(client.connected).toBe(false);
    
    // Wait for reconnection to complete using our handler
    // This will wait for transport reconnection AND recovery data
    log('Waiting for reconnection sequence to complete');
    const reconnectionResult = await reconnectionHandler.waitForReconnection(3000);
    log('Reconnection sequence completed:', reconnectionResult);
    
    appState.reconnectionComplete = true;
    
    // Verify recovery completed successfully
    expect(client.connected).toBe(true);
    expect(appState.recoveredMessages.length).toBe(2);
    expect(appState.lastProcessedId).toBe(123);
    expect(serverState.recoveryRequested).toBe(true);
    expect(serverState.recoveryCompleted).toBe(true);
    
    // Verify reconnection handler state
    const finalState = reconnectionHandler.getState();
    expect(finalState.wasDisconnected).toBe(true);
    expect(finalState.recoveryReceived).toBe(true);
  });
});