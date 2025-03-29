/**
 * @file system-monitoring.vitest.js
 * @description Tests for the WebSocket-based system monitoring functionality
 */
import { describe, beforeEach, afterEach, it, expect, vi, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { AddressInfo } from 'net';

// Mock for system monitoring data
const mockSystemData = {
  memory: {
    free: 512 * 1024 * 1024,
    total: 1024 * 1024 * 1024,
    used: 512 * 1024 * 1024,
    percentUsed: 50
  },
  apiStatus: {
    claude: { status: 'connected', model: 'claude-3-7-sonnet-20250219' },
    perplexity: { status: 'connected', model: 'sonar' }
  },
  jobQueue: {
    waiting: 2,
    active: 1,
    completed: 15,
    failed: 0
  },
  timestamp: new Date().toISOString()
};

// Create a test WebSocket server
function createWebSocketServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  let intervalId;
  
  // Set up WebSocket connection handling
  wss.on('connection', (ws) => {
    // Send welcome message
    ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
    
    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle subscription requests
        if (data.type === 'subscribe') {
          if (data.topic === 'system') {
            // Send system data immediately after subscription
            ws.send(JSON.stringify({
              type: 'system',
              data: mockSystemData
            }));
            
            // Then set up interval to send periodic updates
            intervalId = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'system',
                  data: {
                    ...mockSystemData,
                    timestamp: new Date().toISOString()
                  }
                }));
              }
            }, 1000); // Send every second
          }
        }
        
        // Handle unsubscribe requests
        if (data.type === 'unsubscribe') {
          if (data.topic === 'system' && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });
    
    // Clean up on connection close
    ws.on('close', () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });
  });
  
  return { app, server, wss };
}

describe('WebSocket System Monitoring', () => {
  let server;
  let wss;
  let serverAddress;
  let clientSocket;
  
  beforeAll((done) => {
    // Start WebSocket server for testing
    const setup = createWebSocketServer();
    server = setup.server;
    wss = setup.wss;
    
    server.listen(() => {
      const address = server.address();
      serverAddress = `ws://localhost:${address.port}/ws`;
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
  
  it('should receive welcome message on connection', (done) => {
    clientSocket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('connection');
      expect(message.status).toBe('connected');
      done();
    });
  });
  
  it('should allow subscription to system monitoring', (done) => {
    // Skip initial welcome message
    let messageCount = 0;
    
    clientSocket.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // This is the welcome message, now send subscription
        clientSocket.send(JSON.stringify({
          type: 'subscribe',
          topic: 'system'
        }));
      } else if (messageCount === 2) {
        // This should be the system data
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('system');
        expect(message.data).toBeDefined();
        expect(message.data.memory).toBeDefined();
        expect(message.data.apiStatus).toBeDefined();
        expect(message.data.jobQueue).toBeDefined();
        expect(message.data.timestamp).toBeDefined();
        done();
      }
    });
  });
  
  it('should handle unsubscribe requests', (done) => {
    // Skip initial welcome message
    let messageCount = 0;
    let lastTimestamp = null;
    
    clientSocket.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // This is the welcome message, now send subscription
        clientSocket.send(JSON.stringify({
          type: 'subscribe',
          topic: 'system'
        }));
      } else if (messageCount === 2) {
        // This is the first system data
        const message = JSON.parse(data.toString());
        lastTimestamp = message.data.timestamp;
        
        // Now unsubscribe
        clientSocket.send(JSON.stringify({
          type: 'unsubscribe',
          topic: 'system'
        }));
        
        // Wait a bit to verify no more messages are received
        setTimeout(() => {
          // We should still be at message count 2
          expect(messageCount).toBe(2);
          done();
        }, 2000);
      } else if (messageCount > 2) {
        // We shouldn't receive more messages after unsubscribe
        const message = JSON.parse(data.toString());
        if (message.type === 'system') {
          // Only check additional system messages (ignoring potential acknowledgment of unsubscribe)
          expect(message.data.timestamp).not.toBe(lastTimestamp);
          fail('Should not receive system updates after unsubscribe');
        }
      }
    });
  });
  
  it('should handle invalid message formats', (done) => {
    // Skip initial welcome message
    let sawWelcomeMessage = false;
    
    clientSocket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (!sawWelcomeMessage) {
        sawWelcomeMessage = true;
        // Send an invalid message
        clientSocket.send('this is not valid JSON');
      } else if (message.type === 'error') {
        expect(message.message).toBe('Invalid message format');
        done();
      }
    });
  });
});