/**
 * @file api-service-status.vitest.js
 * @description Tests for the WebSocket-based API service status monitoring
 */
import { describe, beforeEach, afterEach, it, expect, vi, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';

// Mock system status data
const mockApiStatus = {
  claude: { 
    status: 'connected', 
    model: 'claude-3-7-sonnet-20250219',
    responseTime: 2534, // in ms
    costPerHour: 8.5,
    uptime: 99.8
  },
  perplexity: { 
    status: 'connected', 
    model: 'sonar',
    responseTime: 1876, // in ms
    costPerHour: 5.2,
    uptime: 99.9
  },
  lastUpdated: new Date().toISOString(),
  healthScore: 98
};

// Mock for status change events
const mockStatusChanges = [
  {
    service: 'claude',
    oldStatus: 'connected',
    newStatus: 'degraded',
    reason: 'High response times detected',
    timestamp: new Date().toISOString()
  },
  {
    service: 'perplexity',
    oldStatus: 'connected',
    newStatus: 'error',
    reason: 'API authentication failed',
    timestamp: new Date(Date.now() + 1000).toISOString()
  },
  {
    service: 'claude',
    oldStatus: 'degraded',
    newStatus: 'connected',
    reason: 'Response times normalized',
    timestamp: new Date(Date.now() + 2000).toISOString()
  }
];

// Create a test WebSocket server for API status monitoring
function createApiStatusServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api-status' });
  
  let statusIntervalId;
  let changeIndex = 0;
  let simulateChangesIntervalId;
  
  // Set up WebSocket connection handling
  wss.on('connection', (ws) => {
    // Send welcome message
    ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
    
    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle status subscription
        if (data.type === 'subscribe') {
          if (data.topic === 'api-status') {
            // Send initial status immediately
            ws.send(JSON.stringify({
              type: 'api-status',
              data: mockApiStatus
            }));
            
            // Set up interval for periodic updates
            statusIntervalId = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                const updatedStatus = {
                  ...mockApiStatus,
                  lastUpdated: new Date().toISOString()
                };
                ws.send(JSON.stringify({
                  type: 'api-status',
                  data: updatedStatus
                }));
              }
            }, 5000); // Update every 5 seconds
          }
          
          if (data.topic === 'status-changes') {
            // Simulate status change events
            simulateChangesIntervalId = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN && changeIndex < mockStatusChanges.length) {
                ws.send(JSON.stringify({
                  type: 'status-change',
                  data: mockStatusChanges[changeIndex]
                }));
                changeIndex++;
                
                // Stop after sending all changes
                if (changeIndex >= mockStatusChanges.length) {
                  clearInterval(simulateChangesIntervalId);
                }
              }
            }, 1000); // Send a change every second
          }
        }
        
        // Handle status query (manual request for current status)
        if (data.type === 'query' && data.topic === 'api-status') {
          ws.send(JSON.stringify({
            type: 'api-status',
            data: {
              ...mockApiStatus,
              lastUpdated: new Date().toISOString()
            }
          }));
        }
        
        // Handle unsubscribe requests
        if (data.type === 'unsubscribe') {
          if (data.topic === 'api-status' && statusIntervalId) {
            clearInterval(statusIntervalId);
            statusIntervalId = null;
          }
          if (data.topic === 'status-changes' && simulateChangesIntervalId) {
            clearInterval(simulateChangesIntervalId);
            simulateChangesIntervalId = null;
          }
        }
      } catch (error) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format',
          details: error.message
        }));
      }
    });
    
    // Clean up on connection close
    ws.on('close', () => {
      if (statusIntervalId) {
        clearInterval(statusIntervalId);
      }
      if (simulateChangesIntervalId) {
        clearInterval(simulateChangesIntervalId);
      }
    });
  });
  
  return { app, server, wss };
}

describe('WebSocket API Service Status Monitoring', () => {
  let server;
  let wss;
  let serverAddress;
  let clientSocket;
  
  beforeAll((done) => {
    // Start WebSocket server for testing
    const setup = createApiStatusServer();
    server = setup.server;
    wss = setup.wss;
    
    server.listen(() => {
      const address = server.address();
      serverAddress = `ws://localhost:${address.port}/api-status`;
      done();
    });
  });
  
  afterAll((done) => {
    // Clean up server
    if (server && server.listening) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });
  
  beforeEach((done) => {
    // Create new client connection before each test
    clientSocket = new WebSocket(serverAddress);
    clientSocket.on('open', () => {
      done();
    });
  });
  
  afterEach(() => {
    // Close client connection after each test
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close();
    }
  });
  
  it('should establish connection successfully', (done) => {
    clientSocket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('connection');
      expect(message.status).toBe('connected');
      done();
    });
  });
  
  it('should receive API status data on subscription', (done) => {
    let messageCount = 0;
    
    clientSocket.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // After welcome message, subscribe to API status
        clientSocket.send(JSON.stringify({
          type: 'subscribe',
          topic: 'api-status'
        }));
      } else if (messageCount === 2) {
        // This should be the API status data
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('api-status');
        expect(message.data).toBeDefined();
        expect(message.data.claude).toBeDefined();
        expect(message.data.perplexity).toBeDefined();
        expect(message.data.claude.status).toBe('connected');
        expect(message.data.perplexity.status).toBe('connected');
        expect(message.data.lastUpdated).toBeDefined();
        done();
      }
    });
  });
  
  it('should receive status change notifications', (done) => {
    let messageCount = 0;
    const statusChanges = [];
    
    clientSocket.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // After welcome message, subscribe to status changes
        clientSocket.send(JSON.stringify({
          type: 'subscribe',
          topic: 'status-changes'
        }));
      } else if (message.type === 'status-change') {
        // Collect status change events
        const message = JSON.parse(data.toString());
        statusChanges.push(message.data);
        
        // After collecting all changes, verify them
        if (statusChanges.length === 3) {
          expect(statusChanges[0].service).toBe('claude');
          expect(statusChanges[0].newStatus).toBe('degraded');
          
          expect(statusChanges[1].service).toBe('perplexity');
          expect(statusChanges[1].newStatus).toBe('error');
          
          expect(statusChanges[2].service).toBe('claude');
          expect(statusChanges[2].oldStatus).toBe('degraded');
          expect(statusChanges[2].newStatus).toBe('connected');
          
          done();
        }
      }
    });
  });
  
  it('should support direct query for current status', (done) => {
    let messageCount = 0;
    
    clientSocket.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // After welcome message, send a status query
        clientSocket.send(JSON.stringify({
          type: 'query',
          topic: 'api-status'
        }));
      } else if (messageCount === 2) {
        // This should be the response to our query
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('api-status');
        expect(message.data).toBeDefined();
        expect(message.data.claude).toBeDefined();
        expect(message.data.perplexity).toBeDefined();
        expect(message.data.healthScore).toBe(98);
        done();
      }
    });
  });
  
  it('should handle invalid message formats with proper error response', (done) => {
    let messageCount = 0;
    
    clientSocket.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // After welcome message, send invalid message
        clientSocket.send('not a valid JSON message');
      } else if (messageCount === 2) {
        // This should be the error response
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('error');
        expect(message.message).toBe('Invalid message format');
        done();
      }
    });
  });
});