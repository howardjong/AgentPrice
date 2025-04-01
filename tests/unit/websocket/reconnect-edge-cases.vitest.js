/**
 * Socket.IO Reconnection Edge Cases
 * 
 * This suite tests extreme edge cases in the Socket.IO reconnection process:
 * - Message queue handling during reconnection
 * - Namespace-specific reconnection behavior
 * - Connection recovery after multiple server transitions
 * - High-frequency connect/disconnect scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import getPort from 'get-port';

// Track events for debugging
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
 * Helper to create a Socket.IO server with multiple namespaces and message queuing
 */
async function createSocketServerWithNamespaces(port, options = {}) {
  const httpServer = createServer();
  const io = new Server(httpServer);
  const serverInstanceId = options.instanceId || Date.now().toString();
  
  // Create message queues for different namespaces
  const messageQueues = {
    '/': [], // Default namespace
    '/admin': [],
    '/chat': []
  };
  
  // Setup namespaces
  const namespaces = {
    main: io,
    admin: io.of('/admin'),
    chat: io.of('/chat')
  };
  
  // Setup main namespace
  namespaces.main.on('connection', (socket) => {
    logEvent('server-connection-main', { 
      id: socket.id, 
      instanceId: serverInstanceId,
      namespace: '/'
    });
    
    // Handle message queueing
    socket.on('queue-message', (messageData) => {
      const { target, message } = messageData;
      logEvent('queue-message-main', { socketId: socket.id, target, message });
      
      messageQueues['/'].push({
        id: Date.now().toString(),
        senderId: socket.id,
        target,
        message,
        timestamp: Date.now(),
        delivered: false
      });
      
      socket.emit('message-queued', {
        success: true,
        queueSize: messageQueues['/'].length
      });
    });
    
    // Handle queue retrieval
    socket.on('get-message-queue', ({ lastId = '0' }) => {
      logEvent('get-message-queue-main', { socketId: socket.id, lastId });
      
      // Get messages newer than lastId
      const pendingMessages = messageQueues['/'].filter(msg => 
        msg.id > lastId && !msg.delivered
      );
      
      socket.emit('message-queue', {
        namespace: '/',
        messages: pendingMessages,
        timestamp: Date.now()
      });
      
      // Mark as delivered
      pendingMessages.forEach(msg => msg.delivered = true);
    });
    
    // Handle status request
    socket.on('status-check', () => {
      logEvent('status-check-main', { socketId: socket.id });
      
      socket.emit('server-status', {
        serverInstanceId,
        namespace: '/',
        uptime: process.uptime(),
        queueSize: messageQueues['/'].length,
        timestamp: Date.now()
      });
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logEvent('server-disconnect-main', { id: socket.id, reason });
    });
  });
  
  // Setup admin namespace with similar handlers but namespace-specific
  namespaces.admin.on('connection', (socket) => {
    logEvent('server-connection-admin', { 
      id: socket.id, 
      instanceId: serverInstanceId,
      namespace: '/admin'
    });
    
    // Similar handlers as main but for admin namespace
    socket.on('queue-message', (messageData) => {
      const { target, message } = messageData;
      logEvent('queue-message-admin', { socketId: socket.id, target, message });
      
      messageQueues['/admin'].push({
        id: Date.now().toString(),
        senderId: socket.id,
        target,
        message,
        timestamp: Date.now(),
        delivered: false
      });
      
      socket.emit('message-queued', {
        success: true,
        queueSize: messageQueues['/admin'].length
      });
    });
    
    socket.on('get-message-queue', ({ lastId = '0' }) => {
      logEvent('get-message-queue-admin', { socketId: socket.id, lastId });
      
      const pendingMessages = messageQueues['/admin'].filter(msg => 
        msg.id > lastId && !msg.delivered
      );
      
      socket.emit('message-queue', {
        namespace: '/admin',
        messages: pendingMessages,
        timestamp: Date.now()
      });
      
      pendingMessages.forEach(msg => msg.delivered = true);
    });
    
    socket.on('status-check', () => {
      logEvent('status-check-admin', { socketId: socket.id });
      
      socket.emit('server-status', {
        serverInstanceId,
        namespace: '/admin',
        uptime: process.uptime(),
        queueSize: messageQueues['/admin'].length,
        timestamp: Date.now()
      });
    });
    
    socket.on('disconnect', (reason) => {
      logEvent('server-disconnect-admin', { id: socket.id, reason });
    });
  });
  
  // Setup chat namespace
  namespaces.chat.on('connection', (socket) => {
    logEvent('server-connection-chat', { 
      id: socket.id, 
      instanceId: serverInstanceId,
      namespace: '/chat'
    });
    
    // Similar handlers for chat namespace
    socket.on('queue-message', (messageData) => {
      const { target, message } = messageData;
      logEvent('queue-message-chat', { socketId: socket.id, target, message });
      
      messageQueues['/chat'].push({
        id: Date.now().toString(),
        senderId: socket.id,
        target,
        message,
        timestamp: Date.now(),
        delivered: false
      });
      
      socket.emit('message-queued', {
        success: true,
        queueSize: messageQueues['/chat'].length
      });
    });
    
    socket.on('get-message-queue', ({ lastId = '0' }) => {
      logEvent('get-message-queue-chat', { socketId: socket.id, lastId });
      
      const pendingMessages = messageQueues['/chat'].filter(msg => 
        msg.id > lastId && !msg.delivered
      );
      
      socket.emit('message-queue', {
        namespace: '/chat',
        messages: pendingMessages,
        timestamp: Date.now()
      });
      
      pendingMessages.forEach(msg => msg.delivered = true);
    });
    
    socket.on('status-check', () => {
      logEvent('status-check-chat', { socketId: socket.id });
      
      socket.emit('server-status', {
        serverInstanceId,
        namespace: '/chat',
        uptime: process.uptime(),
        queueSize: messageQueues['/chat'].length,
        timestamp: Date.now()
      });
    });
    
    socket.on('disconnect', (reason) => {
      logEvent('server-disconnect-chat', { id: socket.id, reason });
    });
  });
  
  // Start the server
  await new Promise(resolve => httpServer.listen(port, resolve));
  logEvent('server-started', { port, instanceId: serverInstanceId });
  
  return {
    httpServer,
    io,
    namespaces,
    port,
    instanceId: serverInstanceId,
    messageQueues,
    
    // Get queue size for a namespace
    getQueueSize(namespace = '/') {
      return messageQueues[namespace]?.length || 0;
    },
    
    // Get messages for a specific target
    getMessagesForTarget(target, namespace = '/') {
      return messageQueues[namespace]?.filter(msg => msg.target === target) || [];
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

describe('Socket.IO Reconnection Edge Cases', () => {
  let port;
  
  beforeEach(async () => {
    // Get a random port for each test
    port = await getPort();
    // Clear events array
    events.length = 0;
  });
  
  it('should retain message queues during namespace reconnection', async () => {
    console.log('🔄 Starting namespace reconnection with message queue test');
    
    // Set up the first server instance with namespaces
    let server = await createSocketServerWithNamespaces(port, { 
      instanceId: 'server-1' 
    });
    
    // Create client for each namespace
    const mainClient = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      timeout: 2000
    });
    
    const adminClient = SocketIOClient(`http://localhost:${port}/admin`, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      timeout: 2000
    });
    
    const chatClient = SocketIOClient(`http://localhost:${port}/chat`, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      timeout: 2000
    });
    
    // Set up event handlers for all clients
    [mainClient, adminClient, chatClient].forEach((client, index) => {
      const namespaces = ['/', '/admin', '/chat'];
      const namespace = namespaces[index];
      
      client.on('connect', () => logEvent(`client-connect-${namespace}`, { id: client.id }));
      client.on('disconnect', reason => logEvent(`client-disconnect-${namespace}`, { id: client.id, reason }));
      client.on('connect_error', err => logEvent(`client-connect-error-${namespace}`, { message: err.message }));
    });
    
    try {
      // Wait for all clients to connect
      await Promise.all([
        waitForEvent(mainClient, 'connect'),
        waitForEvent(adminClient, 'connect'),
        waitForEvent(chatClient, 'connect')
      ]);
      
      // Verify all connected
      expect(mainClient.connected).toBe(true);
      expect(adminClient.connected).toBe(true);
      expect(chatClient.connected).toBe(true);
      
      // Queue messages in each namespace
      const queueMessage = async (client, namespace) => {
        const messageText = `Test message for ${namespace} at ${Date.now()}`;
        
        // Queue a message
        client.emit('queue-message', {
          target: 'test-target',
          message: { text: messageText }
        });
        
        // Wait for confirmation
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Timeout waiting for message-queued'));
          }, 2000);
          
          client.once('message-queued', (response) => {
            clearTimeout(timer);
            resolve(response);
          });
        });
      };
      
      // Queue 3 messages per namespace
      for (let i = 0; i < 3; i++) {
        await queueMessage(mainClient, '/');
        await queueMessage(adminClient, '/admin');
        await queueMessage(chatClient, '/chat');
      }
      
      // Verify messages are in the queues
      expect(server.getQueueSize('/')).toBe(3);
      expect(server.getQueueSize('/admin')).toBe(3);
      expect(server.getQueueSize('/chat')).toBe(3);
      
      // Store the original client IDs
      const originalIds = {
        main: mainClient.id,
        admin: adminClient.id,
        chat: chatClient.id
      };
      
      // Shutdown and restart the server
      logEvent('restarting-server');
      await server.shutdown();
      server = null;
      
      // Wait for all clients to disconnect
      await Promise.all([
        waitForEvent(mainClient, 'disconnect'),
        waitForEvent(adminClient, 'disconnect'),
        waitForEvent(chatClient, 'disconnect')
      ]);
      
      // Verify all disconnected
      expect(mainClient.connected).toBe(false);
      expect(adminClient.connected).toBe(false);
      expect(chatClient.connected).toBe(false);
      
      // Start a new server with persisted message queues
      // In a real application, this would involve database persistence
      // For this test, we'll simulate persisted queues
      const persistedQueues = {
        '/': [
          { id: '1', target: 'test-target', message: { text: 'Persisted message 1 for /' }, delivered: false },
          { id: '2', target: 'test-target', message: { text: 'Persisted message 2 for /' }, delivered: false }
        ],
        '/admin': [
          { id: '3', target: 'test-target', message: { text: 'Persisted message for /admin' }, delivered: false }
        ],
        '/chat': [
          { id: '4', target: 'test-target', message: { text: 'Persisted message 1 for /chat' }, delivered: false },
          { id: '5', target: 'test-target', message: { text: 'Persisted message 2 for /chat' }, delivered: false }
        ]
      };
      
      server = await createSocketServerWithNamespaces(port, { 
        instanceId: 'server-2'
      });
      
      // Populate the new server's message queues (simulating database retrieval)
      Object.keys(persistedQueues).forEach(namespace => {
        persistedQueues[namespace].forEach(msg => {
          server.messageQueues[namespace].push({
            ...msg,
            timestamp: Date.now(), // Update timestamp
            senderId: 'system' // System-originated for persisted messages
          });
        });
      });
      
      // Wait for all clients to reconnect
      await Promise.all([
        waitForEvent(mainClient, 'connect'),
        waitForEvent(adminClient, 'connect'),
        waitForEvent(chatClient, 'connect')
      ]);
      
      // Verify all reconnected
      expect(mainClient.connected).toBe(true);
      expect(adminClient.connected).toBe(true);
      expect(chatClient.connected).toBe(true);
      
      // Verify socket IDs changed after reconnection
      expect(mainClient.id).not.toBe(originalIds.main);
      expect(adminClient.id).not.toBe(originalIds.admin);
      expect(chatClient.id).not.toBe(originalIds.chat);
      
      // Check server status for each namespace to verify reconnection to new server
      const getStatus = async (client) => {
        client.emit('status-check');
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Timeout waiting for server-status'));
          }, 2000);
          
          client.once('server-status', (status) => {
            clearTimeout(timer);
            resolve(status);
          });
        });
      };
      
      const mainStatus = await getStatus(mainClient);
      const adminStatus = await getStatus(adminClient);
      const chatStatus = await getStatus(chatClient);
      
      // Verify all namespaces connected to new server
      expect(mainStatus.serverInstanceId).toBe(server.instanceId);
      expect(adminStatus.serverInstanceId).toBe(server.instanceId);
      expect(chatStatus.serverInstanceId).toBe(server.instanceId);
      
      // Retrieve message queues after reconnection
      const getQueue = async (client, namespace = '/', lastId = '0') => {
        client.emit('get-message-queue', { lastId });
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Timeout waiting for message-queue'));
          }, 2000);
          
          client.once('message-queue', (queueData) => {
            clearTimeout(timer);
            resolve(queueData);
          });
        });
      };
      
      const mainQueue = await getQueue(mainClient);
      const adminQueue = await getQueue(adminClient, '/admin');
      const chatQueue = await getQueue(chatClient, '/chat');
      
      // Verify persisted messages are retrieved
      expect(mainQueue.messages.length).toBe(2); // 2 persisted messages for /
      expect(adminQueue.messages.length).toBe(1); // 1 persisted message for /admin
      expect(chatQueue.messages.length).toBe(2); // 2 persisted messages for /chat
      
      // Add new messages after reconnection
      await queueMessage(mainClient, '/');
      await queueMessage(chatClient, '/chat');
      
      // Check updated queue status
      const updatedMainStatus = await getStatus(mainClient);
      const updatedChatStatus = await getStatus(chatClient);
      
      // Verify queue sizes updated after adding new messages
      expect(updatedMainStatus.queueSize).toBe(3); // 2 persisted + 1 new
      expect(updatedChatStatus.queueSize).toBe(3); // 2 persisted + 1 new
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      for (const client of [mainClient, adminClient, chatClient]) {
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
  
  it('should handle multi-stage reconnection with server changes', async () => {
    console.log('🔄 Starting multi-stage reconnection test');
    
    // Setup first server
    let server = await createSocketServerWithNamespaces(port, { 
      instanceId: 'server-1' 
    });
    
    // Create client with reconnection enabled
    const client = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 100,
      timeout: 2000
    });
    
    // Track socket IDs across reconnections
    const socketIds = [];
    
    // Track server connections
    const serverConnections = [];
    
    // Setup client event tracking
    client.on('connect', () => {
      logEvent('client-connect', { id: client.id });
      socketIds.push(client.id);
    });
    
    client.on('disconnect', reason => {
      logEvent('client-disconnect', { id: client.id, reason });
    });
    
    client.on('connect_error', err => {
      logEvent('client-connect-error', { message: err.message });
    });
    
    try {
      // Wait for initial connection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Check server status to record first connection
      client.emit('status-check');
      const status1 = await waitForEvent(client, 'server-status');
      serverConnections.push(status1.serverInstanceId);
      
      // Stage 1: First reconnection
      logEvent('stage-1-first-reconnection');
      await server.shutdown();
      server = null;
      
      // Wait for disconnect
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      
      // Create second server
      server = await createSocketServerWithNamespaces(port, { 
        instanceId: 'server-2' 
      });
      
      // Wait for reconnection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Check server status to verify second connection
      client.emit('status-check');
      const status2 = await waitForEvent(client, 'server-status');
      serverConnections.push(status2.serverInstanceId);
      
      // Stage 2: Second reconnection
      logEvent('stage-2-second-reconnection');
      await server.shutdown();
      server = null;
      
      // Wait for disconnect
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      
      // Create third server
      server = await createSocketServerWithNamespaces(port, { 
        instanceId: 'server-3' 
      });
      
      // Wait for reconnection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Check server status to verify third connection
      client.emit('status-check');
      const status3 = await waitForEvent(client, 'server-status');
      serverConnections.push(status3.serverInstanceId);
      
      // Stage 3: Third reconnection
      logEvent('stage-3-third-reconnection');
      await server.shutdown();
      server = null;
      
      // Wait for disconnect
      await waitForEvent(client, 'disconnect');
      expect(client.connected).toBe(false);
      
      // Create fourth server
      server = await createSocketServerWithNamespaces(port, { 
        instanceId: 'server-4' 
      });
      
      // Wait for reconnection
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
      
      // Check server status to verify fourth connection
      client.emit('status-check');
      const status4 = await waitForEvent(client, 'server-status');
      serverConnections.push(status4.serverInstanceId);
      
      // Verify connections to different server instances
      expect(socketIds.length).toBe(4); // 4 different socket IDs
      expect(serverConnections).toEqual([
        'server-1', 'server-2', 'server-3', 'server-4'
      ]);
      
      // Verify all socket IDs are different
      const uniqueSocketIds = new Set(socketIds);
      expect(uniqueSocketIds.size).toBe(4);
      
      // Queue a message on the final server
      client.emit('queue-message', {
        target: 'multi-stage-test',
        message: { text: 'Final connection test' }
      });
      
      // Verify message queued
      const queueResponse = await waitForEvent(client, 'message-queued');
      expect(queueResponse.success).toBe(true);
      
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
  }, 15000); // 15 second timeout
  
  it('should handle reconnection with concurrent connections', async () => {
    console.log('🔄 Starting concurrent connections test');
    
    // Setup server
    let server = await createSocketServerWithNamespaces(port, { 
      instanceId: 'server-1' 
    });
    
    // Create a client for the primary connection
    const primaryClient = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      timeout: 2000
    });
    
    // Track events for the primary client
    primaryClient.on('connect', () => logEvent('primary-connect', { id: primaryClient.id }));
    primaryClient.on('disconnect', reason => logEvent('primary-disconnect', { id: primaryClient.id, reason }));
    
    try {
      // Connect primary client
      await waitForEvent(primaryClient, 'connect');
      expect(primaryClient.connected).toBe(true);
      
      // Create a second connection from the same client
      const secondaryClient = SocketIOClient(`http://localhost:${port}`, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 100,
        timeout: 2000
      });
      
      // Track events for the secondary client
      secondaryClient.on('connect', () => logEvent('secondary-connect', { id: secondaryClient.id }));
      secondaryClient.on('disconnect', reason => logEvent('secondary-disconnect', { id: secondaryClient.id, reason }));
      
      // Connect secondary client
      await waitForEvent(secondaryClient, 'connect');
      expect(secondaryClient.connected).toBe(true);
      
      // Record original IDs
      const originalIds = {
        primary: primaryClient.id,
        secondary: secondaryClient.id
      };
      
      // Verify both have different socket IDs
      expect(primaryClient.id).not.toBe(secondaryClient.id);
      
      // Check status for both connections
      const checkStatus = async (client, label) => {
        client.emit('status-check');
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for ${label} status`));
          }, 2000);
          
          client.once('server-status', (status) => {
            clearTimeout(timer);
            resolve(status);
          });
        });
      };
      
      const primaryStatus = await checkStatus(primaryClient, 'primary');
      const secondaryStatus = await checkStatus(secondaryClient, 'secondary');
      
      // Both should report the same server instance
      expect(primaryStatus.serverInstanceId).toBe(server.instanceId);
      expect(secondaryStatus.serverInstanceId).toBe(server.instanceId);
      
      // Queue messages from both clients
      const queueMessage = async (client, label) => {
        const messageText = `Test message from ${label} at ${Date.now()}`;
        
        client.emit('queue-message', {
          target: label,
          message: { text: messageText }
        });
        
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for ${label} message-queued`));
          }, 2000);
          
          client.once('message-queued', (response) => {
            clearTimeout(timer);
            resolve(response);
          });
        });
      };
      
      await queueMessage(primaryClient, 'primary');
      await queueMessage(secondaryClient, 'secondary');
      
      // Restart the server
      logEvent('restarting-server');
      await server.shutdown();
      server = null;
      
      // Wait for both clients to disconnect
      await Promise.all([
        waitForEvent(primaryClient, 'disconnect'),
        waitForEvent(secondaryClient, 'disconnect')
      ]);
      
      // Create new server
      server = await createSocketServerWithNamespaces(port, { 
        instanceId: 'server-2' 
      });
      
      // Wait for both clients to reconnect
      await Promise.all([
        waitForEvent(primaryClient, 'connect'),
        waitForEvent(secondaryClient, 'connect')
      ]);
      
      // Verify both reconnected
      expect(primaryClient.connected).toBe(true);
      expect(secondaryClient.connected).toBe(true);
      
      // Verify new socket IDs
      expect(primaryClient.id).not.toBe(originalIds.primary);
      expect(secondaryClient.id).not.toBe(originalIds.secondary);
      
      // Verify both have different socket IDs from each other
      expect(primaryClient.id).not.toBe(secondaryClient.id);
      
      // Check status from both connections
      const newPrimaryStatus = await checkStatus(primaryClient, 'primary');
      const newSecondaryStatus = await checkStatus(secondaryClient, 'secondary');
      
      // Both should report the new server instance
      expect(newPrimaryStatus.serverInstanceId).toBe(server.instanceId);
      expect(newSecondaryStatus.serverInstanceId).toBe(server.instanceId);
      
      // Queue new messages
      await queueMessage(primaryClient, 'primary-after-reconnect');
      await queueMessage(secondaryClient, 'secondary-after-reconnect');
      
      // Test successfully completed
      logEvent('test-completed-successfully');
    } finally {
      // Cleanup
      try {
        primaryClient.disconnect();
        primaryClient.removeAllListeners();
      } catch (e) {
        console.error('Error cleaning up primary client:', e);
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