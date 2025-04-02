/**
 * WebSocket Broadcast Function Tests
 * 
 * Tests the WebSocket broadcast functionality specifically.
 * Focuses on testing the broadcast patterns:
 * - Broadcasting to all clients
 * - Broadcasting to specific rooms
 * - Broadcasting to individual clients
 * - Message filtering based on subscriptions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

// Mock message types for testing
const MESSAGE_TYPES = {
  SYSTEM_STATUS: 'system_status',
  API_STATUS: 'api_status',
  RESEARCH_PROGRESS: 'research_progress',
  OPTIMIZATION_STATUS: 'optimization_status',
  TEST_MESSAGE: 'test_message'
};

/**
 * Create a test environment with Socket.IO server and multiple clients
 * @returns {Object} Test environment with server and helper functions
 */
function createTestEnvironment() {
  // Create HTTP server with Express
  const app = express();
  const httpServer = createServer(app);
  
  // Create Socket.IO server
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket']
  });
  
  // Track clients and messages
  const connectedClients = [];
  const receivedMessages = {};
  
  // Start server on random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  httpServer.listen(port);
  
  // Create the broadcast function (similar to the one in routes.ts)
  function broadcastMessage(
    message,
    options = {}
  ) {
    if (!io || !message || !message.type) {
      console.warn('Cannot broadcast: missing io, message, or message type');
      return;
    }
    
    // Case 1: Send to specific client by socket ID
    if (options.socketId) {
      io.to(options.socketId).emit('message', message);
      return;
    }
    
    // Case 2: Send to specific rooms
    if (options.roomNames && options.roomNames.length > 0) {
      io.to(options.roomNames).emit('message', message);
      return;
    }
    
    // Case 3: Default - broadcast to message.type room and 'all' room
    io.to([message.type, 'all']).emit('message', message);
  }
  
  // Set up connection handler
  io.on('connection', (socket) => {
    // Default subscription to all messages
    socket.join('all');
    
    // Handle subscription requests
    socket.on('subscribe', (channels) => {
      // Join all requested channels
      if (Array.isArray(channels)) {
        channels.forEach(channel => {
          socket.join(channel);
        });
      }
      
      // Confirm subscription
      socket.emit('subscription_confirmed', {
        channels: Array.isArray(channels) ? channels : ['all']
      });
    });
    
    // Handle unsubscribe requests
    socket.on('unsubscribe', (channels) => {
      if (Array.isArray(channels)) {
        channels.forEach(channel => {
          if (channel !== 'all') {
            socket.leave(channel);
          }
        });
      }
      
      // Confirm unsubscription
      socket.emit('unsubscription_confirmed', {
        channels: Array.isArray(channels) ? channels : []
      });
    });
  });
  
  /**
   * Create a client that connects to the server
   * @param {Array} autoSubscribe Channels to automatically subscribe to
   * @returns {Object} Client object with helpers
   */
  function createClient(autoSubscribe = []) {
    const clientId = `client-${connectedClients.length + 1}`;
    const client = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });
    
    // Initialize message tracking for this client
    receivedMessages[clientId] = [];
    
    // Set up message handler
    client.on('message', (message) => {
      receivedMessages[clientId].push(message);
    });
    
    // Set up connection handler
    client.on('connect', () => {
      if (autoSubscribe.length > 0) {
        client.emit('subscribe', autoSubscribe);
      }
    });
    
    // Add client to tracking
    const clientObj = {
      id: clientId,
      socket: client,
      socketId: null,
      getMessages: () => [...receivedMessages[clientId]],
      clearMessages: () => {
        receivedMessages[clientId] = [];
      }
    };
    
    connectedClients.push(clientObj);
    
    return clientObj;
  }
  
  // Return test environment
  return {
    io,
    httpServer,
    port,
    broadcastMessage,
    createClient,
    getClients: () => [...connectedClients],
    getAllMessages: () => ({...receivedMessages}),
    clearAllMessages: () => {
      Object.keys(receivedMessages).forEach(clientId => {
        receivedMessages[clientId] = [];
      });
    },
    cleanup: () => {
      // Disconnect all clients
      connectedClients.forEach(client => {
        client.socket.disconnect();
      });
      
      // Stop server
      return new Promise((resolve) => {
        httpServer.close(() => {
          io.close();
          resolve();
        });
      });
    }
  };
}

