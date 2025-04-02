/**
 * Bare Minimum Socket.IO Broadcasting Test
 * 
 * This test file contains the absolute minimum implementation required
 * to test Socket.IO broadcasting functionality reliably.
 */
import { describe, it, expect } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

describe('Bare Minimum Socket.IO Broadcasting', () => {
  it('should broadcast to multiple clients in different rooms', async () => {
    // Create server
    const app = express();
    const server = createServer(app);
    
    // Choose a fixed port to avoid race conditions
    const PORT = 3333;
    
    // Create Socket.IO server
    const io = new Server(server);
    
    // Start server
    server.listen(PORT);
    
    // Setup message tracking
    const receivedMessages = {
      client1: [],
      client2: []
    };
    
    // Create connection handler
    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      // Join room handler
      socket.on('join', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
        
        // Send confirmation directly to client
        socket.emit('joined', { room });
      });
    });
    
    try {
      // Create clients
      const client1 = ioc(`http://localhost:${PORT}`);
      const client2 = ioc(`http://localhost:${PORT}`);
      
      // Setup message handlers before connecting
      client1.on('test-event', (msg) => {
        receivedMessages.client1.push(msg);
      });
      
      client2.on('test-event', (msg) => {
        receivedMessages.client2.push(msg);
      });
      
      // Wait for clients to connect
      await Promise.all([
        new Promise(resolve => client1.on('connect', resolve)),
        new Promise(resolve => client2.on('connect', resolve))
      ]);
      
      console.log('Clients connected');
      
      // Join rooms
      client1.emit('join', 'room1');
      client2.emit('join', 'room2');
      
      // Wait for join confirmations
      await Promise.all([
        new Promise(resolve => client1.once('joined', resolve)),
        new Promise(resolve => client2.once('joined', resolve))
      ]);
      
      console.log('Clients joined rooms');
      
      // Small delay to ensure room joins are processed
      await new Promise(r => setTimeout(r, 100));
      
      // Send message to room1 - only client1 should receive it
      io.to('room1').emit('test-event', { room: 'room1', msg: 'Hello room1' });
      
      // Send message to room2 - only client2 should receive it
      io.to('room2').emit('test-event', { room: 'room2', msg: 'Hello room2' });
      
      // Small delay to allow message processing
      await new Promise(r => setTimeout(r, 100));
      
      // Check messages
      expect(receivedMessages.client1.length).toBe(1);
      expect(receivedMessages.client1[0].room).toBe('room1');
      expect(receivedMessages.client1[0].msg).toBe('Hello room1');
      
      expect(receivedMessages.client2.length).toBe(1);
      expect(receivedMessages.client2[0].room).toBe('room2');
      expect(receivedMessages.client2[0].msg).toBe('Hello room2');
      
      // Cleanup
      client1.disconnect();
      client2.disconnect();
      io.close();
      server.close();
      
    } catch (e) {
      // Ensure cleanup on error
      io.close();
      server.close();
      throw e;
    }
  });
});