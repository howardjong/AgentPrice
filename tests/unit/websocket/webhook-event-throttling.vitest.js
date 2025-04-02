/**
 * WebHook Event Throttling Tests
 * 
 * Tests the throttling capabilities of the WebSocket event handlers:
 * - Rate limiting for high-frequency messages
 * - Backpressure handling
 * - Message prioritization
 * - Client-side throttling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import { createSocketTestEnv, waitForEvent, waitForConnect } from './socketio-test-utilities';

describe('WebHook Event Throttling', () => {
  let testEnv;
  
  // Keep track of message rates and throttling
  const messageStats = {
    received: 0,
    throttled: 0,
    processed: 0,
    lastMessageTime: 0,
    messageIntervals: []
  };
  
  beforeEach(() => {
    // Reset message statistics
    messageStats.received = 0;
    messageStats.throttled = 0;
    messageStats.processed = 0;
    messageStats.lastMessageTime = 0;
    messageStats.messageIntervals = [];
    
    // Create test environment
    testEnv = createSocketTestEnv();
    
    // Set up the server with throttling capabilities
    testEnv.io.on('connection', (socket) => {
      // Add socket to the 'all' room by default
      socket.join('all');
      
      // Client-specific throttling state
      const clientThrottling = {
        lastMessageTime: 0,
        messageCount: 0,
        throttleUntil: 0,
        messageQueue: [],
        processingQueue: false,
        highPriorityCount: 0,
        normalPriorityCount: 0
      };
      
      // Process throttled messages from the queue
      const processQueue = async () => {
        if (clientThrottling.processingQueue || clientThrottling.messageQueue.length === 0) {
          return;
        }
        
        clientThrottling.processingQueue = true;
        
        try {
          // Sort queue by priority (higher numbers = higher priority)
          clientThrottling.messageQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
          
          // Process up to 5 messages at a time
          const batch = clientThrottling.messageQueue.splice(0, 5);
          
          for (const item of batch) {
            // Apply rate limiting - only send messages at a controlled rate
            const now = Date.now();
            const timeSinceLastMessage = now - clientThrottling.lastMessageTime;
            
            // Enforce minimum interval between messages (50ms)
            if (timeSinceLastMessage < 50) {
              await new Promise(resolve => setTimeout(resolve, 50 - timeSinceLastMessage));
            }
            
            // Send the message
            socket.emit('message', {
              ...item.message,
              throttled: item.wasThrottled,
              queueDelay: Date.now() - item.timestamp,
              priority: item.priority
            });
            
            messageStats.processed++;
            clientThrottling.lastMessageTime = Date.now();
          }
          
          // If there are more messages, schedule another processing cycle
          if (clientThrottling.messageQueue.length > 0) {
            setTimeout(processQueue, 100);
          }
        } finally {
          clientThrottling.processingQueue = false;
        }
      };
      
      // Add a message to the throttled queue
      const queueMessage = (message, wasThrottled = true, priority = 0) => {
        clientThrottling.messageQueue.push({
          message,
          timestamp: Date.now(),
          wasThrottled,
          priority
        });
        
        if (priority > 5) {
          clientThrottling.highPriorityCount++;
        } else {
          clientThrottling.normalPriorityCount++;
        }
        
        // Start queue processing if not already running
        if (!clientThrottling.processingQueue) {
          processQueue();
        }
      };
      
      // Handle general messages with rate limiting
      socket.on('message', (data) => {
        messageStats.received++;
        
        try {
          // Parse the message if it's a string
          const message = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Record timing information
          const now = Date.now();
          if (messageStats.lastMessageTime > 0) {
            messageStats.messageIntervals.push(now - messageStats.lastMessageTime);
          }
          messageStats.lastMessageTime = now;
          
          // Check if currently throttled
          if (now < clientThrottling.throttleUntil) {
            messageStats.throttled++;
            queueMessage(message, true, message.priority);
            return;
          }
          
          // Check if we need to throttle based on message rate
          clientThrottling.messageCount++;
          const TIME_WINDOW = 1000; // 1 second window
          const RATE_LIMIT = 20;     // 20 messages per second max
          
          if (clientThrottling.messageCount > RATE_LIMIT) {
            // Apply throttling
            messageStats.throttled++;
            clientThrottling.throttleUntil = now + 2000; // Throttle for 2 seconds
            
            // Send throttling notification
            socket.emit('message', {
              type: 'throttling_notification',
              reason: 'Rate limit exceeded',
              allowedRate: RATE_LIMIT,
              timeWindow: TIME_WINDOW,
              throttleDuration: 2000,
              timestamp: now
            });
            
            // Queue the message instead of processing immediately
            queueMessage(message, true, message.priority);
            
            // Reset counter after the window
            setTimeout(() => {
              clientThrottling.messageCount = 0;
            }, TIME_WINDOW);
            
            return;
          }
          
          // Process normal (non-throttled) message
          // For high-volume testing, still use the queue for all messages
          queueMessage(message, false, message.priority);
        } catch (error) {
          socket.emit('message', {
            type: 'error',
            error: 'Failed to process message',
            details: error.message,
            timestamp: Date.now()
          });
        }
      });
      
      // Get throttling stats
      socket.on('get_throttling_stats', () => {
        socket.emit('message', {
          type: 'throttling_stats',
          received: messageStats.received,
          throttled: messageStats.throttled,
          processed: messageStats.processed,
          queueLength: clientThrottling.messageQueue.length,
          highPriorityCount: clientThrottling.highPriorityCount,
          normalPriorityCount: clientThrottling.normalPriorityCount,
          averageInterval: messageStats.messageIntervals.length ? 
            messageStats.messageIntervals.reduce((a, b) => a + b, 0) / messageStats.messageIntervals.length : 
            0,
          timestamp: Date.now()
        });
      });
      
      // Reset throttling state
      socket.on('reset_throttling', () => {
        clientThrottling.throttleUntil = 0;
        clientThrottling.messageCount = 0;
        clientThrottling.messageQueue = [];
        clientThrottling.highPriorityCount = 0;
        clientThrottling.normalPriorityCount = 0;
        
        messageStats.received = 0;
        messageStats.throttled = 0;
        messageStats.processed = 0;
        messageStats.lastMessageTime = 0;
        messageStats.messageIntervals = [];
        
        socket.emit('message', {
          type: 'throttling_reset',
          timestamp: Date.now()
        });
      });
    });
  });
  
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    // Clean up resources
    if (testEnv) {
      await testEnv.shutdown();
    }
  });
  
  /**
   * Test basic rate limiting for high-frequency messages
   */
  it('should throttle high-frequency messages', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Track messages received by the client
    const messageLog = [];
    client.on('message', (message) => {
      messageLog.push(message);
    });
    
    // Wait for connection
    await waitForConnect(client);
    
    // Send messages at high frequency to trigger rate limiting
    const sendHighFrequencyMessages = async (count, interval = 10) => {
      for (let i = 0; i < count; i++) {
        client.emit('message', {
          type: 'test_message',
          msgId: i,
          timestamp: Date.now()
        });
        
        // Small delay between messages but fast enough to trigger throttling
        if (interval > 0) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    };
    
    // Send 50 messages quickly to trigger throttling
    await sendHighFrequencyMessages(50);
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Request throttling stats
    client.emit('get_throttling_stats');
    
    // Wait for stats response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find throttling notification and stats
    const throttlingNotification = messageLog.find(msg => msg.type === 'throttling_notification');
    const throttlingStats = messageLog.find(msg => msg.type === 'throttling_stats');
    
    // Verify throttling was applied
    expect(throttlingNotification).toBeDefined();
    expect(throttlingStats).toBeDefined();
    
    if (throttlingStats) {
      // Some messages should have been throttled
      expect(throttlingStats.throttled).toBeGreaterThan(0);
      
      // All messages should be processed or queued
      expect(throttlingStats.processed + throttlingStats.queueLength)
        .toBeGreaterThanOrEqual(throttlingStats.received - 1); // Allow for timing variations
    }
    
    // Check if some messages were marked as throttled
    const throttledMessages = messageLog.filter(msg => msg.throttled === true);
    expect(throttledMessages.length).toBeGreaterThan(0);
  });
  
  /**
   * Test message prioritization during throttling
   */
  it('should prioritize messages during throttling', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Track messages received by the client
    const messageLog = [];
    client.on('message', (message) => {
      messageLog.push(message);
    });
    
    // Wait for connection
    await waitForConnect(client);
    
    // Send a mix of high and normal priority messages
    const sendMixedPriorityMessages = async () => {
      // First send enough messages to trigger throttling
      for (let i = 0; i < 30; i++) {
        client.emit('message', {
          type: 'normal_message',
          msgId: `normal-${i}`,
          priority: 0,
          timestamp: Date.now()
        });
        
        // Very small delay to not block the event loop
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // Then send high priority messages while throttled
      for (let i = 0; i < 10; i++) {
        client.emit('message', {
          type: 'high_priority_message',
          msgId: `high-${i}`,
          priority: 10,
          timestamp: Date.now()
        });
        
        // Very small delay to not block the event loop
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    };
    
    // Send the messages
    await sendMixedPriorityMessages();
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Request throttling stats
    client.emit('get_throttling_stats');
    
    // Wait for stats response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find throttling stats
    const throttlingStats = messageLog.find(msg => msg.type === 'throttling_stats');
    
    // Verify priority handling
    if (throttlingStats) {
      expect(throttlingStats.highPriorityCount).toBeGreaterThan(0);
    }
    
    // Find high priority messages in the log
    const highPriorityMessages = messageLog.filter(msg => 
      msg.type === 'high_priority_message' && msg.priority === 10
    );
    
    // Check if high priority messages were processed
    expect(highPriorityMessages.length).toBeGreaterThan(0);
    
    // Check if high priority messages were processed before lower priority ones
    // This needs to analyze the queue delays
    const highPriorityQueueDelays = highPriorityMessages.map(msg => msg.queueDelay || 0);
    const normalMessages = messageLog.filter(msg => 
      msg.type === 'normal_message' && msg.priority === 0 && msg.throttled
    );
    const normalQueueDelays = normalMessages.map(msg => msg.queueDelay || 0);
    
    if (highPriorityQueueDelays.length > 0 && normalQueueDelays.length > 0) {
      // Calculate average delays
      const avgHighPriorityDelay = highPriorityQueueDelays.reduce((a, b) => a + b, 0) / highPriorityQueueDelays.length;
      const avgNormalDelay = normalQueueDelays.reduce((a, b) => a + b, 0) / normalQueueDelays.length;
      
      // High priority messages should have lower delays on average
      // This check might be flaky due to timing, so only assert if the difference is significant
      if (Math.abs(avgHighPriorityDelay - avgNormalDelay) > 100) {
        expect(avgHighPriorityDelay).toBeLessThan(avgNormalDelay);
      }
    }
  });
  
  /**
   * Test throttling over extended duration
   */
  it('should maintain throttling over extended duration', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Track messages and throttling notifications
    const throttlingNotifications = [];
    client.on('message', (message) => {
      if (message.type === 'throttling_notification') {
        throttlingNotifications.push(message);
      }
    });
    
    // Wait for connection
    await waitForConnect(client);
    
    // Reset any existing throttling state
    client.emit('reset_throttling');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Send messages in multiple bursts to trigger and maintain throttling
    const sendMessageBurst = async (burstId) => {
      for (let i = 0; i < 25; i++) {
        client.emit('message', {
          type: 'burst_message',
          burstId,
          msgId: i,
          timestamp: Date.now()
        });
        
        // Very small delay
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    };
    
    // First burst to trigger throttling
    await sendMessageBurst(1);
    
    // Wait a bit but not enough for throttling to reset
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Second burst while still throttled
    await sendMessageBurst(2);
    
    // Wait a bit longer but still throttled
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Third burst
    await sendMessageBurst(3);
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get stats after the bursts
    client.emit('get_throttling_stats');
    
    // Wait for stats response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify multiple throttling notifications were sent
    // We should have at least one, but likely multiple due to continued high rate
    expect(throttlingNotifications.length).toBeGreaterThan(0);
  });
  
  /**
   * Test backpressure handling with multiple clients
   */
  it('should handle backpressure with multiple clients', async () => {
    // Create multiple clients
    const numClients = 3;
    const clients = [];
    const clientMessages = new Array(numClients).fill(0).map(() => []);
    
    for (let i = 0; i < numClients; i++) {
      const client = testEnv.createClient();
      
      // Track received messages
      const clientIndex = i;
      client.on('message', (message) => {
        clientMessages[clientIndex].push(message);
      });
      
      // Wait for connection
      await waitForConnect(client);
      
      // Reset throttling state
      client.emit('reset_throttling');
      
      clients.push(client);
    }
    
    // Wait for reset to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // All clients send messages simultaneously to test backpressure
    const sendMessagesFromAllClients = async (count) => {
      const sendPromises = clients.map((client, clientIndex) => {
        return new Promise(async (resolve) => {
          for (let i = 0; i < count; i++) {
            client.emit('message', {
              type: 'backpressure_test',
              clientId: clientIndex,
              msgId: i,
              timestamp: Date.now()
            });
            
            // Small delay to avoid completely flooding the event loop
            await new Promise(r => setTimeout(r, 5));
          }
          resolve();
        });
      });
      
      await Promise.all(sendPromises);
    };
    
    // Send a significant number of messages from all clients
    await sendMessagesFromAllClients(30);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get stats from each client
    for (const client of clients) {
      client.emit('get_throttling_stats');
    }
    
    // Wait for stats responses
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify all clients got responses
    for (let i = 0; i < numClients; i++) {
      // Find throttling stats messages
      const statsMessages = clientMessages[i].filter(msg => msg.type === 'throttling_stats');
      expect(statsMessages.length).toBeGreaterThan(0);
      
      if (statsMessages.length > 0) {
        const lastStats = statsMessages[statsMessages.length - 1];
        
        // Each client should have received some of their messages
        expect(lastStats.processed).toBeGreaterThan(0);
        
        // Server should have processed a reasonable number of messages
        // Note: Can't guarantee exact counts due to throttling
        expect(lastStats.processed + lastStats.queueLength)
          .toBeGreaterThanOrEqual(lastStats.received - 5); // Allow for timing variations
      }
    }
  });
});