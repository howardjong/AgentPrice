/**
 * Direct Multi-Client WebSocket Test
 * 
 * This test directly tests WebSocket broadcasting between multiple clients
 * with a very minimal setup to isolate the test from potential issues in 
 * the helper utilities.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server as SocketIoServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import express from 'express';
import { createServer } from 'http';
import getPort from 'get-port';

describe('Direct Multi-Client WebSocket Test', () => {
  let app;
  let httpServer;
  let io;
  let port;
  let clients = [];
  
  beforeEach(async () => {
    // Create a clean server for each test
    app = express();
    httpServer = createServer(app);
    
    // Get a random port
    port = await getPort();
    
    // Create Socket.IO server
    io = new SocketIoServer(httpServer, {
      cors: { origin: '*' }
    });
    
    // Clear clients array
    clients = [];
    
    // Handle socket connections
    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      // Join default room
      socket.join('all');
      
      // Handle room subscription
      socket.on('join', (roomName) => {
        console.log(`${socket.id} joining room: ${roomName}`);
        socket.join(roomName);
        
        // Send confirmation
        socket.emit('message', {
          type: 'join_confirmed',
          room: roomName
        });
      });
    });
    
    // Start the server
    await new Promise(resolve => {
      httpServer.listen(port, () => {
        console.log(`Test server listening on port ${port}`);
        resolve();
      });
    });
  });
  
  afterEach(async () => {
    // Clean up resources
    console.log('Cleaning up test resources...');
    
    // Close all clients
    for (const client of clients) {
      if (client.connected) {
        client.disconnect();
      }
    }
    
    // Close the server
    if (io) {
      io.close();
    }
    
    await new Promise(resolve => {
      if (httpServer) {
        httpServer.close(() => {
          console.log('Server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
  
  // Helper function to create a connected socket.io client
  async function createConnectedClient() {
    return new Promise((resolve, reject) => {
      const client = SocketIOClient(`http://localhost:${port}`, {
        forceNew: true
      });
      
      // Store for cleanup
      clients.push(client);
      
      // Set up handlers
      client.on('connect', () => {
        console.log(`Client connected: ${client.id}`);
        resolve(client);
      });
      
      client.on('connect_error', (err) => {
        console.error(`Client connection error: ${err.message}`);
        reject(err);
      });
      
      // Connect
      client.connect();
      
      // Add timeout
      setTimeout(() => {
        if (!client.connected) {
          reject(new Error('Client connection timeout'));
        }
      }, 1000);
    });
  }
  
  // Helper function to wait for a message of a specific type
  function waitForMessageType(client, messageType, timeoutMs = 1000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeoutMs);
      
      const handler = (data) => {
        if (data.type === messageType) {
          clearTimeout(timeout);
          client.off('message', handler);
          resolve(data);
        }
      };
      
      client.on('message', handler);
    });
  }
  
  it('should deliver messages to clients in the correct rooms', async () => {
    // Create three clients
    const client1 = await createConnectedClient();
    const client2 = await createConnectedClient();
    const client3 = await createConnectedClient();
    
    // Join different rooms
    client1.emit('join', 'room1');
    client2.emit('join', 'room2');
    client3.emit('join', 'room1'); // Join same room as client1
    
    // Wait for join confirmations
    await waitForMessageType(client1, 'join_confirmed');
    await waitForMessageType(client2, 'join_confirmed');
    await waitForMessageType(client3, 'join_confirmed');
    
    // Verify room memberships by logging server-side
    console.log('Room memberships:');
    for (const [roomName, sockets] of io.sockets.adapter.rooms.entries()) {
      // Skip socket ID rooms
      if (io.sockets.sockets.has(roomName)) {
        continue;
      }
      
      console.log(`- Room ${roomName}: ${Array.from(sockets).length} socket(s)`);
    }
    
    // Send a message to room1
    io.to('room1').emit('message', {
      type: 'room1_message',
      content: 'Hello room1'
    });
    
    // Send a message to room2
    io.to('room2').emit('message', {
      type: 'room2_message',
      content: 'Hello room2'
    });
    
    // Send a message to all
    io.to('all').emit('message', {
      type: 'all_message',
      content: 'Hello everyone'
    });
    
    // Client 1 should receive room1_message
    const client1Room1Msg = await waitForMessageType(client1, 'room1_message');
    expect(client1Room1Msg.content).toBe('Hello room1');
    
    // Client 2 should receive room2_message
    const client2Room2Msg = await waitForMessageType(client2, 'room2_message');
    expect(client2Room2Msg.content).toBe('Hello room2');
    
    // Client 3 should receive room1_message
    const client3Room1Msg = await waitForMessageType(client3, 'room1_message');
    expect(client3Room1Msg.content).toBe('Hello room1');
    
    // All clients should receive all_message
    const client1AllMsg = await waitForMessageType(client1, 'all_message');
    const client2AllMsg = await waitForMessageType(client2, 'all_message');
    const client3AllMsg = await waitForMessageType(client3, 'all_message');
    
    expect(client1AllMsg.content).toBe('Hello everyone');
    expect(client2AllMsg.content).toBe('Hello everyone');
    expect(client3AllMsg.content).toBe('Hello everyone');
  });
});