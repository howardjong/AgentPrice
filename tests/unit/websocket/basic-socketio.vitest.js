/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { createServer } from 'http';
import { setTimeout as timeout } from 'timers/promises';

// Setup constants
const DEBUG = process.env.DEBUG === 'true';
const PORT = 2999;
const SOCKET_URL = `http://localhost:${PORT}`;
const NAMESPACE = '/test';

// Default timeout should be shorter for WebSocket tests
const DEFAULT_TIMEOUT = 2000;

// Socket.IO connection options
const SOCKET_OPTIONS = {
  reconnectionDelay: 100,
  reconnectionAttempts: 3,
  forceNew: true,
  transports: ['websocket']
};

// For tracking events
class EventTracker {
  constructor() {
    this.events = [];
    this.listening = false;
  }

  trackEvent(eventName, data) {
    if (DEBUG) console.log(`Event received: ${eventName}`, data);
    this.events.push({ eventName, data, timestamp: Date.now() });
  }

  clear() {
    this.events = [];
  }

  startListening(socket, eventNames) {
    if (this.listening) return;
    
    eventNames.forEach(eventName => {
      socket.on(eventName, (data) => {
        this.trackEvent(eventName, data);
      });
    });
    
    this.listening = true;
  }

  getEventCount(eventName = null) {
    if (eventName) {
      return this.events.filter(e => e.eventName === eventName).length;
    }
    return this.events.length;
  }

  getLastEvent(eventName = null) {
    if (eventName) {
      const filtered = this.events.filter(e => e.eventName === eventName);
      return filtered[filtered.length - 1];
    }
    return this.events[this.events.length - 1];
  }

  async waitForEvent(eventName, timeoutMs = DEFAULT_TIMEOUT) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.events.some(e => e.eventName === eventName)) {
        return this.getLastEvent(eventName);
      }
      await timeout(50);
    }
    
    throw new Error(`Timeout waiting for event: ${eventName}`);
  }

  async waitForEventCount(eventName, count, timeoutMs = DEFAULT_TIMEOUT) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const currentCount = this.events.filter(e => e.eventName === eventName).length;
      if (currentCount >= count) {
        return true;
      }
      await timeout(50);
    }
    
    throw new Error(`Timeout waiting for ${count} occurrences of event: ${eventName}`);
  }
}

