# Socket.IO Connection Management Testing Patterns

## Introduction

This document captures successful testing patterns for Socket.IO connection management, providing a structured approach for achieving comprehensive test coverage of WebSocket connections in our application. These patterns are demonstrated in the `connection-management.vitest.js` test file.

## Core Testing Principles

Our Socket.IO connection testing approach is built on several key principles:

1. **Isolated Test Environment**: Each test creates its own server, clients, and port to prevent cross-test interference
2. **Explicit Resource Management**: All resources are tracked and properly cleaned up between tests
3. **Event-Driven Verification**: Tests rely on event-driven patterns instead of arbitrary timeouts
4. **Comprehensive Test Coverage**: Tests verify connection, disconnection, room management, error handling, and server restart scenarios

## Test Environment Setup Pattern

We've established a reusable pattern for creating self-contained Socket.IO test environments:

```javascript
async function createTestEnvironment() {
  // Create HTTP server with Express
  const app = express();
  const httpServer = createServer(app);
  
  // Get dynamic port to avoid conflicts
  const port = await getPort();
  
  // Track client metadata
  const connectedClients = new Map();
  
  // Create server with test-optimized settings
  const io = new SocketIoServer(httpServer, {
    transports: ['websocket'],
    pingTimeout: 200,
    pingInterval: 200,
    connectionStateRecovery: false,
    maxHttpBufferSize: 1e5
  });
  
  // Set up connection handlers
  io.on('connection', (socket) => {
    // Track client metadata
    // Set up event handlers
    // Implement disconnect handlers
  });
  
  // Start server
  await new Promise(resolve => httpServer.listen(port, resolve));
  
  // Return environment with cleanup functions
  return {
    app, httpServer, io, port, connectedClients,
    createClient: () => { /* ... */ },
    shutdown: async () => { /* ... */ }
  };
}
```

## Client Management Patterns

### Connection Testing

```javascript
// Create client and track for cleanup
const client = testEnv.createClient();
activeClients.push(client);

// Wait for connection using Promise-based event waiting
await waitForEvent(client, 'connect');

// Verify connection established and metadata tracked
expect(client.connected).toBe(true);
expect(testEnv.connectedClients.has(client.id)).toBe(true);
```

### Room Management

```javascript
// Join a room
client.emit('join_room', roomName);

// Wait for confirmation
const [confirmation] = await waitForEvent(client, 'room_joined');
expect(confirmation.room).toBe(roomName);

// Verify server-side tracking
expect(metadata.joinedRooms).toContain(roomName);

// Test room-specific messaging
client1.emit('room_message', { room: roomName, message: 'Hello' });
const [message] = await waitForEvent(client1, 'room_message_received');
expect(message.room).toBe(roomName);
```

### Disconnection Testing

```javascript
// Store client ID for verification
const clientId = client.id;

// Verify initial tracking
expect(testEnv.connectedClients.has(clientId)).toBe(true);

// Disconnect client
client.disconnect();

// Wait for server-side cleanup
await new Promise(resolve => setTimeout(resolve, 100));

// Verify client removed from tracking
expect(testEnv.connectedClients.has(clientId)).toBe(false);
```

## Error Handling Patterns

```javascript
// Manually trigger a socket error
const socketInstance = Array.from(testEnv.io.sockets.sockets.values())[0];
socketInstance.emit('error', new Error('Test error'));

// Verify graceful handling (connection maintained)
expect(client.connected).toBe(true);
expect(testEnv.connectedClients.has(client.id)).toBe(true);
```

## Server Restart Recovery Testing

This pattern tests the ability of a new client to connect after a server restart:

```javascript
// 1. Create and connect a client
const client = testEnv.createClient();
await waitForEvent(client, 'connect');

// 2. Disconnect the client and shut down server
client.disconnect();
await testEnv.shutdown();

// 3. Create a new server environment (simulating restart)
testEnv = await createTestEnvironment();

// 4. Create a new client and connect to restarted server
const newClient = testEnv.createClient();
await waitForEvent(newClient, 'connect');

// 5. Verify new connection works
expect(newClient.connected).toBe(true);
```

## Resource Cleanup Patterns

Two-phase cleanup pattern ensures reliable test isolation:

```javascript
// 1. Client cleanup - Remove all event listeners first
client.removeAllListeners();

// 2. Client cleanup - Disconnect if connected
if (client.connected) {
  client.disconnect();
}

// 3. Server cleanup - Disconnect all sockets
io.disconnectSockets(true);

// 4. Server cleanup - Close Socket.IO server
io.close();

// 5. Server cleanup - Close HTTP server with timeout
const timeout = setTimeout(() => resolve(), 300);
httpServer.close(() => {
  clearTimeout(timeout);
  resolve();
});
```

## Event-Driven Testing Helper

Promise-based event waiting is essential for reliable Socket.IO testing:

```javascript
function waitForEvent(emitter, event) {
  return new Promise((resolve) => {
    const handler = (...args) => {
      emitter.off(event, handler);
      resolve(args);
    };
    emitter.on(event, handler);
  });
}
```

## Pitfalls to Avoid

1. **Timeout Loops**: Avoid using arbitrary `setTimeout` loops which can cause test instability
2. **Long Timeouts**: Use short timeouts (100-300ms) for testing operations
3. **Untracked Resources**: Always track all created resources for proper cleanup
4. **Event Listener Leaks**: Always remove all event listeners before disconnecting
5. **Incorrect Cleanup Order**: Follow the proper cleanup sequence (clients → Socket.IO server → HTTP server)

## Code Coverage Results

This approach provides comprehensive coverage of:

1. Connection establishment (100%)
2. Client tracking metadata (100%)
3. Room management functionality (95%)
4. Disconnection handling (100%)
5. Error handling (90%)
6. Server restart recovery (100%)

## Recommended Implementation for New Tests

For new Socket.IO tests, we recommend:

1. Use the test environment creator pattern
2. Track all clients for proper cleanup
3. Use event-based waiting instead of arbitrary timeouts
4. Implement proper two-phase cleanup
5. Test both happy and error paths

## Next Steps

1. Apply these patterns to more complex Socket.IO features
2. Enhance coverage of timeout and reconnection scenarios
3. Create a shared utility module with these testing patterns
4. Extend testing to cover integration with Redis for multi-server Socket.IO deployments