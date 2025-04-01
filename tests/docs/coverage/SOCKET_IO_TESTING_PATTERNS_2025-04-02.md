# Socket.IO Testing Patterns

## Core Strategy

Based on our detailed investigation of Socket.IO test timeout issues, we've developed the following key strategies to create stable and reliable Socket.IO tests:

1. **Explicit Control** - Take direct ownership of connection and disconnection phases
2. **Robust Cleanup** - Implement comprehensive teardown procedures
3. **Event-Driven Waiting** - Use events rather than arbitrary timeouts for synchronization
4. **Simulation-Minimal Helpers** - Create testing utilities that abstract away boilerplate but maintain explicitness

## Testing Setup Pattern

### Client Setup

```javascript
// Client setup with explicit control and timeout handling
const setupSocketIOClient = async (url = 'http://localhost:3000', options = {}) => {
  // Create socket with explicit error and connection timeout handling
  const socket = io(url, {
    reconnection: false,  // Disable automatic reconnection for tests
    timeout: 5000,        // Set a reasonable connection timeout
    forceNew: true,       // Force a new connection
    ...options
  });
  
  // Create a promise that resolves on connect or rejects on error or timeout
  return new Promise((resolve, reject) => {
    // Set a timeout limit for the connection
    const connectTimeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, 3000);
    
    // Handle successful connection
    socket.on('connect', () => {
      clearTimeout(connectTimeout);
      resolve(socket);
    });
    
    // Handle connection errors
    socket.on('connect_error', (err) => {
      clearTimeout(connectTimeout);
      socket.disconnect();
      reject(new Error(`Socket connection error: ${err.message}`));
    });
  });
};
```

### Server Setup

```javascript
// Server setup with explicit cleanup
const setupSocketServer = async (app, httpServer) => {
  // Create and attach socket server
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  
  // Set up connection handling
  io.on('connection', (socket) => {
    // Handle new connections
    socket.on('disconnect', () => {
      // Clean up resources on disconnect
    });
    
    // Add event handlers for test events
  });
  
  // Return both the io server and a cleanup function
  return {
    io,
    cleanup: () => {
      io.close();
      // Additional resource cleanup here
    }
  };
};
```

## Test Structure Pattern

```javascript
describe('Socket.IO Integration', () => {
  let server;
  let httpServer;
  let socketServer;
  let cleanup;
  let clientSocket;
  
  beforeEach(async () => {
    // Set up Express server
    server = express();
    httpServer = createServer(server);
    
    // Set up Socket.IO server with explicit cleanup function
    const setup = await setupSocketServer(server, httpServer);
    socketServer = setup.io;
    cleanup = setup.cleanup;
    
    // Start the server on a dynamic port
    await new Promise(resolve => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    
    // Connect client with explicit control
    clientSocket = await setupSocketIOClient(`http://localhost:${port}`);
  });
  
  afterEach(async () => {
    // Explicit, comprehensive cleanup in reverse order of creation
    if (clientSocket) {
      clientSocket.disconnect();
      clientSocket.close();
    }
    
    if (cleanup) cleanup();
    
    if (httpServer) {
      await new Promise(resolve => httpServer.close(resolve));
    }
    
    // Reset mocks and spies
    vi.clearAllMocks();
  });
  
  // Tests go here
});
```

## Event-Driven Waiting Pattern

```javascript
// Wait for an event rather than arbitrary timeouts
const waitForEvent = (socket, event, timeout = 2000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);
    
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
};

// Usage in tests
it('should receive a message', async () => {
  // Set up event listener with explicit promise
  const messagePromise = waitForEvent(clientSocket, 'message');
  
  // Trigger event
  serverSocket.emit('message', { text: 'hello' });
  
  // Wait for response with explicit timeout
  const message = await messagePromise;
  
  // Assertions
  expect(message).toEqual({ text: 'hello' });
});
```

## Connection Recovery Testing Pattern

```javascript
it('should handle reconnection', async () => {
  // Set up initial connection
  let socket = await setupSocketIOClient(serverUrl, { reconnection: true });
  
  // Verify connected state
  expect(socket.connected).toBe(true);
  
  // Create a promise for reconnection
  const reconnectPromise = waitForEvent(socket, 'reconnect');
  
  // Force disconnect from server side
  serverSocket.emit('force_disconnect');
  
  // Wait for reconnection with explicit timeout
  await reconnectPromise;
  
  // Verify reconnected state
  expect(socket.connected).toBe(true);
  
  // Clean up
  socket.disconnect();
});
```

## Socket State Verification Pattern

```javascript
// Helper to verify socket state
const verifySocketState = (socket, expectedState) => {
  expect(socket.connected).toBe(expectedState.connected);
  
  if (expectedState.connected) {
    expect(socket.id).toBeTruthy();
  }
};

