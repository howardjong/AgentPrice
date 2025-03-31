# Socket.IO Testing Best Practices

This document outlines best practices for testing Socket.IO connections based on our experiences resolving timeout and reliability issues in the test suite.

## Core Principles

1. **Isolation**: Each test should be completely self-contained with its own server, clients, and port.
2. **Explicit Control**: Avoid relying on Socket.IO's automatic reconnection; control every step of the process manually.
3. **Comprehensive Cleanup**: Ensure all resources are properly cleaned up, especially in failure scenarios.
4. **Detailed Logging**: Use comprehensive logging to diagnose issues.
5. **Proper Assertions**: Test one behavior at a time with clear assertions.

## Test Structure

### Preferred Approach: Self-Contained Tests

For most reliable results, especially for reconnection scenarios, use completely self-contained tests that handle their own setup and teardown:

```javascript
it('should reconnect after server restart', async () => {
  // Setup inside the test itself, not in beforeEach
  const port = await getPort();
  let httpServer = createServer();
  let io = new Server(httpServer);
  
  try {
    // Test steps with explicit error handling
  } catch (error) {
    console.error('Test error:', error);
    throw error;
  } finally {
    // Explicit cleanup with no assumptions
    if (client) {
      try { client.disconnect(); } catch (e) {}
      try { client.removeAllListeners(); } catch (e) {}
    }
    
    if (io) {
      try { io.disconnectSockets(true); } catch (e) {}
      try { io.close(); } catch (e) {}
    }
    
    if (httpServer && httpServer.listening) {
      try { await new Promise(resolve => httpServer.close(resolve)); } catch (e) {}
    }
  }
});
```

### Reusable Class Approach

For simpler tests, use the `SocketTestEnvironment` class:

```javascript
describe('Socket.IO Tests', () => {
  let env;
  
  beforeEach(async () => {
    env = new SocketTestEnvironment();
    await env.setup();
  });
  
  afterEach(async () => {
    try {
      await env.teardown();
    } catch (err) {
      console.error('Error during teardown:', err);
    }
  });
  
  it('should connect successfully', async () => {
    const client = env.createClient();
    await env.connectClient(client);
    expect(client.connected).toBe(true);
  });
});
```

## Resource Management

### Port Allocation

Always use dynamic port allocation to prevent conflicts:

```javascript
import getPort from 'get-port';

// In test setup
const port = await getPort();
httpServer.listen(port);
```

### Client Creation

Create clients with explicit configuration:

```javascript
const client = io(`http://localhost:${port}`, {
  forceNew: true,          // Prevent connection pooling
  autoConnect: false,      // Manual control over connection
  reconnection: false,     // Disable automatic reconnection
  timeout: 3000,           // Reasonable timeout
  transports: ['websocket'] // Consistent transport
});
```

### Event Listening

Use the `waitForEvent` utility for reliable event testing:

```javascript
function waitForEvent(emitter, event, timeout = 3000) {
  console.log(`Waiting for '${event}' event with ${timeout}ms timeout`);
  
  // Short-circuit if already in the desired state
  if (event === 'connect' && emitter.connected) {
    return Promise.resolve();
  }
  
  if (event === 'disconnect' && !emitter.connected) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(event, handler);
      reject(new Error(`Timeout waiting for ${event} event after ${timeout}ms`));
    }, timeout);
    
    function handler(...args) {
      clearTimeout(timer);
      emitter.off(event, handler);
      resolve(args.length > 1 ? args : args[0]);
    }
    
    emitter.on(event, handler);
  });
}
```

### Cleanup

Always follow this pattern for cleanup:

```javascript
// Disconnect clients first
for (const client of clients) {
  try {
    if (client.connected) {
      client.disconnect();
    }
    client.removeAllListeners();
  } catch (e) { console.warn('Error cleaning up client:', e); }
}

// Then clean up server resources
if (io) {
  try {
    io.disconnectSockets(true);
    io.close();
  } catch (e) { console.warn('Error closing Socket.IO:', e); }
}

if (httpServer && httpServer.listening) {
  try {
    await new Promise(resolve => httpServer.close(resolve));
  } catch (e) { console.warn('Error closing HTTP server:', e); }
}
```

## Testing Reconnection

### Manual Reconnection Approach

For testing reconnection scenarios, use manual control:

1. Create and connect a client
2. Verify initial connection with ping-pong
3. Stop the server
4. Wait for client to detect disconnect
5. Restart server on the same port
6. Manually reconnect the client
7. Verify connection re-established with ping-pong

```javascript
// Create client with reconnection disabled
const client = io(`http://localhost:${port}`, { reconnection: false });

