/**
 * WebSocket Client Integration Tests
 * 
 * These tests verify the browser client-side functionality for WebSocket connections.
 * Tests focus on:
 * - Establishing WebSocket connections
 * - Handling subscription logic
 * - Processing status updates
 * - Reconnection behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';

// Mock DOM for browser environment
class MockElement {
  constructor() {
    this.textContent = '';
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.attributes = {};
  }
  
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  
  getAttribute(name) {
    return this.attributes[name];
  }
}

class MockStatusDisplay {
  constructor() {
    this.elements = {
      statusIndicator: new MockElement(),
      statusText: new MockElement(),
      connectionStatus: new MockElement(),
      memoryUsage: new MockElement(),
      claudeStatus: new MockElement(),
      perplexityStatus: new MockElement(),
      lastUpdate: new MockElement(),
      messageLog: new MockElement()
    };
  }
  
  getElement(id) {
    return this.elements[id] || null;
  }
  
  updateStatusDisplay(status) {
    const { statusIndicator, statusText, memoryUsage, claudeStatus, perplexityStatus, lastUpdate } = this.elements;
    
    // Update status indicator
    statusIndicator.className = `status-indicator ${status.status}`;
    statusText.textContent = status.status.toUpperCase();
    
    // Update memory usage
    if (status.memory) {
      memoryUsage.textContent = `${status.memory.usagePercent.toFixed(1)}%`;
      memoryUsage.className = status.memory.healthy ? 'healthy' : 'unhealthy';
    }
    
    // Update API service statuses
    if (status.apiServices) {
      if (status.apiServices.claude) {
        claudeStatus.textContent = status.apiServices.claude.status;
        claudeStatus.className = status.apiServices.claude.status === 'connected' ? 'connected' : 'disconnected';
      }
      
      if (status.apiServices.perplexity) {
        perplexityStatus.textContent = status.apiServices.perplexity.status;
        perplexityStatus.className = status.apiServices.perplexity.status === 'connected' ? 'connected' : 'disconnected';
      }
    }
    
    // Update timestamp
    lastUpdate.textContent = new Date().toLocaleTimeString();
  }
  
  logMessage(message) {
    // In a real implementation, this would append to the message log
    this.elements.messageLog.textContent += JSON.stringify(message) + '\n';
  }
}

// Create a WebSocket client similar to what would be in a browser
function createWebSocketClient(serverUrl, statusDisplay) {
  const socket = ioc(serverUrl, {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });
  
  // Track connection state
  let connected = false;
  let subscriptions = ['all', 'system_status']; // Default subscriptions
  
  // Handle connection events
  socket.on('connect', () => {
    connected = true;
    
    // Subscribe to default channels
    socket.emit('subscribe', subscriptions);
    
    // Update status display
    if (statusDisplay) {
      statusDisplay.elements.connectionStatus.textContent = 'Connected';
      statusDisplay.elements.connectionStatus.className = 'connected';
    }
  });
  
  socket.on('disconnect', () => {
    connected = false;
    
    // Update status display
    if (statusDisplay) {
      statusDisplay.elements.connectionStatus.textContent = 'Disconnected';
      statusDisplay.elements.connectionStatus.className = 'disconnected';
    }
  });
  
  // Handle message events
  socket.on('message', (message) => {
    if (statusDisplay) {
      statusDisplay.logMessage(message);
      
      // Handle different message types
      if (message.type === 'system_status') {
        statusDisplay.updateStatusDisplay(message);
      }
    }
  });
  
  // Handle subscription confirmation
  socket.on('subscription_confirmed', (data) => {
    if (statusDisplay) {
      statusDisplay.logMessage({
        type: 'client_event',
        event: 'subscription_confirmed',
        channels: data.channels || []
      });
    }
  });
  
  // Define client interface
  return {
    socket,
    isConnected: () => connected,
    getSubscriptions: () => [...subscriptions],
    subscribe: (channels) => {
      if (Array.isArray(channels)) {
        // Add new channels to subscriptions
        channels.forEach(channel => {
          if (!subscriptions.includes(channel)) {
            subscriptions.push(channel);
          }
        });
        
        // Send subscription request to server
        if (connected) {
          socket.emit('subscribe', channels);
        }
      }
    },
    unsubscribe: (channels) => {
      if (Array.isArray(channels)) {
        // Remove channels from subscriptions
        subscriptions = subscriptions.filter(sub => 
          !channels.includes(sub) || sub === 'all' // Keep 'all' subscription
        );
        
        // Send unsubscription request to server
        if (connected) {
          socket.emit('unsubscribe', channels);
        }
      }
    },
    disconnect: () => {
      socket.disconnect();
    }
  };
}

// Test suite
describe('WebSocket Client Integration', () => {
  let mockApp;
  let server;
  let io;
  let port;
  let serverUrl;
  let statusDisplay;
  
  beforeEach(() => {
    // Create server
    mockApp = express();
    server = createServer(mockApp);
    io = new Server(server, { cors: { origin: '*' } });
    
    // Configure server to handle connections
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Default room for all clients
      socket.join('all');
      
      // Handle subscription requests
      socket.on('subscribe', (channels) => {
        if (Array.isArray(channels)) {
          channels.forEach(channel => {
            socket.join(channel);
          });
        }
        
        socket.emit('subscription_confirmed', { 
          channels: Array.isArray(channels) ? channels : [] 
        });
      });
      
      // Handle unsubscription requests
      socket.on('unsubscribe', (channels) => {
        if (Array.isArray(channels)) {
          channels.forEach(channel => {
            if (channel !== 'all') { // Keep clients in 'all' room
              socket.leave(channel);
            }
          });
        }
      });
    });
    
    // Start server on random port
    port = 3000 + Math.floor(Math.random() * 1000);
    server.listen(port);
    serverUrl = `http://localhost:${port}`;
    
    // Create mock status display
    statusDisplay = new MockStatusDisplay();
  });
  
  afterEach(() => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    // Close server
    return new Promise((resolve) => {
      server.close(() => {
        io.close();
        resolve();
      });
    });
  });
  
  it('should connect and receive system status updates', (done) => {
    // Create client
    const client = createWebSocketClient(serverUrl, statusDisplay);
    
    // Wait for connection
    setTimeout(() => {
      expect(client.isConnected()).toBe(true);
      
      // Send system status update
      io.to('system_status').emit('message', {
        type: 'system_status',
        timestamp: Date.now(),
        status: 'healthy',
        memory: {
          usagePercent: 45.2,
          healthy: true
        },
        apiServices: {
          claude: { status: 'connected' },
          perplexity: { status: 'connected' }
        }
      });
      
      // Check that status was updated
      setTimeout(() => {
        try {
          // Check status indicator
          expect(statusDisplay.elements.statusIndicator.className).toContain('healthy');
          expect(statusDisplay.elements.statusText.textContent).toBe('HEALTHY');
          
          // Check memory usage
          expect(statusDisplay.elements.memoryUsage.textContent).toBe('45.2%');
          expect(statusDisplay.elements.memoryUsage.className).toBe('healthy');
          
          // Check API service statuses
          expect(statusDisplay.elements.claudeStatus.textContent).toBe('connected');
          expect(statusDisplay.elements.claudeStatus.className).toBe('connected');
          
          expect(statusDisplay.elements.perplexityStatus.textContent).toBe('connected');
          expect(statusDisplay.elements.perplexityStatus.className).toBe('connected');
          
          // Clean up
          client.disconnect();
          done();
        } catch (err) {
          client.disconnect();
          done(err);
        }
      }, 100);
    }, 100);
  });
  
  it('should handle subscription management correctly', (done) => {
    // Create client
    const client = createWebSocketClient(serverUrl, statusDisplay);
    
    // Wait for connection
    setTimeout(() => {
      expect(client.isConnected()).toBe(true);
      
      // Check initial subscriptions
      const initialSubs = client.getSubscriptions();
      expect(initialSubs).toContain('all');
      expect(initialSubs).toContain('system_status');
      
      // Subscribe to new channel
      client.subscribe(['api_status']);
      
      // Check updated subscriptions
      setTimeout(() => {
        const updatedSubs = client.getSubscriptions();
        expect(updatedSubs).toContain('api_status');
        
        // Send message to api_status channel
        io.to('api_status').emit('message', {
          type: 'api_status',
          timestamp: Date.now(),
          data: { test: true }
        });
        
        // Check that message was received
        setTimeout(() => {
          expect(statusDisplay.elements.messageLog.textContent).toContain('api_status');
          
          // Unsubscribe from channel
          client.unsubscribe(['api_status']);
          
          // Verify subscription was removed
          setTimeout(() => {
            const finalSubs = client.getSubscriptions();
            expect(finalSubs).not.toContain('api_status');
            
            // Clean up
            client.disconnect();
            done();
          }, 100);
        }, 100);
      }, 100);
    }, 100);
  });
  
  it('should update UI when connection status changes', (done) => {
    // Create client
    const client = createWebSocketClient(serverUrl, statusDisplay);
    
    // Wait for connection
    setTimeout(() => {
      // Check connected status
      expect(statusDisplay.elements.connectionStatus.textContent).toBe('Connected');
      expect(statusDisplay.elements.connectionStatus.className).toBe('connected');
      
      // Disconnect client
      client.disconnect();
      
      // Check disconnected status
      setTimeout(() => {
        expect(statusDisplay.elements.connectionStatus.textContent).toBe('Disconnected');
        expect(statusDisplay.elements.connectionStatus.className).toBe('disconnected');
        done();
      }, 100);
    }, 100);
  });
  
  it('should handle degraded system status', (done) => {
    // Create client
    const client = createWebSocketClient(serverUrl, statusDisplay);
    
    // Wait for connection
    setTimeout(() => {
      // Send degraded system status
      io.to('system_status').emit('message', {
        type: 'system_status',
        timestamp: Date.now(),
        status: 'degraded',
        memory: {
          usagePercent: 85.7,
          healthy: false
        },
        apiServices: {
          claude: { status: 'connected' },
          perplexity: { status: 'error' }
        }
      });
      
      // Check status update
      setTimeout(() => {
        try {
          // Check status indicator reflects degraded state
          expect(statusDisplay.elements.statusIndicator.className).toContain('degraded');
          expect(statusDisplay.elements.statusText.textContent).toBe('DEGRADED');
          
          // Check memory shows unhealthy
          expect(statusDisplay.elements.memoryUsage.className).toBe('unhealthy');
          
          // Check perplexity shows error
          expect(statusDisplay.elements.perplexityStatus.textContent).toBe('error');
          expect(statusDisplay.elements.perplexityStatus.className).toBe('disconnected');
          
          // Clean up
          client.disconnect();
          done();
        } catch (err) {
          client.disconnect();
          done(err);
        }
      }, 100);
    }, 100);
  });
});