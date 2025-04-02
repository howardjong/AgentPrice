/**
 * WebHook Event Validation Tests
 * 
 * This module tests the validation capabilities of the WebSocket event handlers:
 * - Message format validation
 * - Subscription request validation
 * - Input boundary testing
 * - Error response validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import { createSocketTestEnv, waitForEvent, waitForConnect } from './socketio-test-utilities';

// Test message types
const MESSAGE_TYPES = {
  SYSTEM_STATUS: 'system_status',
  API_STATUS: 'api_status',
  RESEARCH_PROGRESS: 'research_progress',
  SUBSCRIPTION_UPDATE: 'subscription_update',
  ERROR: 'error'
};

describe('WebHook Event Validation', () => {
  let testEnv;
  
  beforeEach(() => {
    // Create test environment with default settings
    testEnv = createSocketTestEnv();
    
    // Set up basic event handlers on the server
    testEnv.io.on('connection', (socket) => {
      // Add socket to the 'all' room by default
      socket.join('all');
      
      // Handle subscription requests with validation
      socket.on('subscribe', (message) => {
        try {
          // Validate subscription format
          const topics = message?.topics || message?.channels;
          
          if (!topics || !Array.isArray(topics)) {
            socket.emit('message', { 
              type: 'error', 
              error: 'Invalid subscription format',
              details: 'Topics must be an array'
            });
            return;
          }
          
          // Process valid topics
          topics.forEach(topic => {
            socket.join(topic);
          });
          
          // Send confirmation
          socket.emit('message', { 
            type: 'subscription_update', 
            status: 'success',
            topics: topics 
          });
        } catch (error) {
          socket.emit('message', { 
            type: 'error', 
            error: 'Failed to process subscription',
            details: error.message
          });
        }
      });
      
      // Handle custom message format for general messages
      socket.on('message', (data) => {
        try {
          // Parse message if it's a string
          const message = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Validate message format
          if (!message || !message.type) {
            socket.emit('message', { 
              type: 'error', 
              error: 'Invalid message format',
              details: 'Message must have a type field'
            });
            return;
          }
          
          // Handle different message types
          if (message.type === 'ping') {
            socket.emit('message', { 
              type: 'pong', 
              time: Date.now(),
              status: 'ok'
            });
          } else if (message.type === 'request_status') {
            socket.emit('message', { 
              type: 'system_status',
              status: 'healthy',
              timestamp: Date.now()
            });
          }
        } catch (error) {
          socket.emit('message', { 
            type: 'error', 
            error: 'Failed to process message',
            details: error.message
          });
        }
      });
      
      // Handle ping requests directly
      socket.on('ping', () => {
        socket.emit('message', { 
          type: 'pong', 
          time: Date.now(),
          status: 'ok' 
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
   * Test validation of message format
   */
  it('should validate message format and reject invalid messages', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Set up error listener
    const errorMessages = [];
    client.on('message', (message) => {
      if (message.type === 'error') {
        errorMessages.push(message);
      }
    });
    
    // Test case 1: Missing type field
    client.emit('message', { data: 'test' });
    
    // Test case 2: Null message
    client.emit('message', null);
    
    // Test case 3: Empty object
    client.emit('message', {});
    
    // Test case 4: Invalid JSON string
    client.emit('message', '{invalid json}');
    
    // Wait for error responses
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify errors were received
    expect(errorMessages.length).toBeGreaterThanOrEqual(3);
    expect(errorMessages.some(msg => 
      msg.error === 'Invalid message format' || 
      msg.error === 'Failed to process message'
    )).toBe(true);
  });
  
  /**
   * Test validation of subscription requests
   */
  it('should validate subscription requests and handle invalid formats', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Track subscription responses and errors
    const responses = {
      success: [],
      error: []
    };
    
    client.on('message', (message) => {
      if (message.type === 'subscription_update') {
        responses.success.push(message);
      } else if (message.type === 'error') {
        responses.error.push(message);
      }
    });
    
    // Test case 1: Valid subscription with topics
    client.emit('subscribe', { topics: ['test_topic', 'system_status'] });
    
    // Test case 2: Valid subscription with channels (alternative format)
    client.emit('subscribe', { channels: ['api_status', 'notifications'] });
    
    // Test case 3: Invalid subscription - null
    client.emit('subscribe', null);
    
    // Test case 4: Invalid subscription - missing topics
    client.emit('subscribe', { other: 'data' });
    
    // Test case 5: Invalid subscription - topics not an array
    client.emit('subscribe', { topics: 'not_an_array' });
    
    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify correct handling
    expect(responses.success.length).toBe(2);
    expect(responses.error.length).toBeGreaterThanOrEqual(2);
    
    // Verify success responses have topics arrays
    expect(responses.success[0].topics).toBeInstanceOf(Array);
    expect(responses.success[1].topics).toBeInstanceOf(Array);
    
    // Verify error responses contain helpful message
    expect(responses.error.some(e => 
      e.details?.includes('array') || 
      e.error?.includes('Invalid subscription')
    )).toBe(true);
  });
  
  /**
   * Test boundary conditions for message size
   */
  it('should handle message size boundary conditions', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Generate a large payload
    const generateLargeString = (size) => {
      return 'a'.repeat(size);
    };
    
    // Track responses
    const responses = [];
    client.on('message', (message) => {
      responses.push(message);
    });
    
    // Test with increasing message sizes
    const messageSizes = [10, 100, 1000, 10000, 100000];
    
    for (const size of messageSizes) {
      client.emit('message', {
        type: 'test_message',
        data: generateLargeString(size)
      });
      
      // Add a small delay between messages
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Wait for all responses
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if large messages were handled or rejected
    // Note: The specific behavior depends on server configuration
    // We're mainly testing that the server doesn't crash
    expect(client.connected).toBe(true);
  });
  
  /**
   * Test multiple format variations for the same message type
   */
  it('should handle various valid message format variations', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Track pong responses
    const pongResponses = [];
    client.on('message', (message) => {
      if (message.type === 'pong') {
        pongResponses.push(message);
      }
    });
    
    // Test case 1: Direct ping event
    client.emit('ping');
    
    // Test case 2: Ping as message object
    client.emit('message', { type: 'ping' });
    
    // Test case 3: Ping as JSON string
    client.emit('message', JSON.stringify({ type: 'ping' }));
    
    // Test case 4: Ping with extra data
    client.emit('message', { 
      type: 'ping',
      timestamp: Date.now(),
      client: 'test-client'
    });
    
    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify all ping variations were handled
    expect(pongResponses.length).toBe(4);
    // Each pong should have time and status fields
    pongResponses.forEach(pong => {
      expect(pong.time).toBeDefined();
      expect(pong.status).toBe('ok');
    });
  });
  
  /**
   * Test validation of room name format in subscription requests
   */
  it('should validate room names in subscription requests', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Set up subscription tracking
    let subscriptionResponse = null;
    client.on('message', (message) => {
      if (message.type === 'subscription_update') {
        subscriptionResponse = message;
      }
    });
    
    // Subscribe with various room name formats
    const roomNames = [
      'normal-room',
      'room with spaces',
      '123456',
      'special@#$chars',
      'very-very-very-very-very-very-very-very-very-very-very-long-room-name'
    ];
    
    client.emit('subscribe', { topics: roomNames });
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify subscription was successful and all room names were accepted
    expect(subscriptionResponse).not.toBeNull();
    expect(subscriptionResponse.status).toBe('success');
    expect(subscriptionResponse.topics).toHaveLength(roomNames.length);
    
    // Verify all room names were included
    roomNames.forEach(room => {
      expect(subscriptionResponse.topics).toContain(room);
    });
  });
  
  /**
   * Test handling of malformed data during message processing
   */
  it('should handle malformed data during message processing', async () => {
    // Create client
    const client = testEnv.createClient();
    
    // Wait for connection
    await waitForConnect(client);
    
    // Track error messages
    const errors = [];
    client.on('message', (message) => {
      if (message.type === 'error') {
        errors.push(message);
      }
    });
    
    // Send malformed JSON strings
    const malformedMessages = [
      '{',
      '{"type": "ping", "data":',
      'not json at all',
      '{"nested": {"broken": "json}'
    ];
    
    for (const msg of malformedMessages) {
      client.emit('message', msg);
    }
    
    // Wait for error responses
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Verify errors were received for malformed messages
    expect(errors.length).toBeGreaterThanOrEqual(malformedMessages.length - 1);
    expect(errors.some(e => e.error === 'Failed to process message')).toBe(true);
    
    // Verify client is still connected despite errors
    expect(client.connected).toBe(true);
  });
});