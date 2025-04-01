/**
 * Socket.IO Connection Management Test
 * 
 * This test focuses on the core connection management functionality of Socket.IO
 * in our application, including:
 * 
 * 1. Connection establishment
 * 2. Client tracking
 * 3. Room management
 * 4. Disconnection handling
 * 5. Error handling
 * 
 * Using the event-driven approach recommended in our Socket.IO testing best practices.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io as ioc } from 'socket.io-client';
import { Server as SocketIoServer } from 'socket.io';
import { createServer } from 'http';
import getPort from 'get-port';
import express from 'express';

// Helper function to wait for a specific event
function waitForEvent(emitter, event) {
  return new Promise((resolve) => {
    const handler = (...args) => {
      emitter.off(event, handler);
      resolve(args);
    };
    emitter.on(event, handler);
  });
}

// Helper function to create a test Socket.IO environment
async function createTestEnvironment() {
  // Create an Express app
  const app = express();
  const httpServer = createServer(app);
  
  // Get a dynamic port to avoid conflicts
  const port = await getPort();
  
  // Track clients for cleanup
  const connectedClients = new Map();
  
  // Create Socket.IO server with test-optimized settings
  const io = new SocketIoServer(httpServer, {
    path: '/socket.io',
    cors: { origin: '*' },
    transports: ['websocket'], // Use websocket only for faster tests
    pingTimeout: 200,  // Very short timeouts for faster tests
    pingInterval: 200,
    connectionStateRecovery: false, // Disable recovery for cleaner test state
    maxHttpBufferSize: 1e5 // Smaller buffer size for tests
  });
  
  // Setup basic connection handling
  io.on('connection', (socket) => {
    console.log(`[Server] Client connected: ${socket.id}`);
    
    // Track connected clients with metadata
    connectedClients.set(socket.id, {
      id: socket.id,
      lastActivity: Date.now(),
      joinedRooms: ['all']
    });
    
    // Add socket to the default room
    socket.join('all');
    
    // Listen for room join requests
    socket.on('join_room', (room) => {
      console.log(`[Server] Client ${socket.id} joining room: ${room}`);
      socket.join(room);
      
      // Update metadata
      const metadata = connectedClients.get(socket.id);
      if (metadata) {
        metadata.joinedRooms.push(room);
        metadata.lastActivity = Date.now();
      }
      
      // Confirm room joined
      socket.emit('room_joined', { room });
    });
    
    // Listen for room messages
    socket.on('room_message', ({ room, message }) => {
      console.log(`[Server] Client ${socket.id} sent message to room ${room}: ${message}`);
      io.to(room).emit('room_message_received', { room, message, sender: socket.id });
    });
    
    // Disconnect handling
    socket.on('disconnect', (reason) => {
      console.log(`[Server] Client disconnected: ${socket.id}, reason: ${reason}`);
      // Clean up tracked client
      connectedClients.delete(socket.id);
    });
    
    // Error handling
    socket.on('error', (error) => {
      console.error(`[Server] Socket error for client ${socket.id}:`, error);
    });
  });
  
  // Start the server
  await new Promise(resolve => httpServer.listen(port, resolve));
  console.log(`[Test] Test server started on port ${port}`);
  
  // Return the test environment
  return {
    app,
    httpServer,
    io,
    port,
    connectedClients,
    createClient: (options = {}) => {
      return ioc(`http://localhost:${port}`, {
        path: '/socket.io',
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        timeout: 1000,
        ...options
      });
    },
    shutdown: async () => {
      return new Promise((resolve) => {
        // First disconnect all clients
        try {
          io.disconnectSockets(true);
        } catch (err) {
          console.error('[Test] Error disconnecting sockets:', err);
        }
        
        // Next close the Socket.IO server
        try {
          io.close();
        } catch (err) {
          console.error('[Test] Error closing Socket.IO:', err);
        }
        
        // Set a shorter timeout for server close
        const timeout = setTimeout(() => {
          console.log('[Test] Server close timed out, forcing exit');
          resolve();
        }, 300);
        
        // Finally close the HTTP server
        httpServer.close(() => {
          clearTimeout(timeout);
          console.log('[Test] Server closed cleanly');
          resolve();
        });
      });
    }
  };
}

describe('Socket.IO Connection Management', () => {
  let testEnv;
  let activeClients = [];
  
  // Set up a fresh environment for each test
  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    activeClients = [];
  });
  
  // Clean up after each test
  afterEach(async () => {
    // Clean up any clients that were created
    for (const client of activeClients) {
      try {
        // First, remove all listeners to prevent reconnection attempts
        client.removeAllListeners();
        
        // Then disconnect the client if it's connected
        if (client.connected) {
          client.disconnect();
        }
      } catch (err) {
        console.error('[Test] Error cleaning up client:', err);
      }
    }
    
    // Shut down the test environment
    if (testEnv) {
      await testEnv.shutdown();
    }
  });
  
  // Test basic connection
  it('should establish a connection and track client metadata', async () => {
    // Create and track a client
    const client = testEnv.createClient();
    activeClients.push(client);
    
    // Connect and wait for the connect event
    await waitForEvent(client, 'connect');
    
    // Verify connection was successful
    expect(client.connected).toBe(true);
    
    // Verify server is tracking the client
    expect(testEnv.connectedClients.size).toBe(1);
    expect(testEnv.connectedClients.has(client.id)).toBe(true);
    
    // Verify client metadata
    const metadata = testEnv.connectedClients.get(client.id);
    expect(metadata).toBeDefined();
    expect(metadata.id).toBe(client.id);
    expect(metadata.joinedRooms).toContain('all');
  });
  
  // Test joining rooms
  it('should handle room joining and deliver room-specific messages', async () => {
    // Create and track clients
    const client1 = testEnv.createClient();
    const client2 = testEnv.createClient();
    activeClients.push(client1, client2);
    
    // Connect both clients
    await waitForEvent(client1, 'connect');
    await waitForEvent(client2, 'connect');
    
    // Join different rooms
    const testRoom = 'test-room';
    client1.emit('join_room', testRoom);
    
    // Wait for room join confirmation
    const [joinConfirmation] = await waitForEvent(client1, 'room_joined');
    expect(joinConfirmation.room).toBe(testRoom);
    
    // Client 2 stays in the default room only
    
    // Test room-specific message (only client1 should receive)
    client1.once('room_message_received', (data) => {
      // Verify message data
      expect(data.room).toBe(testRoom);
      expect(data.message).toBe('Hello test room');
      expect(data.sender).toBe(client1.id);
    });
    
    // Send a message to the test room
    client1.emit('room_message', { room: testRoom, message: 'Hello test room' });
    
    // Wait for message processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check server-side room tracking
    const metadata = testEnv.connectedClients.get(client1.id);
    expect(metadata.joinedRooms).toContain(testRoom);
    
    // Test broadcast to 'all' room (both clients should receive)
    const messageFromClient1Promise = waitForEvent(client1, 'room_message_received');
    const messageFromClient2Promise = waitForEvent(client2, 'room_message_received');
    
    // Send message to 'all' room
    client2.emit('room_message', { room: 'all', message: 'Hello everyone' });
    
    // Wait for and verify both clients received the message
    const [messageToClient1] = await messageFromClient1Promise;
    const [messageToClient2] = await messageFromClient2Promise;
    
    expect(messageToClient1.room).toBe('all');
    expect(messageToClient1.message).toBe('Hello everyone');
    expect(messageToClient1.sender).toBe(client2.id);
    
    expect(messageToClient2.room).toBe('all');
    expect(messageToClient2.message).toBe('Hello everyone');
    expect(messageToClient2.sender).toBe(client2.id);
  });
  
  // Test disconnect handling
  it('should handle client disconnection and clean up resources', async () => {
    // Create and track a client
    const client = testEnv.createClient();
    activeClients.push(client);
    
    // Connect and verify connection
    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
    
    // Store client ID for later verification
    const clientId = client.id;
    
    // Verify initial tracking
    expect(testEnv.connectedClients.size).toBe(1);
    expect(testEnv.connectedClients.has(clientId)).toBe(true);
    
    // Disconnect the client
    client.disconnect();
    
    // Wait for cleanup to occur (this might take a moment)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify client was removed from tracking
    expect(testEnv.connectedClients.has(clientId)).toBe(false);
  });
  
  // Test error handling
  it('should handle connection errors gracefully', async () => {
    // Mock error event
    const errorSpy = vi.fn();
    const connectionErrorSpy = vi.fn();
    
    // Add error handlers to the server
    testEnv.io.engine.on('connection_error', connectionErrorSpy);
    
    // Create client and listen for errors
    const client = testEnv.createClient();
    client.on('error', errorSpy);
    activeClients.push(client);
    
    // Connect
    await waitForEvent(client, 'connect');
    
    // Manually trigger a socket error
    const socketInstance = Array.from(testEnv.io.sockets.sockets.values())[0];
    socketInstance.emit('error', new Error('Test error'));
    
    // Wait for error handling to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Client should still be connected despite the error
    expect(client.connected).toBe(true);
    
    // Check if server is still tracking the client
    expect(testEnv.connectedClients.has(client.id)).toBe(true);
  });
  
  // Test connection after server restarts (simulating timeout recovery)
  it('should handle server restarts', async () => {
    // First, create a client and verify initial connection
    const client = testEnv.createClient();
    activeClients.push(client);
    
    // Connect
    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
    
    // Disconnect the client
    client.disconnect();
    
    // Shut down the server completely
    await testEnv.shutdown();
    
    // Create a new test environment (simulating a server restart)
    testEnv = await createTestEnvironment();
    
    // Create a new client after the "restart"
    const newClient = testEnv.createClient();
    activeClients.push(newClient);
    
    // Connect the new client to the restarted server
    await waitForEvent(newClient, 'connect');
    
    // Verify new connection works on the restarted server
    expect(newClient.connected).toBe(true);
    expect(testEnv.connectedClients.has(newClient.id)).toBe(true);
  });
});