/**
 * WebHook Event Validation Tests - Improved Version
 * 
 * This module tests the validation capabilities of the WebSocket event handlers:
 * - Message format validation
 * - Subscription request validation
 * - Input boundary testing
 * - Error response validation
 * 
 * Improvements:
 * - Uses event-driven testing patterns
 * - Implements robust connection verification
 * - Uses retry logic for critical operations
 * - Optimized for Replit environment stability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import { 
  createSocketTestEnv, 
  waitForEvent, 
  waitForConnect, 
  promiseWithTimeout,
  createEventTracker,
  verifyConnection,
  retrySocketOperation
} from './socketio-test-utilities';

// Test message types
const MESSAGE_TYPES = {
  SYSTEM_STATUS: 'system_status',
  API_STATUS: 'api_status',
  RESEARCH_PROGRESS: 'research_progress',
  SUBSCRIPTION_UPDATE: 'subscription_update',
  ERROR: 'error'
};

// Helper to log events for debugging
function logEvent(source, type, data = {}) {
  console.log(`[${source}] ${type}${Object.keys(data).length ? ': ' + JSON.stringify(data) : ''}`);
}

describe('WebHook Event Validation', () => {
  let testEnv;
  
  beforeEach(() => {
    // Create test environment with Replit-optimized settings
    testEnv = createSocketTestEnv({
      pingTimeout: 200,
      pingInterval: 150,
      connectTimeout: 2000
    });
    
    // Set up basic event handlers on the server
    testEnv.io.on('connection', (socket) => {
      logEvent('server', 'connection', { id: socket.id });
      
      // Add socket to the 'all' room by default
      socket.join('all');
      
      // Handle subscription requests with validation
      socket.on('subscribe', (message) => {
        logEvent('server', 'subscribe-request', { id: socket.id, message });
        
        // Validate message format
        if (!message || typeof message !== 'object') {
          socket.emit('message', { 
            type: MESSAGE_TYPES.ERROR, 
            error: 'Invalid subscription format' 
          });
          return;
        }
        
        // Validate topics field
        if (!message.topics || !Array.isArray(message.topics)) {
          socket.emit('message', { 
            type: MESSAGE_TYPES.ERROR, 
            error: 'Missing or invalid topics field' 
          });
          return;
        }
        
        // Validate maximum number of topics
        if (message.topics.length > 10) {
          socket.emit('message', { 
            type: MESSAGE_TYPES.ERROR, 
            error: 'Too many topics (maximum 10)' 
          });
          return;
        }
        
        // Validate topic names
        for (const topic of message.topics) {
          if (typeof topic !== 'string' || topic.length < 2 || topic.length > 50) {
            socket.emit('message', { 
              type: MESSAGE_TYPES.ERROR, 
              error: 'Invalid topic name (must be string between 2-50 chars)' 
            });
            return;
          }
          
          // Validate topic characters (alphanumeric, underscore, dash only)
          if (!/^[a-zA-Z0-9_-]+$/.test(topic)) {
            socket.emit('message', { 
              type: MESSAGE_TYPES.ERROR, 
              error: 'Invalid topic name (only alphanumeric, underscore, dash allowed)' 
            });
            return;
          }
        }
        
        // If all validations pass, update subscriptions
        socket.emit('message', { 
          type: MESSAGE_TYPES.SUBSCRIPTION_UPDATE, 
          topics: message.topics 
        });
      });
      
      // Handle data validation messages
      socket.on('validate_data', (message) => {
        logEvent('server', 'validate-data-request', { id: socket.id });
        
        // Required fields validation
        if (!message || typeof message !== 'object') {
          socket.emit('message', { 
            type: MESSAGE_TYPES.ERROR, 
            error: 'Invalid data format' 
          });
          return;
        }
        
        // Validate type field
        if (!message.type || typeof message.type !== 'string') {
          socket.emit('message', { 
            type: MESSAGE_TYPES.ERROR, 
            error: 'Missing or invalid type field' 
          });
          return;
        }
        
        // Validate payload existence
        if (!message.payload || typeof message.payload !== 'object') {
          socket.emit('message', { 
            type: MESSAGE_TYPES.ERROR, 
            error: 'Missing or invalid payload' 
          });
          return;
        }
        
        // Validate different message types
        switch (message.type) {
          case 'system_status':
            // Require status field for system_status type
            if (!message.payload.status || typeof message.payload.status !== 'string') {
              socket.emit('message', { 
                type: MESSAGE_TYPES.ERROR, 
                error: 'Missing or invalid status in payload' 
              });
              return;
            }
            
            // Status must be one of: 'online', 'degraded', 'offline'
            if (!['online', 'degraded', 'offline'].includes(message.payload.status)) {
              socket.emit('message', { 
                type: MESSAGE_TYPES.ERROR, 
                error: 'Invalid status value (must be: online, degraded, offline)' 
              });
              return;
            }
            break;
            
          case 'research_progress':
            // Require progress percentage for research_progress type
            if (typeof message.payload.progress !== 'number' || 
                message.payload.progress < 0 || 
                message.payload.progress > 100) {
              socket.emit('message', { 
                type: MESSAGE_TYPES.ERROR, 
                error: 'Invalid progress (must be number between 0-100)' 
              });
              return;
            }
            break;
            
          default:
            // Unrecognized message type
            socket.emit('message', { 
              type: MESSAGE_TYPES.ERROR, 
              error: 'Unrecognized message type' 
            });
            return;
        }
        
        // If all validations pass, acknowledge success
        socket.emit('message', { 
          type: message.type, 
          status: 'valid',
          validation_result: 'passed',
          original_payload: message.payload
        });
      });
    });
  });
  
  afterEach(async () => {
    // Log cleanup start
    logEvent('test', 'starting-cleanup');
    
    // Clean up resources
    if (testEnv) {
      try {
        await testEnv.shutdown();
      } catch (error) {
        logEvent('test', 'cleanup-error', { error: error.message });
      }
    }
    
    // Log cleanup completion
    logEvent('test', 'cleanup-complete');
  });
  
  /**
   * Test subscription validation with valid input
   */
  it('should validate and accept valid subscription requests', async () => {
    // Create client with Replit-optimized settings
    const client = testEnv.createClient({
      reconnectionDelay: 200,
      reconnectionDelayMax: 500,
      reconnectionAttempts: 10,
      timeout: 5000
    });
    
    // Create event tracker
    const eventTracker = createEventTracker([
      MESSAGE_TYPES.SUBSCRIPTION_UPDATE,
      MESSAGE_TYPES.ERROR
    ]);
    
    // Track all messages
    client.on('message', (message) => {
      logEvent('client', 'message-received', { type: message.type });
      eventTracker.add(message.type, message);
    });
    
    // Use retry logic for initial connection with verification
    await retrySocketOperation(
      async () => {
        // Connect the client
        await waitForConnect(client, 2000);
        
        // Verify connection is working
        const isActive = await verifyConnection(client, 2000);
        if (!isActive) {
          throw new Error('Connection verification failed');
        }
        
        logEvent('test', 'connection-verified');
        return true;
      },
      {
        maxRetries: 5,
        initialDelay: 250,
        maxDelay: 2000
      }
    );
    
    // Send valid subscription request
    logEvent('test', 'sending-subscription-request');
    const validTopics = ['research_updates', 'system_status', 'api_status'];
    client.emit('subscribe', { topics: validTopics });
    
    // Wait for subscription update response
    const response = await promiseWithTimeout(600, "No subscription response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.SUBSCRIPTION_UPDATE], 600)
    );
    logEvent('test', 'subscription-response-received');
    
    // Debug the response structure
    console.log('Subscription response structure:', JSON.stringify(response));
    
    // Get the subscription data based on response format
    const subscriptionData = Array.isArray(response) ? response[0] : response[MESSAGE_TYPES.SUBSCRIPTION_UPDATE];
    
    // Verify the response contains correct topics
    expect(subscriptionData.type).toBe(MESSAGE_TYPES.SUBSCRIPTION_UPDATE);
    expect(subscriptionData.topics).toEqual(validTopics);
    
    // Clean up client
    client.removeAllListeners();
    if (client.connected) {
      client.disconnect();
    }
  });
  
  /**
   * Test subscription validation with invalid inputs
   */
  it('should reject invalid subscription requests', async () => {
    // Create client with optimized settings
    const client = testEnv.createClient({
      reconnectionDelay: 200,
      reconnectionDelayMax: 500,
      reconnectionAttempts: 10,
      timeout: 5000
    });
    
    // Create event tracker
    const eventTracker = createEventTracker([
      MESSAGE_TYPES.SUBSCRIPTION_UPDATE,
      MESSAGE_TYPES.ERROR
    ]);
    
    // Track all messages
    client.on('message', (message) => {
      logEvent('client', 'message-received', { type: message.type });
      eventTracker.add(message.type, message);
    });
    
    // Use retry logic for connection
    await retrySocketOperation(
      async () => {
        await waitForConnect(client, 2000);
        const isActive = await verifyConnection(client, 2000);
        if (!isActive) throw new Error('Connection verification failed');
        return true;
      },
      {
        maxRetries: 5,
        initialDelay: 250,
        maxDelay: 2000
      }
    );
    
    // Test case 1: Non-array topics
    logEvent('test', 'sending-invalid-subscription-non-array');
    client.emit('subscribe', { topics: 'not_an_array' });
    
    // Wait for error response
    const response1 = await promiseWithTimeout(600, "No error response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.ERROR], 600)
    );
    
    // Debug the response structure
    console.log('Invalid subscription response 1:', JSON.stringify(response1));
    
    // Get the error data based on response format
    const errorResponse1 = Array.isArray(response1) ? response1[0] : response1[MESSAGE_TYPES.ERROR];
    
    // Verify error message
    expect(errorResponse1.type).toBe(MESSAGE_TYPES.ERROR);
    expect(errorResponse1.error).toContain('invalid topics');
    
    // Reset event tracker
    eventTracker.reset();
    
    // Test case 2: Too many topics
    logEvent('test', 'sending-invalid-subscription-too-many-topics');
    client.emit('subscribe', { 
      topics: [
        'topic1', 'topic2', 'topic3', 'topic4', 'topic5',
        'topic6', 'topic7', 'topic8', 'topic9', 'topic10', 'topic11'
      ] 
    });
    
    // Wait for error response
    const response2 = await promiseWithTimeout(600, "No error response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.ERROR], 600)
    );
    
    // Debug the response structure
    console.log('Invalid subscription response 2:', JSON.stringify(response2));
    
    // Get the error data based on response format
    const errorResponse2 = Array.isArray(response2) ? response2[0] : response2[MESSAGE_TYPES.ERROR];
    
    // Verify error message
    expect(errorResponse2.type).toBe(MESSAGE_TYPES.ERROR);
    expect(errorResponse2.error).toContain('Too many topics');
    
    // Reset event tracker
    eventTracker.reset();
    
    // Test case 3: Invalid topic name
    logEvent('test', 'sending-invalid-subscription-invalid-topic-name');
    client.emit('subscribe', { topics: ['valid_topic', 'invalid*topic#'] });
    
    // Wait for error response
    const response3 = await promiseWithTimeout(600, "No error response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.ERROR], 600)
    );
    
    // Debug the response structure
    console.log('Invalid subscription response 3:', JSON.stringify(response3));
    
    // Get the error data based on response format
    const errorResponse3 = Array.isArray(response3) ? response3[0] : response3[MESSAGE_TYPES.ERROR];
    
    // Verify error message
    expect(errorResponse3.type).toBe(MESSAGE_TYPES.ERROR);
    expect(errorResponse3.error).toContain('Invalid topic name');
    
    // Clean up client
    client.removeAllListeners();
    if (client.connected) {
      client.disconnect();
    }
  });
  
  /**
   * Test payload validation with valid input
   */
  it('should validate and accept valid message payloads', async () => {
    // Create client with optimized settings
    const client = testEnv.createClient({
      reconnectionDelay: 200,
      reconnectionDelayMax: 500,
      reconnectionAttempts: 10,
      timeout: 5000
    });
    
    // Create event tracker for messages
    const eventTracker = createEventTracker([
      'system_status',
      'research_progress',
      MESSAGE_TYPES.ERROR
    ]);
    
    // Track all messages
    client.on('message', (message) => {
      logEvent('client', 'message-received', { type: message.type });
      eventTracker.add(message.type, message);
    });
    
    // Connect with retry logic
    await retrySocketOperation(
      async () => {
        await waitForConnect(client, 2000);
        const isActive = await verifyConnection(client, 2000);
        if (!isActive) throw new Error('Connection verification failed');
        return true;
      },
      {
        maxRetries: 5,
        initialDelay: 250,
        maxDelay: 2000
      }
    );
    
    // Test valid system status message
    logEvent('test', 'sending-valid-system-status');
    client.emit('validate_data', {
      type: 'system_status',
      payload: { 
        status: 'online',
        timestamp: Date.now()
      }
    });
    
    // Wait for response
    const response1 = await promiseWithTimeout(600, "No response received").resolveWith(
      async () => eventTracker.waitForAll(['system_status'], 600)
    );
    
    // Debug the response structure
    console.log('Valid system status response:', JSON.stringify(response1));
    
    // Get the response data based on response format
    const statusResponse = Array.isArray(response1) ? response1[0] : response1['system_status'];
    
    // Verify response
    expect(statusResponse.status).toBe('valid');
    expect(statusResponse.validation_result).toBe('passed');
    
    // Reset event tracker
    eventTracker.reset();
    
    // Test valid research progress message
    logEvent('test', 'sending-valid-research-progress');
    client.emit('validate_data', {
      type: 'research_progress',
      payload: { 
        progress: 75,
        topic: 'Test Research',
        timestamp: Date.now()
      }
    });
    
    // Wait for response
    const response2 = await promiseWithTimeout(600, "No response received").resolveWith(
      async () => eventTracker.waitForAll(['research_progress'], 600)
    );
    
    // Debug the response structure
    console.log('Valid research progress response:', JSON.stringify(response2));
    
    // Get the response data based on response format
    const progressResponse = Array.isArray(response2) ? response2[0] : response2['research_progress'];
    
    // Verify response
    expect(progressResponse.status).toBe('valid');
    expect(progressResponse.validation_result).toBe('passed');
    
    // Clean up client
    client.removeAllListeners();
    if (client.connected) {
      client.disconnect();
    }
  });
  
  /**
   * Test payload validation with invalid input
   */
  it('should reject invalid message payloads', async () => {
    // Create client with optimized settings
    const client = testEnv.createClient({
      reconnectionDelay: 200,
      reconnectionDelayMax: 500,
      reconnectionAttempts: 10,
      timeout: 5000
    });
    
    // Create event tracker for messages
    const eventTracker = createEventTracker([
      MESSAGE_TYPES.ERROR
    ]);
    
    // Track all messages
    client.on('message', (message) => {
      logEvent('client', 'message-received', { type: message.type });
      eventTracker.add(message.type, message);
    });
    
    // Connect with retry logic
    await retrySocketOperation(
      async () => {
        await waitForConnect(client, 2000);
        const isActive = await verifyConnection(client, 2000);
        if (!isActive) throw new Error('Connection verification failed');
        return true;
      },
      {
        maxRetries: 5,
        initialDelay: 250,
        maxDelay: 2000
      }
    );
    
    // Test case 1: Missing payload
    logEvent('test', 'sending-invalid-missing-payload');
    client.emit('validate_data', {
      type: 'system_status'
      // No payload
    });
    
    // Wait for error response
    const response1 = await promiseWithTimeout(600, "No error response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.ERROR], 600)
    );
    
    // Debug the response structure
    console.log('Response structure:', JSON.stringify(response1));
    
    // Verify error - ensure we're accessing the right structure
    const errorMessage = response1 && Array.isArray(response1) ? response1[0].error : response1[MESSAGE_TYPES.ERROR]?.error;
    expect(errorMessage).toContain('Missing or invalid payload');
    
    // Reset event tracker
    eventTracker.reset();
    
    // Test case 2: Invalid system status value
    logEvent('test', 'sending-invalid-status-value');
    client.emit('validate_data', {
      type: 'system_status',
      payload: { 
        status: 'invalid_status' // Not one of the allowed values
      }
    });
    
    // Wait for error response
    const response2 = await promiseWithTimeout(600, "No error response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.ERROR], 600)
    );
    
    // Debug the response structure
    console.log('Response structure 2:', JSON.stringify(response2));
    
    // Verify error - ensure we're accessing the right structure
    const errorMessage2 = response2 && Array.isArray(response2) ? response2[0].error : response2[MESSAGE_TYPES.ERROR]?.error;
    expect(errorMessage2).toContain('Invalid status value');
    
    // Reset event tracker
    eventTracker.reset();
    
    // Test case 3: Invalid progress value
    logEvent('test', 'sending-invalid-progress-value');
    client.emit('validate_data', {
      type: 'research_progress',
      payload: { 
        progress: 150 // Out of allowed range
      }
    });
    
    // Wait for error response
    const response3 = await promiseWithTimeout(600, "No error response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.ERROR], 600)
    );
    
    // Debug the response structure
    console.log('Response structure 3:', JSON.stringify(response3));
    
    // Verify error - ensure we're accessing the right structure
    const errorMessage3 = response3 && Array.isArray(response3) ? response3[0].error : response3[MESSAGE_TYPES.ERROR]?.error;
    expect(errorMessage3).toContain('Invalid progress');
    
    // Reset event tracker
    eventTracker.reset();
    
    // Test case 4: Unrecognized message type
    logEvent('test', 'sending-unrecognized-message-type');
    client.emit('validate_data', {
      type: 'unknown_type',
      payload: { 
        data: 'test'
      }
    });
    
    // Wait for error response
    const response4 = await promiseWithTimeout(600, "No error response received").resolveWith(
      async () => eventTracker.waitForAll([MESSAGE_TYPES.ERROR], 600)
    );
    
    // Debug the response structure
    console.log('Response structure 4:', JSON.stringify(response4));
    
    // Verify error - ensure we're accessing the right structure
    const errorMessage4 = response4 && Array.isArray(response4) ? response4[0].error : response4[MESSAGE_TYPES.ERROR]?.error;
    expect(errorMessage4).toContain('Unrecognized message type');
    
    // Clean up client
    client.removeAllListeners();
    if (client.connected) {
      client.disconnect();
    }
  });
});