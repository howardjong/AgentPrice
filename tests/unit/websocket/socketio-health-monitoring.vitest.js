/**
 * Socket.IO Health Monitoring Integration Tests
 * 
 * These tests verify that health monitoring data is properly broadcasted
 * through the Socket.IO server to connected clients.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { io as ioc } from 'socket.io-client';
import { checkSystemHealth } from '../../../server/services/healthCheck.js';

// Mock the dependencies
vi.mock('../../../server/services/healthCheck.js', () => ({
  checkSystemHealth: vi.fn()
}));

// Helper function to create a test Socket.IO server and clients
function createSocketTestEnv() {
  // Create express app and HTTP server
  const app = express();
  const httpServer = createServer(app);
  
  // Create Socket.IO server
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Start the server
  const serverPort = 3001 + Math.floor(Math.random() * 1000);
  const server = httpServer.listen(serverPort);
  
  // Create clients
  const clientURL = `http://localhost:${serverPort}`;
  
  return {
    io,
    server,
    port: serverPort,
    clientURL,
    createClient: () => {
      return ioc(clientURL, {
        transports: ['websocket'],
        reconnectionAttempts: 0,
        timeout: 1000
      });
    },
    shutdown: () => {
      return new Promise(resolve => {
        server.close(() => {
          io.close();
          resolve();
        });
      });
    }
  };
}

describe('Socket.IO Health Monitoring', () => {
  let testEnv;
  let mockHealthData;
  
  beforeEach(() => {
    // Setup mock health data
    mockHealthData = {
      status: 'healthy',
      apiKeys: {
        anthropic: true,
        perplexity: true,
        allKeysPresent: true
      },
      fileSystem: {
        uploadsDir: true,
        promptsDir: true,
        testsOutputDir: true,
        contentUploadsDir: true,
        allDirsExist: true
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024,
        free: 8 * 1024 * 1024 * 1024,
        used: 8 * 1024 * 1024 * 1024,
        usagePercent: 50,
        healthy: true
      },
      isHealthy: true
    };
    
    // Mock the health check function
    checkSystemHealth.mockReturnValue(mockHealthData);
    
    // Setup test environment
    testEnv = createSocketTestEnv();
  });
  
  afterEach(async () => {
    // Clean up
    await testEnv.shutdown();
    vi.clearAllMocks();
  });
  
  it('should setup Socket.IO server correctly', () => {
    expect(testEnv.io).toBeDefined();
    expect(testEnv.server.listening).toBe(true);
  });
  
  it('should emit system_status event with health data', () => {
    return new Promise((resolve, reject) => {
      // Set up socket server handler
      testEnv.io.on('connection', (socket) => {
        // Send health status to the connected client
        socket.emit('system_status', {
          health: mockHealthData.status,
          timestamp: new Date().toISOString(),
          memory: mockHealthData.memory,
          services: {
            claude: { status: 'connected', healthy: true },
            perplexity: { status: 'connected', healthy: true },
            redis: { status: 'connected', healthy: true }
          }
        });
      });
      
      // Create client and listen for the system_status event
      const client = testEnv.createClient();
      
      client.on('connect', () => {
        console.log('Client connected');
      });
      
      client.on('system_status', (data) => {
        try {
          expect(data).toBeDefined();
          expect(data.health).toBe('healthy');
          expect(data.memory).toBeDefined();
          expect(data.memory.usagePercent).toBe(50);
          expect(data.services).toBeDefined();
          expect(data.services.claude).toBeDefined();
          expect(data.services.claude.healthy).toBe(true);
          
          // Disconnect and resolve the test
          client.disconnect();
          resolve();
        } catch (error) {
          // Ensure test fails if our expectations aren't met
          client.disconnect();
          reject(error);
        }
      });
      
      client.on('connect_error', (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client.disconnect();
        reject(new Error('Test timed out waiting for system_status event'));
      }, 5000);
    });
  });
  
  it('should emit detailed_status event with complete health data', () => {
    return new Promise((resolve, reject) => {
      // Set up socket server handler
      testEnv.io.on('connection', (socket) => {
        // Send detailed health status to the connected client
        socket.emit('detailed_status', {
          ...mockHealthData,
          timestamp: new Date().toISOString()
        });
      });
      
      // Create client and listen for the detailed_status event
      const client = testEnv.createClient();
      
      client.on('detailed_status', (data) => {
        try {
          expect(data).toBeDefined();
          expect(data.status).toBe('healthy');
          expect(data.apiKeys).toBeDefined();
          expect(data.apiKeys.anthropic).toBe(true);
          expect(data.apiKeys.perplexity).toBe(true);
          expect(data.memory).toBeDefined();
          expect(data.fileSystem).toBeDefined();
          expect(data.isHealthy).toBe(true);
          
          // Disconnect and resolve the test
          client.disconnect();
          resolve();
        } catch (error) {
          client.disconnect();
          reject(error);
        }
      });
      
      client.on('connect_error', (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client.disconnect();
        reject(new Error('Test timed out waiting for detailed_status event'));
      }, 5000);
    });
  });
  
  it('should emit status_change event when health state changes', () => {
    return new Promise((resolve, reject) => {
      // Set up socket server handler
      testEnv.io.on('connection', (socket) => {
        // Send status change notification to the connected client
        socket.emit('status_change', {
          previous: 'healthy',
          current: 'degraded',
          timestamp: new Date().toISOString(),
          services: {
            claude: { status: 'error', healthy: false },
            perplexity: { status: 'connected', healthy: true },
            redis: { status: 'connected', healthy: true }
          }
        });
      });
      
      // Create client and listen for the status_change event
      const client = testEnv.createClient();
      
      client.on('status_change', (data) => {
        try {
          expect(data).toBeDefined();
          expect(data.previous).toBe('healthy');
          expect(data.current).toBe('degraded');
          expect(data.services).toBeDefined();
          expect(data.services.claude.healthy).toBe(false);
          
          // Disconnect and resolve the test
          client.disconnect();
          resolve();
        } catch (error) {
          client.disconnect();
          reject(error);
        }
      });
      
      client.on('connect_error', (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client.disconnect();
        reject(new Error('Test timed out waiting for status_change event'));
      }, 5000);
    });
  });
  
  it('should allow clients to subscribe to specific event types', () => {
    return new Promise((resolve, reject) => {
      // Set up socket server handler
      testEnv.io.on('connection', (socket) => {
        // Handle subscription request
        socket.on('subscribe', (eventTypes) => {
          // Store the subscription on the socket
          socket.subscriptions = eventTypes;
          socket.emit('subscription_confirmed', eventTypes);
          
          // Now send a system status update
          socket.emit('system_status', {
            health: 'healthy',
            timestamp: new Date().toISOString(),
            memory: mockHealthData.memory,
            services: {
              claude: { status: 'connected', healthy: true },
              perplexity: { status: 'connected', healthy: true },
              redis: { status: 'connected', healthy: true }
            }
          });
        });
      });
      
      // Create client and listen for events
      const client = testEnv.createClient();
      
      client.on('connect', () => {
        // Subscribe to system_status events
        client.emit('subscribe', ['system_status']);
      });
      
      client.on('subscription_confirmed', (eventTypes) => {
        expect(eventTypes).toContain('system_status');
      });
      
      client.on('system_status', (data) => {
        try {
          expect(data).toBeDefined();
          expect(data.health).toBe('healthy');
          
          // Disconnect and resolve the test
          client.disconnect();
          resolve();
        } catch (error) {
          client.disconnect();
          reject(error);
        }
      });
      
      client.on('connect_error', (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client.disconnect();
        reject(new Error('Test timed out waiting for subscription events'));
      }, 5000);
    });
  });
  
  it('should handle multiple clients receiving health updates', () => {
    return new Promise((resolve, reject) => {
      // Set up event trackers
      const clientsReceived = {
        client1: false,
        client2: false
      };
      
      function checkAllClientsReceived() {
        if (clientsReceived.client1 && clientsReceived.client2) {
          resolve();
        }
      }
      
      // Set up socket server handler
      testEnv.io.on('connection', (socket) => {
        // Send health status to all connected clients
        testEnv.io.emit('system_status', {
          health: 'healthy',
          timestamp: new Date().toISOString(),
          memory: mockHealthData.memory,
          services: {
            claude: { status: 'connected', healthy: true },
            perplexity: { status: 'connected', healthy: true },
            redis: { status: 'connected', healthy: true }
          }
        });
      });
      
      // Create two clients
      const client1 = testEnv.createClient();
      const client2 = testEnv.createClient();
      
      // Setup handlers for client 1
      client1.on('system_status', (data) => {
        try {
          expect(data).toBeDefined();
          expect(data.health).toBe('healthy');
          clientsReceived.client1 = true;
          client1.disconnect();
          checkAllClientsReceived();
        } catch (error) {
          client1.disconnect();
          client2.disconnect();
          reject(error);
        }
      });
      
      // Setup handlers for client 2
      client2.on('system_status', (data) => {
        try {
          expect(data).toBeDefined();
          expect(data.health).toBe('healthy');
          clientsReceived.client2 = true;
          client2.disconnect();
          checkAllClientsReceived();
        } catch (error) {
          client1.disconnect();
          client2.disconnect();
          reject(error);
        }
      });
      
      client1.on('connect_error', (err) => {
        client2.disconnect();
        reject(new Error(`Client 1 connection error: ${err.message}`));
      });
      
      client2.on('connect_error', (err) => {
        client1.disconnect();
        reject(new Error(`Client 2 connection error: ${err.message}`));
      });
      
      // Add a timeout to prevent the test from hanging
      setTimeout(() => {
        client1.disconnect();
        client2.disconnect();
        reject(new Error('Test timed out waiting for multiple clients to receive updates'));
      }, 5000);
    });
  });
});