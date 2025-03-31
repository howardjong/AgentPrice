# Socket.IO Testing Best Practices

This document outlines best practices for writing reliable Socket.IO tests without timeout issues.

## Common Issues

Socket.IO tests often run into specific problems:

1. **Timeout issues**: Tests hang and time out, especially with reconnection tests
2. **Resource leaks**: Socket connections not properly closed, leading to accumulating resources
3. **Event race conditions**: Test completes before all events are processed
4. **Cleanup failures**: Server or socket instances not properly shut down

## Best Practices

### 1. Use Small Timeouts

Always use small timeouts for Socket.IO options:

```javascript
const io = new Server(httpServer, {
  pingTimeout: 100,       // Default is 20000 (too long for tests)
  pingInterval: 50,       // Default is 25000 (too long for tests)  
  connectTimeout: 200,    // Default is 45000 (too long for tests)
  transports: ['websocket'] // Skip polling to make tests faster
});
```

### 2. Proper Resource Cleanup

Clean up in correct order and use force disconnection:

```javascript
afterEach(async () => {
  // 1. Disconnect clients first
  if (client && client.connected) {
    client.disconnect();
  }
  
  // 2. Force disconnect all server sockets
  if (io) {
    io.disconnectSockets(true);
  }
  
  // 3. Close the server with timeout
  if (server) {
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Server close timed out, forcing exit');
        resolve();
      }, 100);
      
      server.close(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  
  // 4. Explicitly close the Socket.IO instance
  if (io) {
    try {
      io.close();
    } catch (e) {
      console.error('Error closing Socket.IO:', e);
    }
  }
});
```

### 3. Wait For Events Using Promises

Always wrap event listening in promises with timeouts:

```javascript
// Wait for a specific event
function waitForEvent(client, event, timeoutMs = 300) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(event);
      reject(new Error(`Timeout waiting for ${event} event`));
    }, timeoutMs);
    
    client.once(event, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

// Example usage:
const response = await waitForEvent(client, 'custom_response', 300);
```

### 4. Track Client Instances

Keep track of all client instances to ensure complete cleanup:

```javascript
const clients = new Set();

function createClient() {
  const client = ioc(`http://localhost:${port}`, {
    transports: ['websocket'],
    timeout: 100
  });
  clients.add(client);
  return client;
}

