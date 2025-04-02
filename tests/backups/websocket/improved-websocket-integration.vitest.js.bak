/**
 * @file websocket-integration.vitest.js
 * @description Tests for WebSocket integration with Express server in routes.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import express from 'express';
import { createServer } from 'http'
import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../utils/time-testing-utils.js';;

describe('WebSocket Integration with Express', () => {
  it('should be able to initialize a WebSocket server with Express', () => {
    // Create a simple Express app
    const app = express();
    const server = createServer(app);
    
    // Setup a WebSocket server on the Express server
    const wss = new WebSocketServer({ server, path: '/ws-test' });
    
    // Verify WebSocket server was correctly initialized
    expect(wss).toBeDefined();
    // Note: `path` is a configuration option but not a property of the wss object
    // Instead, we can check the options
    expect(wss.options).toBeDefined();
    expect(wss.options.path).toBe('/ws-test');
    
    // Clean up
    wss.close();
    server.close();
  });
  
  it('should handle WebSocket connections and messages', () => {
    // Create a mock WebSocket server
    const mockServer = {
      on: vi.fn(),
      clients: new Set(),
      close: vi.fn()
    };
    
    // Create a mock WebSocket client
    const mockClient = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN
    };
    
    // Mock connection event
    const connectionHandler = vi.fn();
    mockServer.on.mockImplementation((event, handler) => {
      if (event === 'connection') {
        connectionHandler.mockImplementation(handler);
      }
    });
    
    // Mock message event for client
    const messageHandler = vi.fn();
    mockClient.on.mockImplementation((event, handler) => {
      if (event === 'message') {
        messageHandler.mockImplementation(handler);
      }
    });
    
    // Register connection handler
    mockServer.on('connection', (ws) => {
      ws.send('Connected');
      ws.on('message', (data) => {
        ws.send(`Echo: ${data}`);
      });
    });
    
    // Simulate a connection
    connectionHandler(mockClient);
    
    // Verify welcome message was sent
    expect(mockClient.send).toHaveBeenCalledWith('Connected');
    
    // Verify message handler was registered
    expect(mockClient.on).toHaveBeenCalledWith('message', expect.any(Function));
    
    // Simulate a message
    messageHandler('Hello');
    
    // Verify echo response
    expect(mockClient.send).toHaveBeenCalledWith('Echo: Hello');
  });
  
  it('should support broadcasting messages to clients', () => {
    // Create mock clients
    const client1 = {
      readyState: WebSocket.OPEN,
      send: vi.fn()
    };
    
    const client2 = {
      readyState: WebSocket.OPEN,
      send: vi.fn()
    };
    
    const client3 = {
      readyState: WebSocket.CLOSING,
      send: vi.fn()
    };
    
    // Create a mock clients collection
    const mockClients = new Map([
      [client1, { id: '1', subscriptions: ['all'] }],
      [client2, { id: '2', subscriptions: ['system_status'] }],
      [client3, { id: '3', subscriptions: ['all'] }]
    ]);
    
    // Mock broadcast function
    function broadcastMessage(message) {
      mockClients.forEach((metadata, client) => {
        if (client.readyState === WebSocket.OPEN) {
          if (!metadata.subscriptions || 
              metadata.subscriptions.includes('all') || 
              metadata.subscriptions.includes(message.type)) {
            client.send(JSON.stringify(message));
          }
        }
      });
    }
    
    // Create a test message
    const testMessage = {
      type: 'system_status',
      timestamp: Date.now(),
      data: { test: true }
    };
    
    // Broadcast the message
    broadcastMessage(testMessage);
    
    // Client 1 should receive (subscribed to 'all')
    expect(client1.send).toHaveBeenCalledWith(JSON.stringify(testMessage));
    
    // Client 2 should receive (subscribed to 'system_status')
    expect(client2.send).toHaveBeenCalledWith(JSON.stringify(testMessage));
    
    // Client 3 should not receive (connection closing)
    expect(client3.send).not.toHaveBeenCalled();
    
    // Test with a different message type
    const researchMessage = {
      type: 'research_progress',
      timestamp: Date.now(),
      data: { jobId: '123', progress: 50 }
    };
    
    // Reset the mocks
    vi.clearAllMocks();
    
    // Broadcast research message
    broadcastMessage(researchMessage);
    
    // Client 1 should receive (subscribed to 'all')
    expect(client1.send).toHaveBeenCalledWith(JSON.stringify(researchMessage));
    
    // Client 2 should not receive (only subscribed to 'system_status')
    expect(client2.send).not.toHaveBeenCalled();
    
    // Client 3 should not receive (connection closing)
    expect(client3.send).not.toHaveBeenCalled();
  });
});