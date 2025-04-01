/**
 * Socket.IO Reconnection Advanced Scenarios Testing
 * 
 * This file tests more complex reconnection scenarios to improve coverage.
 * It focuses on room management, namespace handling, error scenarios,
 * middleware persistence, and message queue handling during reconnection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import getPort from 'get-port';

// Local event tracking for debugging
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
 * Send a test message and wait for a response
 */
async function sendTestMessageAndWaitForResponse(client, messageData = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off('test-response');
      reject(new Error('Timeout waiting for test response'));
    }, 2000);
    
    // Setup one-time response handler
    client.once('test-response', (response) => {
      clearTimeout(timer);
      logEvent('test-response-received', response);
      resolve(response);
    });
    
    // Send test message
    const testMessage = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      ...messageData
    };
    logEvent('sending-test-message', testMessage);
    client.emit('test-message', testMessage);
  });
}

/**
 * Helper to create a Socket.IO server with the specified handlers
 */
async function createSocketServer(port, options = {}) {
  const httpServer = createServer();
  const io = new Server(httpServer);
  const serverInstanceId = options.instanceId || Date.now().toString();
  
  // Track rooms and messages for verification
  const roomData = new Map();
  const messageQueue = [];
  
  // Add message handlers
  io.on('connection', (socket) => {
    logEvent('server-connection', { id: socket.id, instanceId: serverInstanceId });
    
    // Track socket room membership
    roomData.set(socket.id, {
      rooms: new Set(['all']), // Default room
      lastActivity: Date.now()
    });
    
    // Join default room
    socket.join('all');
    
    // Basic message handling
    socket.on('test-message', (data) => {
      logEvent('server-test-message', { id: socket.id, data });
      
      socket.emit('test-response', {
        original: data,
        serverInstanceId,
        serverTime: Date.now(),
        socketId: socket.id,
        rooms: Array.from(roomData.get(socket.id)?.rooms || [])
      });
    });
    
    // Room management
    socket.on('join-room', (room) => {
      logEvent('join-room', { socketId: socket.id, room });
      
      socket.join(room);
      
      // Update room tracking
      const userData = roomData.get(socket.id);
      if (userData) {
        userData.rooms.add(room);
        userData.lastActivity = Date.now();
      }
      
      socket.emit('room-joined', { room, success: true });
    });
    
    socket.on('leave-room', (room) => {
      logEvent('leave-room', { socketId: socket.id, room });
      
      socket.leave(room);
      
      // Update room tracking
      const userData = roomData.get(socket.id);
      if (userData) {
        userData.rooms.delete(room);
        userData.lastActivity = Date.now();
      }
      
      socket.emit('room-left', { room, success: true });
    });
    
    // Get current rooms
    socket.on('get-rooms', () => {
      const userData = roomData.get(socket.id);
      const rooms = userData ? Array.from(userData.rooms) : [];
      
      logEvent('get-rooms', { socketId: socket.id, rooms });
      
      socket.emit('rooms-list', {
        rooms,
        socketId: socket.id,
        timestamp: Date.now()
      });
    });
    
    // Broadcast to room
    socket.on('broadcast-to-room', (data) => {
      const { room, message } = data;
      logEvent('broadcast-to-room', { socketId: socket.id, room, message });
      
      // Store message in queue for verification
      messageQueue.push({
        room,
        message,
        senderId: socket.id,
        timestamp: Date.now()
      });
      
      // Broadcast to room (except sender)
      socket.to(room).emit('room-message', {
        room,
        message,
        senderId: socket.id,
        timestamp: Date.now()
      });
    });
    
    // Error scenario simulation
    socket.on('simulate-error', (errorType) => {
      logEvent('simulate-error', { socketId: socket.id, errorType });
      
      if (errorType === 'invalid-room') {
        socket.emit('error-response', {
          type: 'room-error',
          message: 'Invalid room name',
          code: 400
        });
      } else if (errorType === 'server-error') {
        socket.emit('error-response', {
          type: 'server-error',
          message: 'Internal server error',
          code: 500
        });
      } else if (errorType === 'timeout') {
        // Don't respond (simulate timeout)
      } else if (errorType === 'disconnect') {
        socket.disconnect(true);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logEvent('server-disconnect', { id: socket.id, reason });
      
      // In a real app, we might save the room data for reconnection
      // For this test, we'll leave it in the map for post-test verification
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
    roomData,
    messageQueue,
    
    // Get room membership for a socket
    getRooms(socketId) {
      const userData = roomData.get(socketId);
      return userData ? Array.from(userData.rooms) : [];
    },
    
    // Check if socket is in a room
    isInRoom(socketId, roomName) {
      const userData = roomData.get(socketId);
      return userData ? userData.rooms.has(roomName) : false;
    },
    
    // Get messages sent to a room
    getMessagesForRoom(roomName) {
      return messageQueue.filter(msg => msg.room === roomName);
    },
    
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

describe('Socket.IO Advanced Reconnection Scenarios', () => {
  let port;
  
  beforeEach(async () => {
    // Get a random port for each test
    port = await getPort();
    // Clear events array
    events.length = 0;
  });
  
  it('should persist room memberships after reconnection with manual rejoin', async () => {
    console.log('🔄 Starting room membership persistence test');
    const testRooms = ['room1', 'room2', 'all'];
    
    // Setup
    let server = await createSocketServer(port, { instanceId: 'server-1' });
    
    // Create client with reconnection enabled
    const client = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      timeout: 2000
    });
    
    // Setup client event tracking
    client.on('connect', () => logEvent('client-connect', { id: client.id }));
    client.on('disconnect', reason => logEvent('client-disconnect', { id: client.id, reason }));
    client.on('connect_error', err => logEvent('client-connect-error', { message: err.message }));
    client.on('error', err => logEvent('client-error', { message: err.message }));
    
    try {
      // Wait for initial connection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      logEvent('client-connected', { id: client.id });
      
      // Verify default room membership by sending a message
      const initialResponse = await sendTestMessageAndWaitForResponse(client, { type: 'initial' });
      expect(initialResponse.serverInstanceId).toBe(server.instanceId);
      expect(initialResponse.rooms).toContain('all');
      
      // Join test rooms
      for (const room of testRooms) {
        if (room !== 'all') { // already in 'all' by default
          logEvent('joining-room', { room });
          client.emit('join-room', room);
          await waitForEvent(client, 'room-joined');
        }
      }
      
      // Verify room membership
      client.emit('get-rooms');
      const roomsList = await waitForEvent(client, 'rooms-list');
      expect(roomsList.rooms).toEqual(expect.arrayContaining(testRooms));
      logEvent('rooms-verified', { rooms: roomsList.rooms });
      
      // Record original socket ID
      const originalSocketId = client.id;
      
      // Disconnect and restart the server
      logEvent('restarting-server');
      await server.shutdown();
      server = null;
      
      // Wait for client to detect disconnection
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      logEvent('client-disconnected');
      
      // Create new server instance
      server = await createSocketServer(port, { instanceId: 'server-2' });
      
      // Wait for automatic reconnection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      logEvent('client-reconnected', { id: client.id });
      
      // The socket ID should be different after reconnection
      expect(client.id).not.toBe(originalSocketId);
      
      // Check initial room membership after reconnection (should only be in 'all')
      client.emit('get-rooms');
      const roomsAfterReconnect = await waitForEvent(client, 'rooms-list');
      logEvent('rooms-after-reconnect', { rooms: roomsAfterReconnect.rooms });
      
      // Socket.IO doesn't persist room membership across reconnections
      // So we should only be in the default 'all' room initially
      expect(roomsAfterReconnect.rooms).toContain('all');
      expect(roomsAfterReconnect.rooms.length).toBe(1);
      
      // Manually rejoin the rooms
      for (const room of testRooms) {
        if (room !== 'all') { // already in 'all' by default
          logEvent('rejoining-room-after-reconnect', { room });
          client.emit('join-room', room);
          await waitForEvent(client, 'room-joined');
        }
      }
      
      // Verify room membership is restored
      client.emit('get-rooms');
      const roomsAfterRejoin = await waitForEvent(client, 'rooms-list');
      expect(roomsAfterRejoin.rooms).toEqual(expect.arrayContaining(testRooms));
      logEvent('rooms-restored', { rooms: roomsAfterRejoin.rooms });
      
      // Broadcast to a room
      const testMessage = { text: 'Room reconnection test message' };
      client.emit('broadcast-to-room', { room: 'room1', message: testMessage });
      
      // Verify room-specific broadcasting still works after reconnection
      const secondClient = SocketIOClient(`http://localhost:${port}`, {
        reconnection: false
      });
      
      try {
        // Connect and join the target room
        await waitForEvent(secondClient, 'connect');
        secondClient.emit('join-room', 'room1');
        await waitForEvent(secondClient, 'room-joined');
        
        // Send another broadcast
        const broadcastMessage = { text: 'Post-reconnect broadcast test' };
        client.emit('broadcast-to-room', { room: 'room1', message: broadcastMessage });
        
        // Second client should receive the message
        const receivedMessage = await waitForEvent(secondClient, 'room-message');
        expect(receivedMessage.message).toEqual(broadcastMessage);
        logEvent('broadcast-received', receivedMessage);
      } finally {
        // Clean up second client
        if (secondClient) {
          secondClient.disconnect();
          secondClient.removeAllListeners();
        }
      }
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      logEvent('cleanup-starting');
      
      if (client) {
        try {
          client.disconnect();
          client.removeAllListeners();
          logEvent('client-cleanup-complete');
        } catch (e) {
          console.error('Error cleaning up client:', e);
        }
      }
      
      if (server) {
        try {
          await server.shutdown();
          logEvent('server-cleanup-complete');
        } catch (e) {
          console.error('Error cleaning up server:', e);
        }
      }
      
      logEvent('cleanup-complete');
    }
  }, 10000); // 10 second timeout
  
  it('should handle error scenarios during reconnection', async () => {
    console.log('🔄 Starting error scenario during reconnection test');
    
    // Setup
    let server = await createSocketServer(port, { instanceId: 'server-1' });
    
    // Create client with reconnection enabled
    const client = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      timeout: 2000
    });
    
    // Error tracking
    const errors = [];
    
    // Setup client event tracking
    client.on('connect', () => logEvent('client-connect', { id: client.id }));
    client.on('disconnect', reason => logEvent('client-disconnect', { id: client.id, reason }));
    client.on('connect_error', err => {
      logEvent('client-connect-error', { message: err.message });
      errors.push({ type: 'connect_error', message: err.message, time: Date.now() });
    });
    client.on('error', err => {
      logEvent('client-error', { message: err.message });
      errors.push({ type: 'error', message: err.message, time: Date.now() });
    });
    client.on('error-response', data => {
      logEvent('error-response', data);
      errors.push({ type: 'error-response', ...data, time: Date.now() });
    });
    
    try {
      // Wait for initial connection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Verify connection
      const initialResponse = await sendTestMessageAndWaitForResponse(client, { type: 'initial' });
      expect(initialResponse.serverInstanceId).toBe(server.instanceId);
      
      // Record original socket ID
      const originalSocketId = client.id;
      
      // Simulate an error before disconnection
      client.emit('simulate-error', 'server-error');
      
      // Wait for error response
      await waitForEvent(client, 'error-response');
      
      // Verify error was received
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('error-response');
      expect(errors[0].code).toBe(500);
      
      // Disconnect and restart the server
      logEvent('restarting-server');
      await server.shutdown();
      server = null;
      
      // Wait for client to detect disconnection
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      
      // Delay before starting new server to force connect_error
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Client should attempt to reconnect and get connect_error
      // This is a race condition, so we may not always see the connect_error
      
      // Create new server instance
      server = await createSocketServer(port, { instanceId: 'server-2' });
      
      // Wait for automatic reconnection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // The socket ID should be different after reconnection
      expect(client.id).not.toBe(originalSocketId);
      
      // Verify connection to new server
      const reconnectResponse = await sendTestMessageAndWaitForResponse(client, { type: 'reconnect' });
      expect(reconnectResponse.serverInstanceId).toBe(server.instanceId);
      expect(reconnectResponse.original.type).toBe('reconnect');
      
      // Simulate another error after reconnection
      client.emit('simulate-error', 'invalid-room');
      
      // Wait for error response
      await waitForEvent(client, 'error-response');
      
      // Find errors after reconnection
      const postReconnectErrors = errors.filter(e => e.time > reconnectResponse.serverTime);
      expect(postReconnectErrors.length).toBeGreaterThan(0);
      
      // Test complex error handling with another disconnect
      client.emit('simulate-error', 'disconnect');
      
      // Wait for disconnection
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      
      // Wait for reconnection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Verify final connection
      const finalResponse = await sendTestMessageAndWaitForResponse(client, { type: 'final' });
      expect(finalResponse.serverInstanceId).toBe(server.instanceId);
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      if (client) {
        try {
          client.disconnect();
          client.removeAllListeners();
        } catch (e) {
          console.error('Error cleaning up client:', e);
        }
      }
      
      if (server) {
        try {
          await server.shutdown();
        } catch (e) {
          console.error('Error cleaning up server:', e);
        }
      }
    }
  }, 10000); // 10 second timeout
  
  it('should handle multiple clients with reconnection', async () => {
    console.log('🔄 Starting multiple clients reconnection test');
    
    // Setup
    let server = await createSocketServer(port, { instanceId: 'server-1' });
    
    // Create clients
    const createTestClient = () => {
      const client = SocketIOClient(`http://localhost:${port}`, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 100,
        timeout: 2000
      });
      
      // Setup client event tracking
      client.on('connect', () => logEvent(`client-${client.id}-connect`));
      client.on('disconnect', reason => logEvent(`client-${client.id}-disconnect`, { reason }));
      client.on('connect_error', err => logEvent(`client-${client.id}-connect-error`, { message: err.message }));
      
      return client;
    };
    
    const clients = Array(3).fill(null).map(() => createTestClient());
    
    try {
      // Wait for all clients to connect
      await Promise.all(clients.map(client => waitForEvent(client, 'connect')));
      
      // Verify all are connected
      clients.forEach(client => {
        expect(client.connected).toBe(true);
      });
      
      // Get original socket IDs
      const originalIds = clients.map(client => client.id);
      
      // Have all clients join rooms
      const rooms = ['room1', 'room2', 'room3'];
      
      for (let i = 0; i < clients.length; i++) {
        const roomsToJoin = rooms.filter((_, index) => index <= i);
        
        for (const room of roomsToJoin) {
          clients[i].emit('join-room', room);
          await waitForEvent(clients[i], 'room-joined');
        }
      }
      
      // Verify room membership
      for (let i = 0; i < clients.length; i++) {
        clients[i].emit('get-rooms');
        const roomsList = await waitForEvent(clients[i], 'rooms-list');
        const expectedRooms = ['all', ...rooms.filter((_, index) => index <= i)];
        expect(roomsList.rooms).toEqual(expect.arrayContaining(expectedRooms));
      }
      
      // Disconnect and restart the server
      logEvent('restarting-server');
      await server.shutdown();
      server = null;
      
      // Wait for all clients to disconnect
      await Promise.all(clients.map(client => waitForEvent(client, 'disconnect')));
      clients.forEach(client => {
        expect(client.connected).toBe(false);
      });
      
      // Create new server instance
      server = await createSocketServer(port, { instanceId: 'server-2' });
      
      // Wait for all clients to reconnect
      await Promise.all(clients.map(client => waitForEvent(client, 'connect')));
      
      // Verify all reconnected
      clients.forEach((client, i) => {
        expect(client.connected).toBe(true);
        expect(client.id).not.toBe(originalIds[i]);
      });
      
      // Test messaging between clients after reconnection
      // Have all clients re-join their rooms
      for (let i = 0; i < clients.length; i++) {
        const roomsToJoin = rooms.filter((_, index) => index <= i);
        
        for (const room of roomsToJoin) {
          clients[i].emit('join-room', room);
          await waitForEvent(clients[i], 'room-joined');
        }
      }
      
      // Set up listeners for room messages
      const receivedMessages = new Map(clients.map(client => [client.id, []]));
      
      clients.forEach(client => {
        client.on('room-message', (message) => {
          receivedMessages.get(client.id).push(message);
          logEvent(`client-${client.id}-received-message`, message);
        });
      });
      
      // Client 0 sends a message to room1 (should be received by all)
      const testMessage = { text: 'Test broadcast after reconnection', timestamp: Date.now() };
      clients[0].emit('broadcast-to-room', { room: 'room1', message: testMessage });
      
      // Wait for message propagation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify clients 1 and 2 received the message (client 0 is sender, doesn't receive)
      expect(receivedMessages.get(clients[1].id).length).toBeGreaterThan(0);
      expect(receivedMessages.get(clients[2].id).length).toBeGreaterThan(0);
      
      // Client 2 sends a message to room3 (should only be received by itself)
      const exclusiveMessage = { text: 'Exclusive room test', timestamp: Date.now() };
      clients[2].emit('broadcast-to-room', { room: 'room3', message: exclusiveMessage });
      
      // Wait for message propagation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify client 0 and 1 didn't receive the message (only client 2 would, but as sender doesn't receive)
      const client0Msgs = receivedMessages.get(clients[0].id);
      const client1Msgs = receivedMessages.get(clients[1].id);
      
      const hasExclusiveMsg = (msgs) => msgs.some(m => 
        m.message.text === exclusiveMessage.text && 
        m.room === 'room3'
      );
      
      expect(hasExclusiveMsg(client0Msgs)).toBe(false);
      expect(hasExclusiveMsg(client1Msgs)).toBe(false);
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      for (const client of clients) {
        try {
          client.disconnect();
          client.removeAllListeners();
        } catch (e) {
          console.error('Error cleaning up client:', e);
        }
      }
      
      if (server) {
        try {
          await server.shutdown();
        } catch (e) {
          console.error('Error cleaning up server:', e);
        }
      }
    }
  }, 15000); // 15 second timeout
  
  it('should recover from failed reconnection attempts', async () => {
    console.log('🔄 Starting reconnection retry test');
    
    // Setup
    let server = await createSocketServer(port, { instanceId: 'server-1' });
    
    // Create client with multiple reconnection attempts
    const client = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
      timeout: 2000
    });
    
    // Track reconnection attempts
    let reconnectAttempts = 0;
    
    // Setup client event tracking
    client.on('connect', () => logEvent('client-connect', { id: client.id }));
    client.on('disconnect', reason => logEvent('client-disconnect', { id: client.id, reason }));
    client.on('connect_error', err => logEvent('client-connect-error', { message: err.message }));
    client.on('reconnect_attempt', (attemptNumber) => {
      logEvent('reconnect-attempt', { attemptNumber });
      reconnectAttempts++;
    });
    client.on('reconnect_error', (error) => {
      logEvent('reconnect-error', { message: error.message });
    });
    client.on('reconnect_failed', () => {
      logEvent('reconnect-failed');
    });
    client.on('reconnect', (attemptNumber) => {
      logEvent('reconnect-success', { attemptNumber });
    });
    
    try {
      // Wait for initial connection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Verify connection
      const initialResponse = await sendTestMessageAndWaitForResponse(client, { type: 'initial' });
      expect(initialResponse.serverInstanceId).toBe(server.instanceId);
      
      // Disconnect and DON'T restart the server right away
      // This will force the client to make multiple failed reconnection attempts
      logEvent('shutting-down-server-without-restart');
      await server.shutdown();
      server = null;
      
      // Wait for client to detect disconnection
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      
      // Delay to allow multiple reconnection attempts to fail
      // This is a bit of a race condition, but should be enough time for a few attempts
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start the server after some reconnection attempts have occurred
      server = await createSocketServer(port, { instanceId: 'server-2' });
      
      // Wait for reconnection to complete
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Verify we had multiple reconnection attempts
      expect(reconnectAttempts).toBeGreaterThan(1);
      
      // Verify connection to new server
      const reconnectResponse = await sendTestMessageAndWaitForResponse(client, { type: 'reconnect' });
      expect(reconnectResponse.serverInstanceId).toBe(server.instanceId);
      
      // Shut down again to test max attempts (we'll exceed the limit)
      await server.shutdown();
      server = null;
      
      // Wait for client to detect disconnection
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      
      // Create a new client with only 2 reconnection attempts
      const limitedClient = SocketIOClient(`http://localhost:${port}`, {
        reconnection: true,
        reconnectionAttempts: 2,
        reconnectionDelay: 100,
        timeout: 2000
      });
      
      // Track events for the limited client
      let limitedReconnectAttempts = 0;
      let reconnectFailedEvent = false;
      
      limitedClient.on('reconnect_attempt', () => {
        limitedReconnectAttempts++;
      });
      
      limitedClient.on('reconnect_failed', () => {
        reconnectFailedEvent = true;
      });
      
      // Server is down, we expect connection to fail
      const connectionAttemptComplete = new Promise((resolve) => {
        // We expect the connection to fail after reconnectionAttempts
        limitedClient.on('reconnect_failed', resolve);
        
        // Set a timeout as a fallback
        setTimeout(resolve, 2000);
      });
      
      // Wait for connection attempts to complete
      await connectionAttemptComplete;
      
      // Check that we got the expected number of reconnection attempts
      expect(limitedReconnectAttempts).toBeGreaterThanOrEqual(1);
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      if (client) {
        try {
          client.disconnect();
          client.removeAllListeners();
        } catch (e) {
          console.error('Error cleaning up client:', e);
        }
      }
      
      if (server) {
        try {
          await server.shutdown();
        } catch (e) {
          console.error('Error cleaning up server:', e);
        }
      }
    }
  }, 10000); // 10 second timeout
});