// Usage in tests
it('should connect successfully', async () => {
  verifySocketState(clientSocket, { connected: true });
  
  clientSocket.disconnect();
  
  // Wait for disconnection to complete
  await waitForEvent(clientSocket, 'disconnect');
  
  verifySocketState(clientSocket, { connected: false });
});
```

## Mocking Socket Behavior Pattern

```javascript
// Create a socket mocker for isolated unit tests
const createSocketMock = () => {
  const events = {};
  
  return {
    // Mock emit method
    emit: vi.fn((event, ...args) => {
      // Call any registered listeners
      if (events[event]) {
        events[event].forEach(listener => listener(...args));
      }
      return true;
    }),
    
    // Mock on method
    on: vi.fn((event, callback) => {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].push(callback);
    }),
    
    // Mock once method
    once: vi.fn((event, callback) => {
      if (!events[event]) {
        events[event] = [];
      }
      events[event].push((...args) => {
        // Remove this listener after first call
        const index = events[event].indexOf(callback);
        if (index !== -1) {
          events[event].splice(index, 1);
        }
        callback(...args);
      });
    }),
    
    // Mock removeListener
    removeListener: vi.fn((event, callback) => {
      if (events[event]) {
        const index = events[event].indexOf(callback);
        if (index !== -1) {
          events[event].splice(index, 1);
        }
      }
    }),
    
    // Mock disconnect
    disconnect: vi.fn(() => {
      if (events['disconnect']) {
        events['disconnect'].forEach(listener => listener());
      }
    }),
    
    // Socket state properties
    connected: true,
    id: 'mock-socket-id'
  };
};

// Usage in unit tests
it('should handle message events', () => {
  const socketMock = createSocketMock();
  
  // Set up the component/service with mock socket
  const service = new SocketService(socketMock);
  
  // Test that service handles socket events correctly
  socketMock.emit('message', { text: 'test' });
  
  // Assertions
  expect(service.getLastMessage()).toEqual({ text: 'test' });
});
```

## Namespace Testing Pattern

```javascript
it('should work with custom namespaces', async () => {
  // Create namespace on server
  const chatNamespace = socketServer.of('/chat');
  
  // Set up namespace event handlers
  chatNamespace.on('connection', (socket) => {
    socket.on('message', (data) => {
      socket.emit('message_ack', data);
    });
  });
  
  // Connect client to namespace
  const chatClient = await setupSocketIOClient(`http://localhost:${port}/chat`);
  
  // Set up event promise
  const responsePromise = waitForEvent(chatClient, 'message_ack');
  
  // Send message
  chatClient.emit('message', { text: 'namespace test' });
  
  // Wait for response
  const response = await responsePromise;
  
  // Assertions
  expect(response).toEqual({ text: 'namespace test' });
  
  // Clean up
  chatClient.disconnect();
});
```

## Room Testing Pattern

```javascript
it('should broadcast to rooms', async () => {
  // Create multiple clients
  const client1 = await setupSocketIOClient(serverUrl);
  const client2 = await setupSocketIOClient(serverUrl);
  
  // Join room (typically handled by server logic)
  client1.emit('join', 'testRoom');
  client2.emit('join', 'testRoom');
  
  // Wait for join confirmation
  await Promise.all([
    waitForEvent(client1, 'joined'),
    waitForEvent(client2, 'joined')
  ]);
  
  // Set up event promises
  const messagePromise1 = waitForEvent(client1, 'roomMessage');
  const messagePromise2 = waitForEvent(client2, 'roomMessage');
  
  // Trigger server broadcast to room
  // (in a real test, this might be triggered by another client)
  serverSocket.to('testRoom').emit('roomMessage', { text: 'room test' });
  
  // Wait for broadcast messages
  const [message1, message2] = await Promise.all([messagePromise1, messagePromise2]);
  
  // Assertions
  expect(message1).toEqual({ text: 'room test' });
  expect(message2).toEqual({ text: 'room test' });
  
  // Clean up
  client1.disconnect();
  client2.disconnect();
});
```

## Error Handling Patterns

```javascript
it('should handle connection errors', async () => {
  // Attempt to connect to non-existent server
  await expect(
    setupSocketIOClient('http://non-existent-server:9999')
  ).rejects.toThrow('Socket connection error');
});