describe('Basic Socket.IO Functionality', () => {
  let httpServer;
  let socketServer;
  let clientSocket;
  let tracker;
  
  // Setup the server and client once before all tests
  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Create Socket.IO server
    socketServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    // Start the server
    await new Promise(resolve => {
      httpServer.listen(PORT, () => {
        if (DEBUG) console.log(`Server listening on port ${PORT}`);
        resolve();
      });
    });
    
    // Setup event tracker
    tracker = new EventTracker();
  });
  
  // Clean up after each test
  afterEach(async () => {
    // Disconnect client socket if it exists
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
      clientSocket = null;
    }
    
    // Clear tracked events
    if (tracker) tracker.clear();
    
    // Reset all mocks
    vi.restoreAllMocks();
  });
  
  // Clean up after all tests
  afterAll(async () => {
    // Close the socket server
    return new Promise(resolve => {
      if (socketServer) {
        socketServer.close(() => {
          if (DEBUG) console.log('Socket server closed');
          socketServer = null;
          
          // Close the HTTP server
          if (httpServer) {
            httpServer.close(() => {
              if (DEBUG) console.log('HTTP server closed');
              httpServer = null;
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else if (httpServer) {
        httpServer.close(() => {
          if (DEBUG) console.log('HTTP server closed');
          httpServer = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
  
  it('should connect to the socket server', async () => {
    const connectionTestPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for socket connection'));
      }, DEFAULT_TIMEOUT);
      
      clientSocket = ioc(SOCKET_URL, SOCKET_OPTIONS);
      
      clientSocket.on('connect', () => {
        clearTimeout(timeoutId);
        resolve();
      });
      
      clientSocket.on('connect_error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Socket connection error: ${error.message}`));
      });
    });
    
    await connectionTestPromise;
    expect(clientSocket.connected).toBe(true);
  });
  
  it('should emit and receive events', async () => {
    // Create spy for the emit event
    const emitSpy = vi.fn();
    
    // Set up server-side handler
    socketServer.on('connection', (socket) => {
      socket.on('client-event', (data) => {
        emitSpy(data);
        socket.emit('server-event', { received: true, echo: data });
      });
    });
    
    // Connect client
    clientSocket = ioc(SOCKET_URL, SOCKET_OPTIONS);
    await new Promise(resolve => clientSocket.on('connect', resolve));
    
    // Setup tracker
    tracker.startListening(clientSocket, ['server-event']);
    
    // Send event from client
    const testData = { message: 'Hello server' };
    clientSocket.emit('client-event', testData);
    
    // Wait for response
    const event = await tracker.waitForEvent('server-event');
    
    // Assert server received the event
    expect(emitSpy).toHaveBeenCalledWith(testData);
    
    // Assert client received response
    expect(event).toBeDefined();
    expect(event.data).toEqual({ received: true, echo: testData });
  });
  
  it('should handle room-based broadcasting', async () => {
    // Set up server-side handler for rooms
    socketServer.on('connection', (socket) => {
      // Handler for joining rooms
      socket.on('join-room', (roomName) => {
        socket.join(roomName);
        socket.emit('room-joined', { room: roomName });
      });
      
      // Handler for broadcasting to rooms
      socket.on('broadcast-to-room', ({ room, message }) => {
        socketServer.to(room).emit('room-broadcast', { room, message });
      });
    });
    
    // Connect two clients
    const client1 = ioc(SOCKET_URL, SOCKET_OPTIONS);
    const client2 = ioc(SOCKET_URL, SOCKET_OPTIONS);
    
    // Wait for connections
    await Promise.all([
      new Promise(resolve => client1.on('connect', resolve)),
      new Promise(resolve => client2.on('connect', resolve))
    ]);
    
    // Create trackers for both clients
    const tracker1 = new EventTracker();
    const tracker2 = new EventTracker();
    
    tracker1.startListening(client1, ['room-joined', 'room-broadcast']);
    tracker2.startListening(client2, ['room-joined', 'room-broadcast']);
    
    // Client 1 joins Room A
    client1.emit('join-room', 'RoomA');
    await tracker1.waitForEvent('room-joined');
    
    // Client 2 joins Room B
    client2.emit('join-room', 'RoomB');
    await tracker2.waitForEvent('room-joined');
    
    // Client 1 broadcasts to Room A
    client1.emit('broadcast-to-room', { room: 'RoomA', message: 'Hello Room A' });
    
    // Client 1 should receive the broadcast (it's in Room A)
    await tracker1.waitForEvent('room-broadcast');
    
    // Client 2 should NOT receive the broadcast (it's in Room B)
    try {
      await tracker2.waitForEvent('room-broadcast', 500); // Short timeout
      throw new Error('Client 2 received broadcast intended for Room A');
    } catch (error) {
      // Expected timeout error
      expect(error.message).toContain('Timeout waiting for event');
    }
    
    // Client 2 broadcasts to Room B
    client2.emit('broadcast-to-room', { room: 'RoomB', message: 'Hello Room B' });
    
    // Client 2 should receive the broadcast (it's in Room B)
    await tracker2.waitForEvent('room-broadcast');
    
    // Client 1 should NOT receive the broadcast (it's in Room A)
    try {
      await tracker1.waitForEventCount('room-broadcast', 2, 500); // Short timeout
      throw new Error('Client 1 received broadcast intended for Room B');
    } catch (error) {
      // Expected timeout error
      expect(error.message).toContain('Timeout waiting for');
    }
    
    // Cleanup
    client1.disconnect();
    client2.disconnect();
  });
  
  it('should handle disconnection properly', async () => {
    const disconnectSpy = vi.fn();
    
    // Set up server-side handler
    socketServer.on('connection', (socket) => {
      socket.on('disconnect', () => {
        disconnectSpy(socket.id);
      });
    });
    
    // Connect client
    clientSocket = ioc(SOCKET_URL, SOCKET_OPTIONS);
    await new Promise(resolve => clientSocket.on('connect', resolve));
    
    // Store socket ID for later verification
    const socketId = clientSocket.id;
    
    // Disconnect client
    clientSocket.disconnect();
    
    // Wait for disconnection to be processed
    await timeout(500);
    
    // Assert disconnect handler was called
    expect(disconnectSpy).toHaveBeenCalledWith(socketId);
    
    // Assert socket is disconnected
    expect(clientSocket.connected).toBe(false);
  });
  
  it('should handle namespace functionality', async () => {
    // Create a namespaced server
    const nsServer = socketServer.of(NAMESPACE);
    
    const namespaceSpy = vi.fn();
    
    // Setup handler for namespace
    nsServer.on('connection', (socket) => {
      namespaceSpy(socket.nsp.name);
      socket.emit('namespace-event', { namespace: socket.nsp.name });
    });
    
    // Connect to the namespace
    const nsClient = ioc(`${SOCKET_URL}${NAMESPACE}`, SOCKET_OPTIONS);
    
    // Setup tracker
    const nsTracker = new EventTracker();
    nsTracker.startListening(nsClient, ['namespace-event']);
    
    // Wait for connection and event
    await new Promise(resolve => nsClient.on('connect', resolve));
    const event = await nsTracker.waitForEvent('namespace-event');
    
    // Assert namespace handler was called
    expect(namespaceSpy).toHaveBeenCalledWith(NAMESPACE);
    
    // Assert event data is correct
    expect(event.data.namespace).toBe(NAMESPACE);
    
    // Clean up
    nsClient.disconnect();
  });
  
  it('should handle middleware properly', async () => {
    // Create a new namespace for middleware testing
    const middlewareNs = '/middleware-test';
    const mwServer = socketServer.of(middlewareNs);
    
    // Add connection middleware
    mwServer.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }
      
      if (token !== 'valid-token') {
        return next(new Error('Authentication error: Invalid token'));
      }
      
      // Attach user data to socket
      socket.user = { id: 'user-123', name: 'Test User' };
      next();
    });
    
    // Setup handler
    mwServer.on('connection', (socket) => {
      socket.emit('auth-success', { user: socket.user });
    });
    
    // Test with missing token
    const noTokenClient = ioc(`${SOCKET_URL}${middlewareNs}`, {
      ...SOCKET_OPTIONS
      // No auth token
    });
    
    // Expect connect_error event
    const noTokenError = await new Promise(resolve => {
      noTokenClient.on('connect_error', error => {
        resolve(error.message);
      });
      
      // Add timeout for error
      setTimeout(() => resolve('No error received'), DEFAULT_TIMEOUT);
    });
    
    expect(noTokenError).toContain('Authentication error: Token missing');
    
    // Test with invalid token
    const invalidTokenClient = ioc(`${SOCKET_URL}${middlewareNs}`, {
      ...SOCKET_OPTIONS,
      auth: { token: 'invalid-token' }
    });
    
    // Expect connect_error event
    const invalidTokenError = await new Promise(resolve => {
      invalidTokenClient.on('connect_error', error => {
        resolve(error.message);
      });
      
      // Add timeout for error
      setTimeout(() => resolve('No error received'), DEFAULT_TIMEOUT);
    });
    
    expect(invalidTokenError).toContain('Authentication error: Invalid token');
    
    // Test with valid token
    const validTokenClient = ioc(`${SOCKET_URL}${middlewareNs}`, {
      ...SOCKET_OPTIONS,
      auth: { token: 'valid-token' }
    });
    
    // Setup tracker
    const validTokenTracker = new EventTracker();
    validTokenTracker.startListening(validTokenClient, ['auth-success']);
    
    // Wait for connection and auth success event
    await new Promise(resolve => validTokenClient.on('connect', resolve));
    const authEvent = await validTokenTracker.waitForEvent('auth-success');
    
    // Assert user data is correct
    expect(authEvent.data.user).toEqual({ id: 'user-123', name: 'Test User' });
    
    // Clean up
    noTokenClient.disconnect();
    invalidTokenClient.disconnect();
    validTokenClient.disconnect();
  });
});