afterEach(() => {
  // Disconnect all clients
  for (const client of clients) {
    if (client.connected) {
      client.disconnect();
    }
  }
  clients.clear();
});
```

### 5. Avoid Complex Reconnection Tests

Our testing has found that reconnection tests are particularly prone to issues in automated test environments. We recommend:

1. **Avoid reconnection tests in CI/CD**: These tests are very environment-sensitive and prone to timeouts
2. **Test disconnection separately**: Test client-side and server-side disconnect handling separately
3. **Use simple event assertions**: Instead of testing actual reconnection, verify that reconnection events fire as expected
4. **Triggered disconnect**: Instead of shutting down the server, use `socket.disconnect(true)` 
5. **Socket events**: Test socket reconnect events directly rather than creating complex scenarios
6. **Consider manual testing**: For comprehensive reconnection scenarios, use manual testing or specialized test environments
7. **Simulate events**: In some cases, it's better to simulate reconnection events than to test actual network reconnection

After extensive testing, we've found that websocket reconnection tests are fundamentally difficult to make reliable in automated test environments due to timing issues, socket cleanup, and state management challenges. Focus on testing the application's ability to handle reconnection events rather than the actual reconnection mechanism.

### 6. Test Structure

Follow this structure for reliable tests:

```javascript
describe('Socket.IO Feature', () => {
  // 1. Declare state variables
  let server, io, port, client;
  
  // 2. Setup fresh environment for each test
  beforeEach(() => {
    // Create server, io, etc.
  });
  
  // 3. Clean up ALL resources
  afterEach(async () => {
    // Properly clean up everything
  });
  
  // 4. Keep tests focused and small
  it('should perform a specific action', async () => {
    // Setup
    io.on('connection', (socket) => {
      // Simple handlers
    });
    
    // Execute with promise-based waiting
    client = createClient();
    await waitForConnection(client);
    
    // Verify with assertions
    expect(client.connected).toBe(true);
  });
});
```

### 7. Handling Authentication

For authentication tests:

```javascript
it('should authenticate properly', async () => {
  // Add middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token !== 'valid-token') {
      return next(new Error('Invalid token'));
    }
    next();
  });
  
  // Try with invalid token (should fail)
  const invalidClient = createClient({ auth: { token: 'invalid' } });
  
  // Use try/catch to handle expected errors
  try {
    await waitForConnection(invalidClient, 300);
    // Should not reach here
    expect(false).toBe(true); 
  } catch (error) {
    expect(error.message).toContain('Invalid token');
  } finally {
    // Always clean up!
    invalidClient.disconnect();
  }
  
  // Try with valid token (should succeed)
  const validClient = createClient({ auth: { token: 'valid-token' } });
  await waitForConnection(validClient, 300);
  expect(validClient.connected).toBe(true);
  validClient.disconnect();
});
```

## Real-world Examples

See the following example files:

1. `tests/unit/websocket/basic-socketio.vitest.js` - Basic Socket.IO test pattern
2. `tests/unit/websocket/ultra-minimal-socketio.vitest.js` - Minimal working example
3. `tests/unit/websocket/socketio-test-utilities.js` - Utility functions
4. `tests/unit/websocket/simplified-reconnect.vitest.js` - Disconnect test example (note: this test may time out in some environments)

For more reliable testing, focus on these patterns:

### Event-based testing
```javascript
// Instead of testing actual reconnection:
client.on('reconnect_attempt', (attempt) => {
  // Assert that reconnection is being attempted
  expect(attempt).toBeGreaterThan(0);
  done();
});
```

### Event simulation
```javascript
// Instead of real network disconnect, simulate events:
// 1. Listen for the event
client.on('disconnect', (reason) => {
  expect(reason).toBe('io server disconnect');
  
  // 2. Verify application handles the event correctly
  expect(client.connected).toBe(false);
  expect(appState.isConnected).toBe(false);
  
  done();
});

// 3. Manually emit the event instead of actual disconnect
client.io.engine.emit('close');
```

## Debugging Timeout Issues

If you're experiencing timeout issues:

1. **Check cleanup**: Make sure all clients and servers are being cleaned up properly
2. **Reduce timeouts**: Try even smaller timeouts (50-100ms)
3. **Simplify tests**: Break complex tests into smaller, focused tests
4. **Add logging**: Add console logs for connection, disconnection, and cleanup events
5. **Use try/finally**: Ensure cleanup runs even when tests fail

## Final Notes

- Always prefer simple tests over complex scenarios
- Test individual units of functionality rather than complex integrations
- Never rely on global Socket.IO instances for multiple tests
- Always clean up resources, even when tests fail
- Reconnection testing is fundamentally challenging in automated test environments
- Consider event-based testing rather than actual network disconnection testing
- Focus on testing that your application correctly handles socket events
- Complex Socket.IO functionality may require manual verification outside automated tests

## Advanced Troubleshooting

If you continue to experience issues with Socket.IO tests despite following these best practices, consider:

1. **Mocking the Socket.IO layer**: Instead of using real Socket.IO connections, mock the Socket.IO interface
2. **Event simulation**: Test the application's response to events rather than triggering real network conditions 
3. **Integration testing**: Test the Socket.IO integration points with your application logic instead of Socket.IO itself
4. **Manual testing**: Use the provided diagnostic tools for verifying complex reconnection scenarios manually
5. **Split responsibility**: Separate network handling code from business logic for easier testing
6. **Environment-specific tests**: Skip or conditionally run problematic tests in CI/CD environments

Remember that WebSocket testing is inherently complex due to its stateful and real-time nature. Focus on testing your application's handling of WebSocket events rather than the WebSocket implementation itself.