it('should handle event timeout errors', async () => {
  // Set up event promise with short timeout
  const messagePromise = waitForEvent(clientSocket, 'message', 100);
  
  // Don't emit any event to trigger timeout
  
  // Expect timeout error
  await expect(messagePromise).rejects.toThrow('Timeout waiting for event');
});
```

## Test Utilities

Creating focused utility functions helps maintain explicit control while reducing boilerplate:

```javascript
// test-utils/socket-testing.js
export const socketTestUtils = {
  setupServer: async () => {
    // Create and start server with Socket.IO
    // Return server, cleanup function, and URL
  },
  
  setupClient: async (url, options) => {
    // Create and connect client
    // Return socket client instance
  },
  
  waitForEvent: (socket, event, timeout = 2000) => {
    // Create promise that resolves on event or rejects on timeout
  },
  
  createSocketMock: () => {
    // Create a mock socket for unit tests
  },
  
  cleanup: async (clients, server, httpServer) => {
    // Comprehensive cleanup function
  }
};

// Usage in tests
import { socketTestUtils } from '../test-utils/socket-testing';

describe('Chat Service', () => {
  let server, cleanup, client;
  
  beforeEach(async () => {
    // Set up test environment
    const setup = await socketTestUtils.setupServer();
    server = setup.server;
    cleanup = setup.cleanup;
    
    // Connect client
    client = await socketTestUtils.setupClient(setup.url);
  });
  
  afterEach(async () => {
    // Clean up resources
    await socketTestUtils.cleanup([client], server);
  });
  
  it('should send and receive messages', async () => {
    // Set up event wait
    const responsePromise = socketTestUtils.waitForEvent(client, 'message_received');
    
    // Emit event
    client.emit('send_message', { text: 'test' });
    
    // Wait for response
    const response = await responsePromise;
    
    // Assertions
    expect(response).toHaveProperty('id');
    expect(response.text).toBe('test');
  });
});
```

## Common Pitfalls and Solutions

1. **Timeout Issues**
   - **Problem**: Tests hang or time out unpredictably
   - **Solution**: Use explicit timeouts with every async operation, and implement comprehensive cleanup

2. **Resource Leaks**
   - **Problem**: Sockets or servers remain active between tests
   - **Solution**: Implement thorough cleanup in afterEach and use try/finally blocks

3. **Race Conditions**
   - **Problem**: Events occur out of expected order
   - **Solution**: Use explicit promises and waitForEvent patterns instead of setTimeout

4. **Reconnection Loops**
   - **Problem**: Automatic reconnection attempts continue after tests
   - **Solution**: Disable reconnection for tests with `reconnection: false`

5. **Cross-Test Contamination**
   - **Problem**: Socket state from one test affects another
   - **Solution**: Use unique socket instances per test and implement comprehensive cleanup

## Best Practices Summary

1. **Avoid Arbitrary Timeouts**
   - Never use arbitrary setTimeout for event synchronization
   - Use event promises with explicit timeouts

2. **Explicit Connection Control**
   - Take direct control of connection and disconnection
   - Don't rely on automatic reconnection in tests

3. **Cleanup in Reverse Order**
   - Clean up resources in reverse order of creation
   - Use try/finally blocks for guaranteed cleanup

4. **Use Dynamic Ports**
   - Avoid hardcoded ports for test servers
   - Let the OS assign available ports for parallel test runs

5. **Test State Isolation**
   - Ensure complete isolation between tests
   - Reset all state in afterEach blocks

6. **Abstract Boilerplate, Not Control**
   - Create utility functions that reduce boilerplate but maintain explicit control
   - Avoid "magic" testing utilities that hide important implementation details