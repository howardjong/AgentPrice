/**
 * Minimal Socket.IO Broadcasting Test
 * 
 * This file contains a minimal set of tests for Socket.IO room broadcasting
 * using the simplest possible setup to eliminate potential issues in helper utilities.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server as SocketIoServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import express from 'express';
import { createServer } from 'http';
import getPort from 'get-port';

describe('Minimal Socket.IO Broadcasting', () => {
  let port;
  let app;
  let server;
  let io;
  let clientsToCleanup = [];
  
  beforeEach(async () => {
    // Create a basic Express app and HTTP server
    app = express();
    server = createServer(app);
    
    // Get a random available port
    port = await getPort();
    
    // Start the server
    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
    
    // Set up Socket.IO server
    io = new SocketIoServer(server);
    
    // Set up basic connection handler
    io.on('connection', (socket) => {
      console.log(`Socket ${socket.id} connected`);
      
      // Join default room
      socket.join('all');
      
      // Handle room join requests
      socket.on('join', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
        
        // Send confirmation
        socket.emit('joined', { room });
      });
    });
    
    // Reset clients array
    clientsToCleanup = [];
  });
  
  afterEach(async () => {
    // Clean up clients
    for (const client of clientsToCleanup) {
      if (client && client.connected) {
        client.disconnect();
      }
    }
    
    // Close Socket.IO server
    if (io) {
      io.close();
    }
    
    // Close HTTP server
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });
  
  // Helper to create a client and connect it
  async function createClient() {
    const client = SocketIOClient(`http://localhost:${port}`);
    
    // Add to cleanup list
    clientsToCleanup.push(client);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      // Set timeout for connection
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 1000);
      
      client.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      client.once('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    
    return client;
  }
  
  // Helper to wait for a specific event
  function waitForEvent(client, event, timeoutMs = 1000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeoutMs);
      
      client.once(event, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  }
  
  it('should broadcast messages to specific rooms', async () => {
    // Create two clients
    const client1 = await createClient();
    const client2 = await createClient();
    
    // Join different rooms
    client1.emit('join', 'room1');
    client2.emit('join', 'room2');
    
    // Wait for join confirmations
    await waitForEvent(client1, 'joined');
    await waitForEvent(client2, 'joined');
    
    // Set up event promises before broadcasting
    const room1EventPromise = waitForEvent(client1, 'room1Event');
    const room2EventPromise = waitForEvent(client2, 'room2Event');
    const allEventPromise1 = waitForEvent(client1, 'allEvent');
    const allEventPromise2 = waitForEvent(client2, 'allEvent');
    
    // Broadcast to room1 - only client1 should receive
    io.to('room1').emit('room1Event', { message: 'Hello room1' });
    
    // Broadcast to room2 - only client2 should receive
    io.to('room2').emit('room2Event', { message: 'Hello room2' });
    
    // Broadcast to all - both clients should receive
    io.emit('allEvent', { message: 'Hello everyone' });
    
    // Wait for and verify the events
    const room1Event = await room1EventPromise;
    expect(room1Event.message).toBe('Hello room1');
    
    const room2Event = await room2EventPromise;
    expect(room2Event.message).toBe('Hello room2');
    
    const allEvent1 = await allEventPromise1;
    const allEvent2 = await allEventPromise2;
    expect(allEvent1.message).toBe('Hello everyone');
    expect(allEvent2.message).toBe('Hello everyone');
  });
});