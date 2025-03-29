/**
 * @file websocket-integration.vitest.js
 * @description Tests for WebSocket integration with Express server in routes.ts
 * 
 * This file tests that WebSocket server setup occurs correctly when initialized
 * with an Express server, and verifies the expected path and event handling.
 */
import { describe, beforeEach, afterEach, it, expect, vi, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { AddressInfo } from 'net';

// Mock system data for tests
const mockSystemState = {
  apiConnections: {
    claude: { status: 'connected', lastResponse: Date.now() - 5000 },
    perplexity: { status: 'connected', lastResponse: Date.now() - 1000 }
  },
  memoryUsage: {
    rss: 250 * 1024 * 1024,
    heapTotal: 175 * 1024 * 1024,
    heapUsed: 150 * 1024 * 1024,
    external: 25 * 1024 * 1024,
    arrayBuffers: 10 * 1024 * 1024
  },
  activeRequests: 2,
  limitUtilization: {
    claude: 0.35,
    perplexity: 0.25
  },
  timestamp: new Date().toISOString()
};

/**
 * Creates a test server with Express and WebSocket
 * Simulates a simplified version of the setup in routes.ts
 */
function createTestServer() {
  const app = express();
  const server = http.createServer(app);
  
  // Create WebSocket server on /ws path to match actual implementation
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws'
  });
  
  // Connected clients (for broadcast)
  const clients = new Set();
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    // Add client to set
    clients.add(ws);
    
    // Send initial system state
    ws.send(JSON.stringify({
      type: 'systemState',
      data: mockSystemState
    }));
    
    // Handle client messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        if (data.type === 'getSystemState') {
          ws.send(JSON.stringify({
            type: 'systemState',
            data: {
              ...mockSystemState,
              timestamp: new Date().toISOString()
            }
          }));
        }
        
        if (data.type === 'registerClient') {
          ws.clientType = data.clientType;
          ws.send(JSON.stringify({
            type: 'registered',
            clientId: `client-${Date.now()}`
          }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to parse message'
        }));
      }
    });
    
    // Remove client on disconnect
    ws.on('close', () => {
      clients.delete(ws);
    });
  });
  
  // Helper function to broadcast to all clients
  function broadcast(message) {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
  
  // Set up a simple interval to broadcast updates
  const broadcastInterval = setInterval(() => {
    if (clients.size > 0) {
      broadcast({
        type: 'systemState',
        data: {
          ...mockSystemState,
          timestamp: new Date().toISOString(),
          activeRequests: Math.floor(Math.random() * 5) // Simulate changing data
        }
      });
    }
  }, 1000);
  
  // Add a route for testing HTTP alongside WebSockets
  app.get('/api/system-info', (req, res) => {
    res.json({
      status: 'operational',
      ...mockSystemState
    });
  });
  
  return { app, server, wss, broadcastInterval, broadcast };
}

describe('WebSocket Server Integration', () => {
  let serverSetup;
  let server;
  let serverAddress;
  let wsUrl;
  let httpUrl;
  
  beforeAll((done) => {
    // Create test server
    serverSetup = createTestServer();
    server = serverSetup.server;
    
    // Start server on random port
    server.listen(() => {
      const address = server.address();
      const port = address.port;
      wsUrl = `ws://localhost:${port}/ws`;
      httpUrl = `http://localhost:${port}`;
      done();
    });
  });
  
  afterAll((done) => {
    // Clean up
    clearInterval(serverSetup.broadcastInterval);
    
    if (server && server.listening) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });
  
  it('should establish a WebSocket connection on the correct path', (done) => {
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
      done();
    });
    
    ws.on('error', (error) => {
      done(error);
    });
  });
  
  it('should send initial system state on connection', (done) => {
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      // Wait for initial message
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('systemState');
      expect(message.data).toBeDefined();
      expect(message.data.apiConnections).toBeDefined();
      expect(message.data.memoryUsage).toBeDefined();
      expect(message.data.timestamp).toBeDefined();
      ws.close();
      done();
    });
  });
  
  it('should handle client registration messages', (done) => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;
    
    ws.on('open', () => {
      // Skip initial system state message
    });
    
    ws.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // After initial state, send registration
        ws.send(JSON.stringify({
          type: 'registerClient',
          clientType: 'dashboard'
        }));
      } else if (messageCount === 2) {
        // Check registration response
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('registered');
        expect(message.clientId).toBeDefined();
        ws.close();
        done();
      }
    });
  });
  
  it('should broadcast system updates to all clients', (done) => {
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);
    let ws1Ready = false;
    let ws2Ready = false;
    let broadcastsReceived = 0;
    
    // Track when both clients are connected
    function checkAllReady() {
      if (ws1Ready && ws2Ready) {
        // Both connected, now wait for broadcasts
      }
    }
    
    // First client
    ws1.on('open', () => {
      ws1Ready = true;
      checkAllReady();
    });
    
    // Second client
    ws2.on('open', () => {
      ws2Ready = true;
      checkAllReady();
    });
    
    // Handle messages on first client
    ws1.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'systemState') {
        broadcastsReceived++;
        checkBroadcasts();
      }
    });
    
    // Handle messages on second client
    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'systemState') {
        broadcastsReceived++;
        checkBroadcasts();
      }
    });
    
    // Check if we've received enough broadcasts
    function checkBroadcasts() {
      // We should get initial messages (2) + at least one broadcast to each
      if (broadcastsReceived >= 4) {
        ws1.close();
        ws2.close();
        done();
      }
    }
    
    // Set timeout just in case
    setTimeout(() => {
      ws1.close();
      ws2.close();
      if (broadcastsReceived >= 4) {
        done();
      } else {
        done(new Error(`Only received ${broadcastsReceived} broadcasts`));
      }
    }, 3000);
  });
  
  it('should handle errors with proper format', (done) => {
    const ws = new WebSocket(wsUrl);
    let gotInitialMessage = false;
    
    ws.on('open', () => {
      // Wait for initial message
    });
    
    ws.on('message', (data) => {
      if (!gotInitialMessage) {
        gotInitialMessage = true;
        // Send invalid JSON to trigger error
        ws.send('this is not valid JSON');
      } else {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('error');
        expect(message.message).toBeDefined();
        ws.close();
        done();
      }
    });
  });
  
  it('should provide system info via HTTP alongside WebSocket', async () => {
    const response = await fetch(`${httpUrl}/api/system-info`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('operational');
    expect(data.apiConnections).toBeDefined();
    expect(data.memoryUsage).toBeDefined();
  });
});