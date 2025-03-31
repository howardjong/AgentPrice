# Socket.IO Testing Best Practices

## Core Strategy

Our investigations into Socket.IO testing, particularly with reconnection scenarios, have revealed several key challenges and their solutions:

1. **Socket.IO reconnections are inherently unstable in test environments**
2. **Socket connections can leak between tests**
3. **Timeouts are common due to race conditions**

This document outlines the strategies that have proven most effective.

## Recommended Approach

### 1. Use a dedicated test environment

The `SocketTestEnvironment` class provides a complete testing lifecycle:

```javascript
const testEnv = await setupSocketTestEnvironment();
await testEnv.start();

// Create client
const client = await testEnv.createClient();

// Run tests...

// Clean up
await testEnv.stop();
```

### 2. Prioritize explicit control over implicit behavior

- **Manually manage reconnection**: Don't rely on Socket.IO's automatic reconnection in tests
- **Explicitly verify connections**: Use ping/pong exchanges to verify real connection status
- **Cleanup thoroughly**: Close all connections and servers between tests

### 3. Use event-driven waiting

Instead of arbitrary delays, wait for specific events:

```javascript
// Bad - arbitrary timing that may fail intermittently
await delay(500);
expect(client.connected).toBe(true);

// Good - wait for a specific event
await testEnv.waitForEvent(client, 'connect');
expect(client.connected).toBe(true);
```

### 4. Implement robust cleanup

The environment handles:
- Stopping servers
- Disconnecting clients
- Releasing ports
- Clearing event listeners

### 5. Isolate tests completely

- Use `forceNew: true` when creating Socket.IO clients
- Use a new server instance for each test
- Use unique ports via `getPort()`

## Socket.IO Reconnection Strategies

Testing reconnection is particularly challenging. We've found these approaches most effective:

### Approach 1: Server restart with explicit event tracking

```javascript
// Create client with reconnection enabled
const client = await testEnv.createClient({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 300,
});

// Track events for verification
const events = [];
client.on('reconnect_attempt', () => events.push('attempt'));
client.on('reconnect', () => events.push('success'));

// Force disconnection by stopping server
await testEnv.stop();
await delay(300); // Allow disconnect to register
await testEnv.start();

// Wait for reconnection events
await delay(1500);
expect(events).toContain('success');
```

### Approach 2: Manual disconnect and reconnect

```javascript
// Disconnect client explicitly
await testEnv.disconnectClient(client);
expect(client.connected).toBe(false);

// Create a new connection
const newClient = await testEnv.createClient();
expect(newClient.connected).toBe(true);
```

### Approach 3: Test connection with message exchange

```javascript
// Send and receive a message to verify connection
let messageReceived = false;
client.on('pong', () => { messageReceived = true; });
client.emit('ping');

// Wait for response
await testEnv.waitForEvent(client, 'pong');
expect(messageReceived).toBe(true);
```

## Common Pitfalls and Solutions

| Issue | Solution |
|-------|----------|
| Timeouts during reconnection | Use shorter timeouts in tests; explicitly wait for events |
| Unstable connect status | Verify with ping/pong messages, not just `client.connected` |
| Resource leaks | Use the `testEnv.stop()` cleanup method |
| Port conflicts | Use `getPort()` for dynamic port allocation |
| Cross-test interference | Create new environment for each test |

## Implementation Notes

1. Always use the `{ forceNew: true }` option when creating Socket.IO clients to prevent connection sharing

2. Set explicit timeouts for tests with reconnection scenarios:

```javascript
// Set longer timeout for reconnection tests
it('should reconnect after server restart', async () => {
  // Test code here
}, 10000); // Extend timeout to 10 seconds
```

3. Always run Socket.IO tests sequentially, not in parallel, to avoid port conflicts and race conditions

## Recommended Test Structure

```javascript
describe('Socket.IO Feature', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await setupSocketTestEnvironment();
    await testEnv.start();
  });

  afterEach(async () => {
    await testEnv.stop();
  });

  it('should test basic functionality', async () => {
    const client = await testEnv.createClient();
    // Test code...
  });
});
```