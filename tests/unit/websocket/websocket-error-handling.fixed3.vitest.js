/**
 * WebSocket Error Handling Tests
 * Using improved patterns for Socket.IO testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

// Setup test environment with short timeouts
function createTestEnv() {
  // Create HTTP server with Express
  const app = express();
  const httpServer = createServer(app);
  
  // Create mock error handlers
  const errorHandlers = {
    socket: vi.fn(),
    connection: vi.fn(),
    server: vi.fn()
  };
  
  // Create Socket.IO server
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'], // Only use websocket for tests
    pingTimeout: 300,  // Very short timeout for tests
    connectTimeout: 500
  });
  
  // Setup connection handler
  io.on('connection', (socket) => {
    console.log(`Test client connected: ${socket.id}`);
    
    // Handle socket errors
    socket.on('error', (err) => {
      console.log(`Socket error: ${err.message}`);
      errorHandlers.socket(err);
    });
    
    // Echo messages for testing basic functionality
    socket.on('echo', (data) => {
      socket.emit('echo_response', data);
    });
    
    // Handle error triggering
    socket.on('trigger_error', (type) => {
      console.log(`Triggering error: ${type}`);
      
      if (type === 'socket') {
        // Simulate socket error
        const error = new Error('Intentional socket error');
        errorHandlers.socket(error);
        socket.emit('error_triggered', { message: error.message });
      } else if (type === 'disconnect') {
        // Force disconnect the socket
        socket.disconnect(true);
      }
    });
    
    // Handle room message test
    socket.on('join_room', (room) => {
      socket.join(room);
      socket.emit('room_joined', { room });
    });
    
    socket.on('room_message', ({ room, message }) => {
      // Send to specific room properly - key fix
      io.to(room).emit('room_message_received', { room, message });
    });
    
    // Disconnect handler
    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });
  
  // Handle connection errors
  io.engine.on('connection_error', (err) => {
    console.log(`Connection error: ${err.message}`);
    errorHandlers.connection(err);
  });
  
  // Start server on random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  const server = httpServer.listen(port);
  
  return {
    io,
    httpServer,
    server,
    port,
    errorHandlers,
    createClient: () => {
      return ioc(`http://localhost:${port}`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 1,
        reconnectionDelay: 50,
        timeout: 500
      });
    },
    cleanup: () => {
      return new Promise((resolve) => {
        // Force close all connections
        io.disconnectSockets(true);
        
        // Set a short timeout for cleanup
        const timeout = setTimeout(() => {
          console.log('Server close timed out, forcing exit');
          resolve();
        }, 300);
        
        // Close the server properly if possible
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
        
        // Make sure Socket.IO server is properly closed
        try {
          io.close();
        } catch (e) {
          console.error('Error closing Socket.IO server:', e);
        }
      });
    }
  };
}

describe('WebSocket Error Handling', () => {
  let testEnv;
  
  beforeEach(() => {
    testEnv = createTestEnv();
  });
  
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    if (testEnv && testEnv.cleanup) {
      await testEnv.cleanup();
    }
  });
  
  it('should connect successfully and handle basic communication', async () => {
    const client = testEnv.createClient();
    const testData = { message: 'hello' };
    
    try {
      // Wait for connection with timeout
      await Promise.race([
        new Promise((resolve) => client.on('connect', resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 500))
      ]);
      
      // Send message and wait for response
      const response = await Promise.race([
        new Promise((resolve) => {
          client.on('echo_response', (data) => resolve(data));
          client.emit('echo', testData);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Echo timeout')), 500))
      ]);
      
      expect(response).toEqual(testData);
    } finally {
      if (client.connected) {
        client.disconnect();
      }
    }
  });
  
  it('should handle socket errors gracefully', async () => {
    const client = testEnv.createClient();
    
    try {
      // Reset the mock
      testEnv.errorHandlers.socket.mockReset();
      
      // Wait for connection
      await Promise.race([
        new Promise((resolve) => client.on('connect', resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 500))
      ]);
      
      // Trigger socket error
      client.emit('trigger_error', 'socket');
      
      // Wait for error confirmation
      await Promise.race([
        new Promise((resolve) => client.on('error_triggered', resolve)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Error trigger timeout')), 500))
      ]);
      
      // Wait a bit for the error handler to be called
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(testEnv.errorHandlers.socket).toHaveBeenCalled();
    } finally {
      if (client.connected) {
        client.disconnect();
      }
    }
  });
  
  it('should broadcast messages to rooms properly', async () => {
    const client1 = testEnv.createClient();
    const client2 = testEnv.createClient();
    const testRoom = 'test-room';
    const testMessage = { text: 'room message test' };
    
    try {
      // Connect both clients
      await Promise.all([
        Promise.race([
          new Promise(resolve => client1.on('connect', resolve)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Client 1 connection timeout')), 500))
        ]),
        Promise.race([
          new Promise(resolve => client2.on('connect', resolve)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Client 2 connection timeout')), 500))
        ])
      ]);
      
      // Join test room with client 1
      await Promise.race([
        new Promise(resolve => {
          client1.on('room_joined', (data) => resolve(data));
          client1.emit('join_room', testRoom);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Room join timeout')), 500))
      ]);
      
      // Join test room with client 2
      await Promise.race([
        new Promise(resolve => {
          client2.on('room_joined', (data) => resolve(data));
          client2.emit('join_room', testRoom);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Room join timeout')), 500))
      ]);
      
      // Send a message to the room from client 1 and verify it's received by client 2
      const receivedMessage = await Promise.race([
        new Promise(resolve => {
          client2.on('room_message_received', (data) => resolve(data));
          client1.emit('room_message', { room: testRoom, message: testMessage });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Room message timeout')), 500))
      ]);
      
      expect(receivedMessage.room).toBe(testRoom);
      expect(receivedMessage.message).toEqual(testMessage);
    } finally {
      if (client1.connected) client1.disconnect();
      if (client2.connected) client2.disconnect();
    }
  });
});