# Socket.IO Testing Guide

This guide explains how to write reliable tests for Socket.IO applications to avoid common timeout and stability issues that plague WebSocket testing.

## Common Socket.IO Testing Issues

Testing WebSockets and Socket.IO can be problematic due to:

1. **Resource Leaks**: Improper cleanup leads to hanging tests and timeouts
2. **Asynchronous Operations**: Race conditions and timing issues
3. **Port Conflicts**: Tests trying to use the same ports
4. **Reconnection Complexity**: Complex reconnection logic is hard to test
5. **Event-Driven Nature**: Events may be missed if not properly waited for

## Improved Testing Approach

The improved testing approach in this project addresses these issues with:

- **Proper Resource Isolation**: Each test gets its own server on a unique port
- **Explicit Event Waiting**: Use of promise-based wait utilities for events
- **Robust Cleanup**: Comprehensive teardown of connections, servers, and listeners
- **Timeout Management**: Short timeouts for faster test failures
- **Event-Driven Testing**: Pattern that relies on events rather than arbitrary delays

## Testing Utilities

The `../utils/socket-test-utils.js` file provides several utilities:

### `createSocketTestEnvironment(options)`

Creates an isolated test environment with an Express app, HTTP server, and Socket.IO server.

```javascript
const testEnv = await createSocketTestEnvironment({ 
  debug: true,
  // Use a specific port (or one will be assigned)
  port: 3050
});
```

### `waitForConnect(socket, timeoutMs)`

Waits for a Socket.IO client to connect with a timeout.

```javascript
await waitForConnect(client, 1000);
expect(client.connected).toBe(true);
```

### `waitForEvent(socket, eventName, timeoutMs)`

Waits for a specific Socket.IO event with a timeout.

```javascript
await waitForEvent(client, 'disconnect', 1000);
expect(client.connected).toBe(false);
```

### `waitForMessageType(socket, messageType, timeoutMs)`

Waits for a message of a specific type on the 'message' event (app-specific pattern).

```javascript
const status = await waitForMessageType(client, 'system_status', 1000);
expect(status.type).toBe('system_status');
```

### `createReconnectionHandler(socket, options)`

Creates a handler for testing reconnection scenarios.

```javascript
const reconnHandler = createReconnectionHandler(client, { debug: true });
await reconnHandler.simulateNetworkDropAndReconnect(2000);
expect(client.connected).toBe(true);
```

## Test Patterns

### Basic Connection Test

```javascript
it('should establish connection and exchange messages', async () => {
  const client = testEnv.createClient();
  await waitForConnect(client, 1000);
  
  client.emit('ping');
  const response = await waitForMessageType(client, 'pong', 1000);
  expect(response.type).toBe('pong');
});
```

### Room-Based Tests

```javascript
it('should subscribe to rooms and receive messages', async () => {
  const client = testEnv.createClient();
  await waitForConnect(client, 1000);
  
  client.emit('subscribe', { topics: ['updates'] });
  await waitForMessageType(client, 'subscription_update', 1000);
  
  testEnv.broadcastToRoom('updates', {
    type: 'update_notification',
    content: 'Test update'
  });
  
  const message = await waitForMessageType(client, 'update_notification', 1000);
  expect(message.content).toBe('Test update');
});
```

### Reconnection Tests

```javascript
it('should handle reconnection after network drop', async () => {
  const client = testEnv.createClient({
    reconnection: true,
    reconnectionDelay: 100
  });
  
  const reconnHandler = createReconnectionHandler(client, { debug: true });
  await waitForConnect(client, 1000);
  
  const reconnState = await reconnHandler.simulateNetworkDropAndReconnect(2000);
  expect(reconnState.reconnected).toBe(true);
  expect(client.connected).toBe(true);
});
```

### Server Restart Tests

```javascript
it('should reconnect after server restart', async () => {
  const client = testEnv.createClient({
    reconnection: true,
    reconnectionDelay: 100
  });
  
  await waitForConnect(client, 1000);
  
  // Simulate server restart
  testEnv.io.disconnectSockets(true);
  testEnv.io.close();
  
  // Create new Socket.IO server on same HTTP server
  testEnv.io = new SocketIoServer(testEnv.httpServer, {
    cors: { origin: '*' }
  });
  
  // Setup basic handlers
  testEnv.io.on('connection', (socket) => {
    socket.on('ping', () => {
      socket.emit('message', { type: 'pong' });
    });
  });
  
  // Wait for reconnection
  await waitForEvent(client, 'connect', 2000);
  expect(client.connected).toBe(true);
  
  // Verify functionality after reconnection
  client.emit('ping');
  const response = await waitForMessageType(client, 'pong', 1000);
  expect(response).toBeDefined();
});
```

## Best Practices

1. **Use `.sequential` For Socket.IO Tests**: Run tests sequentially to avoid port conflicts:
   ```javascript
   describe.sequential('Socket.IO Tests', () => {
     // tests...
   });
   ```

2. **Keep Timeouts Short**: Use short timeouts (500-1000ms) to fail fast:
   ```javascript
   await waitForEvent(client, 'connect', 1000);
   ```

3. **Explicit Cleanup**: Always clean up resources in `afterEach`:
   ```javascript
   afterEach(async () => {
     await testEnv.shutdown();
   });
   ```

4. **Wait For Events**: Always wait for events rather than arbitrary timeouts:
   ```javascript
   // Good
   await waitForEvent(client, 'connect', 1000);
   
   // Bad
   await new Promise(resolve => setTimeout(resolve, 1000));
   ```

5. **Disable Reconnection** in basic tests for predictability:
   ```javascript
   const client = testEnv.createClient({
     reconnection: false
   });
   ```

6. **Use Event Simulators** when testing UI components that rely on Socket.IO:
   ```javascript
   // Simulate incoming message in component tests
   mockSocket.emit('message', { type: 'update', data: {...} });
   ```

## Debugging Tips

1. **Enable Debug Mode**: Use the debug option to see detailed logs:
   ```javascript
   const testEnv = await createSocketTestEnvironment({ debug: true });
   const client = testEnv.createClient({ debug: true });
   ```

2. **Socket.IO Debug Logs**: Enable Socket.IO's internal debugging:
   ```bash
   DEBUG=socket.io:* npm test
   ```

3. **Inspect Failed Tests**: Look for connection errors, missing events, or timeout issues:
   ```bash
   DEBUG=socket.io* npm test -- tests/unit/websocket/specific-test.vitest.js
   ```

4. **Check Port Conflicts**: If tests fail with EADDRINUSE, you may have port conflicts:
   ```bash
   # List processes using specific ports
   lsof -i :3000
   ```

## Example Test Files

1. `stable-socketio-tests.vitest.js`: Basic Socket.IO test patterns
2. `system-monitoring-improved.vitest.js`: Tests for system monitoring features