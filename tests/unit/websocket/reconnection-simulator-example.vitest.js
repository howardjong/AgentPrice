/**
 * Socket.IO Reconnection Simulator Example
 * 
 * This example demonstrates how to test application-level reconnection behavior
 * using the event-driven simulation approach instead of actual server restarts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSocketTestEnv } from './socketio-test-utilities';
import { createReconnectionSimulator, createClientReconnectionHandler } from './reconnection-event-simulator';

describe('Socket.IO Reconnection Simulator Example', () => {
  let testEnv;
  let reconnectionSimulator;
  
  beforeEach(() => {
    // Create test environment
    testEnv = createSocketTestEnv();
    console.log(`Test server started on port ${testEnv.port}`);
    
    // Create reconnection simulator attached to our server
    reconnectionSimulator = createReconnectionSimulator(testEnv.io);
  });
  
  afterEach(async () => {
    // Clean up all resources
    reconnectionSimulator.reset();
    await testEnv.shutdown();
    console.log('Test environment shut down');
  });
  
  it('should handle application reconnection using the event simulator', async () => {
    // Mock application with business logic that depends on socket connections
    const mockApplication = {
      isConnected: false,
      messageQueue: [],
      lastProcessedId: 100,
      
      // This would be our application's connection handler
      handleConnection() {
        this.isConnected = true;
        console.log('Application connected to server');
      },
      
      // This would be our application's disconnection handler
      handleDisconnection() {
        this.isConnected = false;
        console.log('Application disconnected from server');
      },
      
      // This would be our application's recovery handler
      handleRecovery(recoveredData) {
        if (recoveredData && recoveredData.pendingMessages) {
          this.messageQueue = [...recoveredData.pendingMessages];
          this.lastProcessedId = recoveredData.lastSequence;
          console.log(`Application recovered ${this.messageQueue.length} pending messages`);
        }
      }
    };
    
    // Create a client
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100
    });
    
    // Create a reconnection handler for the client
    const reconnectionHandler = createClientReconnectionHandler(client, {
      autoRecover: true,
      debug: true,
      recoveryData: {
        lastSequence: mockApplication.lastProcessedId
      }
    });
    
    // Initialize mock application state on the server
    client.on('connect', () => {
      if (!mockApplication.isConnected) {
        mockApplication.handleConnection();
      }
      
      // Register for events on the server side
      if (client.id) {
        // Server will notify us on disconnect
        reconnectionSimulator.onDisconnect(client.id, () => {
          console.log('Server notified of client disconnection');
          // This would trigger any server-side cleanup needed
        });
        
        // Server will provide pending message data on reconnect
        reconnectionSimulator.onRecover(client.id, (socket, lastSequence, recoveryData) => {
          console.log(`Client requested recovery from sequence ${lastSequence}`);
          
          // In a real app, this would calculate missed messages
          // For the test, we'll just provide some mock pending messages
          const pendingMessages = ['missed_message_1', 'missed_message_2'];
          reconnectionSimulator.queuePendingMessages(client.id, pendingMessages, 105);
        });
      }
    });
    
    // Setup disconnect handling
    client.on('disconnect', () => {
      mockApplication.handleDisconnection();
    });
    
    // Handle recovery data from server
    client.on('__recovery_data', (recoveryData) => {
      mockApplication.handleRecovery(recoveryData);
    });
    
    // Wait for initial connection
    await new Promise(resolve => {
      client.once('connect', resolve);
    });
    
    // Verify initial connection state
    expect(mockApplication.isConnected).toBe(true);
    expect(client.connected).toBe(true);
    
    // Simulate network drop without actually restarting the server
    console.log('Simulating network drop...');
    reconnectionHandler.simulateNetworkDrop();
    
    // Verify disconnect was detected
    await new Promise(resolve => {
      client.once('disconnect', resolve);
    });
    expect(mockApplication.isConnected).toBe(false);
    expect(client.connected).toBe(false);
    
    // Wait for automated reconnection and recovery
    console.log('Waiting for reconnection...');
    const reconnectionResult = await reconnectionHandler.waitForReconnection(3000);
    
    // Verify reconnection completed and recovery data received
    console.log('Reconnection result:', JSON.stringify(reconnectionResult));
    expect(client.connected).toBe(true);
    expect(mockApplication.isConnected).toBe(true);
    expect(mockApplication.messageQueue.length).toBe(2);
    expect(mockApplication.lastProcessedId).toBe(105);
    
    // Verify reconnection state
    const finalState = reconnectionHandler.getState();
    expect(finalState.wasDisconnected).toBe(true);
    expect(finalState.isReconnecting).toBe(false);
    expect(finalState.reconnectCount).toBe(1);
    expect(finalState.recoveryReceived).toBe(true);
    
    // Clean up
    client.removeAllListeners();
    client.disconnect();
  });
  
  it('should allow testing custom reconnection sequences', async () => {
    // Create client with special auth data
    const clientAuth = { userId: 'test-user-123', sessionId: 'abc-xyz' };
    const client = testEnv.createClient({
      reconnection: true,
      reconnectionDelay: 100,
      auth: clientAuth
    });
    
    // Create reconnection handler
    const reconnectionHandler = createClientReconnectionHandler(client, {
      debug: true
    });
    
    // Track authentication status
    let authenticationStatus = {
      initialAuth: null,
      reconnectAuth: null
    };
    
    // Server-side setup
    testEnv.io.on('connection', (socket) => {
      // Check auth data on connection
      if (socket.handshake.auth) {
        if (!authenticationStatus.initialAuth) {
          console.log('Initial authentication:', socket.handshake.auth);
          authenticationStatus.initialAuth = socket.handshake.auth;
        } else {
          console.log('Reconnection authentication:', socket.handshake.auth);
          authenticationStatus.reconnectAuth = socket.handshake.auth;
        }
      }
      
      // Handle custom status query
      socket.on('get_server_status', () => {
        socket.emit('server_status', { status: 'online', time: Date.now() });
      });
    });
    
    // Wait for initial connection
    await new Promise(resolve => {
      client.once('connect', resolve);
    });
    
    // Verify connection and auth
    expect(client.connected).toBe(true);
    expect(authenticationStatus.initialAuth).toEqual(clientAuth);
    
    // Check server status
    let serverStatus = null;
    client.emit('get_server_status');
    await new Promise(resolve => {
      client.once('server_status', (status) => {
        serverStatus = status;
        resolve();
      });
    });
    
    // Verify server responded
    expect(serverStatus.status).toBe('online');
    
    // Simulate network drop
    console.log('Simulating network drop...');
    reconnectionHandler.simulateNetworkDrop();
    
    // Wait for reconnection
    await reconnectionHandler.waitForReconnection(2000);
    
    // Verify reconnection preserved auth data
    expect(authenticationStatus.reconnectAuth).toEqual(clientAuth);
    
    // Verify server communication still works
    let newServerStatus = null;
    client.emit('get_server_status');
    await new Promise(resolve => {
      client.once('server_status', (status) => {
        newServerStatus = status;
        resolve();
      });
    });
    
    // Verify server responded after reconnection
    expect(newServerStatus.status).toBe('online');
    expect(newServerStatus.time).toBeGreaterThan(serverStatus.time);
    
    // Clean up
    client.removeAllListeners();
    client.disconnect();
  });
});