// Connect and verify
await waitForEvent(client, 'connect');
expect(client.connected).toBe(true);

// Stop server
io.close();
await new Promise(resolve => httpServer.close(resolve));

// Wait for disconnect
await waitForEvent(client, 'disconnect');
expect(client.connected).toBe(false);

// Restart server
httpServer = createServer();
io = new Server(httpServer);
await new Promise(resolve => httpServer.listen(port, resolve));

// Manually reconnect
client.connect();
await waitForEvent(client, 'connect');
expect(client.connected).toBe(true);
```

### Event Simulation Approach

For complex scenarios, simulate reconnection events instead of actual network disconnections:

```javascript
// Test recovery after reconnection without actual disconnection
it('should recover after reconnection event', async () => {
  const client = env.createClient();
  await env.connectClient(client);
  
  // Store some data
  client.emit('save-data', { id: 1, value: 'test' });
  await waitForEvent(client, 'data-saved');
  
  // Simulate reconnection (emit events without actual disconnect)
  client.emit('request-reconnection-simulation');
  
  // Wait for reconnection complete event
  await waitForEvent(client, 'reconnection-simulation-complete');
  
  // Verify data still accessible
  client.emit('get-data', { id: 1 });
  const data = await waitForEvent(client, 'data-retrieved');
  expect(data.value).toBe('test');
});
```

## Timeout Handling

### Recommended Timeouts

- **Connection operations**: 3000-5000ms
- **Disconnect detection**: 2000-3000ms
- **Event waiting**: 1000-2000ms
- **Ping-pong verification**: 1000ms
- **Server startup**: 1000ms

### Implementing Delay

Add small delays to allow events to propagate:

```javascript
// After server operations
console.log('Waiting for event propagation');
await new Promise(resolve => setTimeout(resolve, 200));
```

## Logging & Debugging

### Event Tracing

Implement detailed event logging:

```javascript
// Debug all common events
client.on('connect', () => console.log(`Client connected: ${client.id}`));
client.on('disconnect', reason => console.log(`Client disconnected: ${reason}`));
client.on('connect_error', err => console.log(`Connect error: ${err.message}`));
client.on('reconnect_attempt', attempt => console.log(`Reconnect attempt #${attempt}`));
```

### Status Reporting

Log detailed status at key points:

```javascript
console.log(`Client state before reconnect: connected=${client.connected}, id=${client.id}`);
console.log(`Server state: listening=${httpServer.listening}, clients=${Object.keys(io.sockets.sockets).length}`);
```

### Structured Logging

Use prefixes for easier log filtering:

```javascript
console.log(`🔄 TEST: Starting reconnection sequence`);
console.log(`🔄 SERVER: Closing connection`);
console.log(`🔄 CLIENT: Disconnected, reason=${reason}`);
```

## Common Pitfalls

1. **Relying on automatic reconnection**: Socket.IO's automatic reconnection is difficult to test reliably. Use manual reconnection instead.

2. **Missing cleanup in failure cases**: Always use try/catch/finally to ensure cleanup even when tests fail.

3. **Insufficient timeouts**: Use longer timeouts for network operations (3000-5000ms).

4. **Port conflicts**: Always use dynamic port allocation.

5. **Insufficient event logging**: Add comprehensive logging for all events to diagnose issues.

6. **Not checking current state**: Check current connection state before waiting for events.

7. **Incomplete listener removal**: Always call removeAllListeners() during cleanup.

## Reference Implementations

Refer to these example implementations:

1. **socketio-test-environment.js**: Reusable test environment class
2. **simplified-reconnect.vitest.js**: Self-contained reconnection test
3. **manual-reconnect.vitest.js**: Basic manual reconnection test
4. **reconnection-simulator-standalone.vitest.js**: Advanced reconnection testing

## Final Recommendations

1. **Start simple**: Begin with basic connectivity tests
2. **Test incremental behaviors**: Add complexity gradually
3. **Test individual operations**: Separate connect/disconnect/reconnect tests
4. **Use self-contained tests**: Prefer complete isolation for complex scenarios
5. **Log extensively**: Use detailed logging at each step
6. **Control every step**: Don't rely on automatic behaviors
7. **Handle edge cases**: Check state before and after operations
8. **Implement delays**: Add small delays for event propagation
9. **Use appropriate timeouts**: Longer for network ops, shorter for simple events