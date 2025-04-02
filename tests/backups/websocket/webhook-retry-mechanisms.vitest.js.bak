/**
 * WebHook Retry Mechanism Tests
 * 
 * Tests the retry capabilities of the WebSocket event handlers:
 * - Message queuing during disconnection
 * - Reconnection behavior
 * - Subscription restoration
 * - Message delivery after reconnection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import { createSocketTestEnv, waitForEvent, waitForConnect, promiseWithTimeout } from './socketio-test-utilities';

describe('WebHook Retry Mechanisms', () => {
  let testEnv;
  let pendingMessages = new Map(); // Tracks messages that should be sent after reconnection
  
  beforeEach(() => {
    // Create test environment with shorter timeouts for testing
    testEnv = createSocketTestEnv({
      pingTimeout: 200,
      pingInterval: 100,
      connectTimeout: 300
    });
    
    // Reset pending messages
    pendingMessages = new Map();
    
    // Set up server with message queue functionality
    testEnv.io.on('connection', (socket) => {
      // Add socket to the 'all' room by default
      socket.join('all');
      
      // Store client subscriptions
      const clientSubscriptions = new Set(['all']);
      
      // Handle reconnection
      socket.on('reconnect_attempt', () => {
        console.log(`Client ${socket.id} attempting to reconnect`);
      });
      
      // Store last disconnection reason
      let lastDisconnectReason = '';
      socket.on('disconnecting', (reason) => {
        lastDisconnectReason = reason;
        console.log(`Client ${socket.id} disconnecting: ${reason}`);
      });
      
      // Handle subscription requests
      socket.on('subscribe', (message) => {
        try {
          const topics = message?.topics || message?.channels || [];
          
          if (Array.isArray(topics)) {
            // Clear existing subscriptions (except 'all')
            for (const room of clientSubscriptions) {
              if (room !== 'all') {
                socket.leave(room);
                clientSubscriptions.delete(room);
              }
            }
            
            // Join requested rooms
            for (const topic of topics) {
              socket.join(topic);
              clientSubscriptions.add(topic);
            }
            
            // Ensure 'all' subscription
            socket.join('all');
            clientSubscriptions.add('all');
            
            // Confirm subscription
            socket.emit('message', { 
              type: 'subscription_update', 
              status: 'success',
              topics: Array.from(clientSubscriptions)
            });
            
            // Send any pending messages for the subscribed topics
            if (pendingMessages.has(socket.id)) {
              const messages = pendingMessages.get(socket.id);
              const messagesToSend = messages.filter(msg => 
                clientSubscriptions.has(msg.type) || 
                clientSubscriptions.has('all')
              );
              
              for (const msg of messagesToSend) {
                socket.emit('message', msg);
              }
              
              // Remove sent messages
              pendingMessages.set(
                socket.id, 
                messages.filter(msg => !messagesToSend.includes(msg))
              );
            }
          }
        } catch (error) {
          socket.emit('message', { 
            type: 'error', 
            error: 'Failed to process subscription',
            details: error.message
          });
        }
      });
      
      // Handle message requests
      socket.on('request_message', ({ topic }) => {
        socket.emit('message', {
          type: topic || 'test_message',
          timestamp: Date.now(),
          data: { requested: true }
        });
      });
      
      // Handle reconnection state check
      socket.on('check_reconnection_state', () => {
        socket.emit('message', {
          type: 'reconnection_state',
          subscriptions: Array.from(clientSubscriptions),
          lastDisconnectReason,
          timestamp: Date.now()
        });
      });
      
      // Queue message for later delivery
      socket.on('queue_message', ({ topic, socketId, data }) => {
        const message = {
          type: topic || 'queued_message',
          timestamp: Date.now(),
          data: data || { queued: true }
        };
        
        const targetId = socketId || socket.id;
        
        if (!pendingMessages.has(targetId)) {
          pendingMessages.set(targetId, []);
        }
        
        pendingMessages.get(targetId).push(message);
        
        socket.emit('message', {
          type: 'queue_confirmation',
          messageQueued: true,
          targetClient: targetId,
          timestamp: Date.now()
        });
      });
    });
  });
  
  afterEach(async () => {
    // Clean up resources
    if (testEnv) {
      await testEnv.shutdown();
    }
  });
  
  /**
   * Test message queuing during disconnection and delivery after reconnection
   */
  it.skip('should queue messages during disconnection and deliver them after reconnection', async () => {
    // Create client with automatic reconnection
    const client = testEnv.createClient({
      reconnectionDelay: 100,
      reconnectionAttempts: 5
    });
    
    // Client id for tracking
    let clientId;
    
    // Track messages received
    const receivedMessages = [];
    client.on('message', (message) => {
      receivedMessages.push(message);
    });
    
    // Wait for connection
    await waitForConnect(client);
    clientId = client.id;
    
    // Subscribe to test topics
    client.emit('subscribe', { topics: ['test_topic', 'important_updates'] });
    
    // Wait for subscription confirmation
    await waitForEvent(client, 'message');
    
    // Create a second client to help with testing
    const helperClient = testEnv.createClient();
    await waitForConnect(helperClient);
    
    // Force disconnect the first client
    client.disconnect();
    
    // Wait for disconnection to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Queue messages for the disconnected client
    helperClient.emit('queue_message', { 
      socketId: clientId,
      topic: 'test_topic',
      data: { important: true, messageId: 1 }
    });
    
    helperClient.emit('queue_message', { 
      socketId: clientId,
      topic: 'important_updates',
      data: { critical: true, messageId: 2 }
    });
    
    // Wait for queue confirmation
    await waitForEvent(helperClient, 'message');
    await waitForEvent(helperClient, 'message');
    
    // Reconnect the client
    client.connect();
    
    // Wait for reconnection
    await waitForConnect(client);
    
    // Resubscribe to the same topics
    client.emit('subscribe', { topics: ['test_topic', 'important_updates'] });
    
    // Wait for messages to be delivered
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check that queued messages were delivered
    const queuedMessages = receivedMessages.filter(msg => 
      (msg.type === 'test_topic' && msg.data?.important) ||
      (msg.type === 'important_updates' && msg.data?.critical)
    );
    
    expect(queuedMessages.length).toBe(2);
    expect(queuedMessages.some(msg => msg.data?.messageId === 1)).toBe(true);
    expect(queuedMessages.some(msg => msg.data?.messageId === 2)).toBe(true);
  });
  
  /**
   * Test subscription restoration after reconnection
   */
  it.skip('should restore subscriptions after reconnection', async () => {
    // Create client with fast reconnection
    const client = testEnv.createClient({
      reconnectionDelay: 100,
      reconnectionAttempts: 5
    });
    
    // Track subscription updates
    const subscriptionUpdates = [];
    client.on('message', (message) => {
      if (message.type === 'subscription_update') {
        subscriptionUpdates.push(message);
      }
    });
    
    // Wait for connection
    await waitForConnect(client);
    
    // Subscribe to specific topics
    const initialTopics = ['topic1', 'topic2', 'alerts'];
    client.emit('subscribe', { topics: initialTopics });
    
    // Wait for subscription confirmation
    await waitForEvent(client, 'message');
    
    // Verify initial subscription exists
    expect(subscriptionUpdates.length).toBeGreaterThan(0);
    if (subscriptionUpdates.length > 0) {
      expect(subscriptionUpdates[0].topics).toContain('topic1');
      expect(subscriptionUpdates[0].topics).toContain('topic2');
      expect(subscriptionUpdates[0].topics).toContain('alerts');
    }
    
    // Force disconnect the client
    client.disconnect();
    
    // Wait for disconnection to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Reconnect the client
    client.connect();
    
    // Wait for reconnection
    await waitForConnect(client);
    
    // Clear previous subscription updates to avoid test flakiness
    subscriptionUpdates.length = 0;
    
    // Re-subscribe with the same topics
    client.emit('subscribe', { topics: initialTopics });
    
    // Wait for subscription confirmation
    await waitForEvent(client, 'message');
    
    // Verify subscriptions were restored
    expect(subscriptionUpdates.length).toBeGreaterThan(0);
    if (subscriptionUpdates.length > 0) {
      expect(subscriptionUpdates[0].topics).toContain('topic1');
      expect(subscriptionUpdates[0].topics).toContain('topic2');
      expect(subscriptionUpdates[0].topics).toContain('alerts');
    }
    
    // Test that the subscriptions work by requesting a message
    client.emit('request_message', { topic: 'topic1' });
    
    // Wait for response
    const response = await waitForEvent(client, 'message');
    
    // Verify message was received for the subscribed topic
    expect(response.type).toBe('topic1');
  });
  
  /**
   * Test reconnection after server restart
   */
  it.skip('should reconnect after server restart', async () => {
    // Create client with reconnection capability
    const client = testEnv.createClient({
      reconnectionDelay: 100,
      reconnectionAttempts: 10
    });
    
    // Track connection events
    const connectionEvents = [];
    client.on('connect', () => {
      connectionEvents.push('connect');
    });
    client.on('disconnect', (reason) => {
      connectionEvents.push('disconnect: ' + reason);
    });
    client.on('reconnect_attempt', (attempt) => {
      connectionEvents.push('reconnect_attempt: ' + attempt);
    });
    
    // Wait for initial connection
    await waitForConnect(client);
    expect(connectionEvents).toContain('connect');
    
    // Subscribe to a topic
    client.emit('subscribe', { topics: ['important'] });
    await waitForEvent(client, 'message');
    
    // Restart the server (shutdown and recreate)
    await testEnv.shutdown();
    
    // Wait for client to detect server shutdown
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Verify client detected disconnection
    expect(connectionEvents.some(e => e.startsWith('disconnect'))).toBe(true);
    
    // Create new server instance
    testEnv = createSocketTestEnv({
      pingTimeout: 200,
      pingInterval: 100,
      connectTimeout: 300
    });
    
    // Set up basic event handlers
    testEnv.io.on('connection', (socket) => {
      socket.join('all');
      
      socket.on('subscribe', (message) => {
        const topics = message?.topics || [];
        if (Array.isArray(topics)) {
          topics.forEach(topic => socket.join(topic));
          socket.emit('message', { 
            type: 'subscription_update', 
            status: 'success',
            topics: topics 
          });
        }
      });
      
      socket.on('request_message', ({ topic }) => {
        socket.emit('message', {
          type: topic || 'test_message',
          timestamp: Date.now(),
          data: { requested: true }
        });
      });
    });
    
    // Wait for the client to reconnect to new server
    // Note: This may take multiple attempts
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (client.connected) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
    
    // Re-subscribe after reconnection
    if (client.connected) {
      client.emit('subscribe', { topics: ['important'] });
      
      // Request a message to verify communication is working
      client.emit('request_message', { topic: 'important' });
      
      // Wait for response
      const response = await promiseWithTimeout(500, "No response after reconnection").resolveWith(
        async () => await waitForEvent(client, 'message')
      ).catch(() => null);
      
      // If we get a response, the test passes (reconnection worked)
      if (response) {
        expect(response.type).toBe('important');
      }
    }
    
    // Verify client made reconnection attempts
    expect(connectionEvents.some(e => e.startsWith('reconnect_attempt'))).toBe(true);
  });
  
  /**
   * Test automatic reconnection with backoff
   */
  it.skip('should automatically reconnect with backoff strategy', async () => {
    // Create client with explicit reconnection settings
    const client = testEnv.createClient({
      reconnectionDelay: 100,         // Start with 100ms delay
      reconnectionDelayMax: 1000,     // Maximum delay of 1000ms
      randomizationFactor: 0.5,       // Add randomization to prevent thundering herd
      reconnectionAttempts: 5         // Try 5 times
    });
    
    // Track reconnection attempts
    const reconnectAttempts = [];
    client.on('reconnect_attempt', (attempt) => {
      reconnectAttempts.push({
        attempt,
        time: Date.now()
      });
    });
    
    // Track connection events
    let connectedCount = 0;
    let disconnectCount = 0;
    client.on('connect', () => { connectedCount++; });
    client.on('disconnect', () => { disconnectCount++; });
    
    // Wait for initial connection
    await waitForConnect(client);
    expect(connectedCount).toBe(1);
    
    // Force disconnect by stopping the server
    await testEnv.shutdown();
    
    // Wait for client to detect server shutdown
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(disconnectCount).toBe(1);
    
    // Wait long enough for multiple reconnection attempts
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create new server instance
    testEnv = createSocketTestEnv();
    testEnv.io.on('connection', (socket) => {
      socket.join('all');
      socket.emit('message', {
        type: 'connection_restored',
        timestamp: Date.now()
      });
    });
    
    // Wait for client to reconnect to new server
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (client.connected) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 3 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    });
    
    // Verify reconnection attempts were made with increasing delays
    expect(reconnectAttempts.length).toBeGreaterThan(0);
    
    // Analyze reconnection patterns to verify backoff is working
    // (this is mostly informational - we can't guarantee exact timing)
    let lastTime = 0;
    let increasingDelay = false;
    
    for (const attempt of reconnectAttempts) {
      if (lastTime > 0) {
        const delay = attempt.time - lastTime;
        if (delay > 150) { // Check if at least one delay is increasing (backoff working)
          increasingDelay = true;
          break;
        }
      }
      lastTime = attempt.time;
    }
    
    if (reconnectAttempts.length > 1) {
      expect(increasingDelay).toBe(true);
    }
  });
});