describe('WebSocket Broadcast Functionality', () => {
  let testEnv;
  
  beforeEach(() => {
    testEnv = createTestEnvironment();
  });
  
  afterEach(async () => {
    await testEnv.cleanup();
  });
  
  it('should broadcast messages to all clients in room "all"', (done) => {
    // Create clients
    const client1 = testEnv.createClient();
    const client2 = testEnv.createClient();
    const client3 = testEnv.createClient();
    
    // Ensure clients are connected before broadcasting
    setTimeout(() => {
      // Broadcast a message
      testEnv.broadcastMessage({
        type: MESSAGE_TYPES.TEST_MESSAGE,
        timestamp: Date.now(),
        data: { test: true }
      });
      
      // Check that all clients received the message
      setTimeout(() => {
        try {
          const client1Messages = client1.getMessages();
          const client2Messages = client2.getMessages();
          const client3Messages = client3.getMessages();
          
          expect(client1Messages.length).toBe(1);
          expect(client2Messages.length).toBe(1);
          expect(client3Messages.length).toBe(1);
          
          expect(client1Messages[0].type).toBe(MESSAGE_TYPES.TEST_MESSAGE);
          expect(client2Messages[0].type).toBe(MESSAGE_TYPES.TEST_MESSAGE);
          expect(client3Messages[0].type).toBe(MESSAGE_TYPES.TEST_MESSAGE);
          
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    }, 100);
  });
  
  it('should broadcast to specific message type room', (done) => {
    // Create clients with specific subscriptions
    const client1 = testEnv.createClient([MESSAGE_TYPES.SYSTEM_STATUS]);
    const client2 = testEnv.createClient([MESSAGE_TYPES.API_STATUS]);
    const client3 = testEnv.createClient(['all']);
    
    // Wait for subscriptions to be processed
    setTimeout(() => {
      // Broadcast system status message
      testEnv.broadcastMessage({
        type: MESSAGE_TYPES.SYSTEM_STATUS,
        timestamp: Date.now(),
        data: { memory: { usagePercent: 50 } }
      });
      
      // Check message receipt
      setTimeout(() => {
        try {
          // Client 1 and 3 should receive the message, client 2 should not
          const client1Messages = client1.getMessages();
          const client2Messages = client2.getMessages();
          const client3Messages = client3.getMessages();
          
          // Client 1 subscribed to SYSTEM_STATUS should receive
          expect(client1Messages.length).toBeGreaterThan(0);
          expect(client1Messages[0].type).toBe(MESSAGE_TYPES.SYSTEM_STATUS);
          
          // Client 2 subscribed to API_STATUS should not receive
          expect(client2Messages.length).toBe(0);
          
          // Client 3 subscribed to 'all' should receive
          expect(client3Messages.length).toBeGreaterThan(0);
          expect(client3Messages[0].type).toBe(MESSAGE_TYPES.SYSTEM_STATUS);
          
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    }, 100);
  });
  
  it('should broadcast to specific socket ID', (done) => {
    // Create clients
    const client1 = testEnv.createClient();
    const client2 = testEnv.createClient();
    
    // Wait for connections
    setTimeout(() => {
      // Get socket ID (we'll simulate this for the test)
      const socketId = client1.socket.id;
      
      // Broadcast to specific client
      testEnv.broadcastMessage({
        type: MESSAGE_TYPES.TEST_MESSAGE,
        timestamp: Date.now(),
        data: { targetedMessage: true }
      }, { socketId });
      
      // Check message receipt
      setTimeout(() => {
        try {
          const client1Messages = client1.getMessages();
          const client2Messages = client2.getMessages();
          
          // Only client 1 should receive the message
          expect(client1Messages.length).toBe(1);
          expect(client1Messages[0].data.targetedMessage).toBe(true);
          
          // Client 2 should not receive the message
          expect(client2Messages.length).toBe(0);
          
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    }, 100);
  });
  
  it('should broadcast to multiple specific rooms', (done) => {
    // Create clients with specific subscriptions
    const client1 = testEnv.createClient([MESSAGE_TYPES.SYSTEM_STATUS]);
    const client2 = testEnv.createClient([MESSAGE_TYPES.API_STATUS]);
    const client3 = testEnv.createClient([MESSAGE_TYPES.RESEARCH_PROGRESS]);
    
    // Wait for subscriptions to be processed
    setTimeout(() => {
      // Broadcast to specific rooms
      testEnv.broadcastMessage({
        type: 'multi_room_message',
        timestamp: Date.now(),
        data: { multiRoom: true }
      }, { 
        roomNames: [
          MESSAGE_TYPES.SYSTEM_STATUS, 
          MESSAGE_TYPES.API_STATUS
        ] 
      });
      
      // Check message receipt
      setTimeout(() => {
        try {
          const client1Messages = client1.getMessages();
          const client2Messages = client2.getMessages();
          const client3Messages = client3.getMessages();
          
          // Client 1 and 2 should receive the message
          expect(client1Messages.length).toBe(1);
          expect(client2Messages.length).toBe(1);
          
          // Client 3 should not receive the message
          expect(client3Messages.length).toBe(0);
          
          // Check message content
          expect(client1Messages[0].data.multiRoom).toBe(true);
          expect(client2Messages[0].data.multiRoom).toBe(true);
          
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    }, 100);
  });
  
  it('should handle subscription changes correctly', (done) => {
    // Create client with initial subscription
    const client = testEnv.createClient([MESSAGE_TYPES.SYSTEM_STATUS]);
    
    // Wait for initial subscription
    setTimeout(() => {
      // Send a message that the client should receive
      testEnv.broadcastMessage({
        type: MESSAGE_TYPES.SYSTEM_STATUS,
        timestamp: Date.now(),
        data: { first: true }
      });
      
      // Wait for message to be received
      setTimeout(() => {
        // Verify first message was received
        const messagesAfterFirst = client.getMessages();
        expect(messagesAfterFirst.length).toBe(1);
        
        // Clear messages
        client.clearMessages();
        
        // Change subscription
        client.socket.emit('unsubscribe', [MESSAGE_TYPES.SYSTEM_STATUS]);
        client.socket.emit('subscribe', [MESSAGE_TYPES.API_STATUS]);
        
        // Wait for subscription change
        setTimeout(() => {
          // Send messages of both types
          testEnv.broadcastMessage({
            type: MESSAGE_TYPES.SYSTEM_STATUS,
            timestamp: Date.now(),
            data: { second: true }
          });
          
          testEnv.broadcastMessage({
            type: MESSAGE_TYPES.API_STATUS,
            timestamp: Date.now(),
            data: { third: true }
          });
          
          // Check that only API_STATUS message was received
          setTimeout(() => {
            try {
              const finalMessages = client.getMessages();
              
              // Should only receive the API_STATUS message
              expect(finalMessages.length).toBe(1);
              expect(finalMessages[0].type).toBe(MESSAGE_TYPES.API_STATUS);
              expect(finalMessages[0].data.third).toBe(true);
              
              done();
            } catch (err) {
              done(err);
            }
          }, 100);
        }, 100);
      }, 100);
    }, 100);
  });
});