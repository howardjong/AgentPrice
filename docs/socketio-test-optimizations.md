# Socket.IO Testing Optimizations for Replit Environment

## Background

Socket.IO tests in the Replit environment encounter specific challenges:
- Timeout issues due to resource constraints
- Reconnection test instability
- Memory leaks from lingering event listeners
- Test hanging from unhandled disconnections

This document outlines the critical optimizations implemented to address these issues.

## Key Optimizations

### 1. Shorter Timeouts

Replit has stricter resource management than local development environments. Standard timeouts (5000ms+) often lead to test failures, while shorter timeouts (1000-2000ms) work reliably.

```javascript
// Before optimization
client = SocketIOClient(`http://localhost:${port}`, {
  timeout: 5000,
  pingTimeout: 5000,
  pingInterval: 3000
});

// After optimization
client = SocketIOClient(`http://localhost:${port}`, {
  timeout: 2000,
  pingTimeout: 1000,
  pingInterval: 500
});
```

### 2. Explicit Event Cleanup

Socket.IO event listeners must be explicitly removed to prevent memory leaks.

```javascript
// Optimized approach with cleanup
function waitForEvent(socket, eventName, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);
    
    function handler(...args) {
      cleanup();
      resolve(args.length > 1 ? args : args[0]);
    }
    
    function cleanup() {
      clearTimeout(timer);
      socket.off(eventName, handler);
      socket.off('error', errorHandler);
    }
    
    function errorHandler(err) {
      cleanup();
      reject(err);
    }
    
    socket.on(eventName, handler);
    socket.once('error', errorHandler);
  });
}
```

### 3. Safe Disconnect Operations

Disconnections must be handled with explicit cleanup and timeout protection:

```javascript
async function safeDisconnect(client) {
  if (!client) return;
  
  // Disable reconnection
  if (client.io?.opts) {
    client.io.opts.reconnection = false;
  }
  
  // Remove all listeners
  client.removeAllListeners();
  
  // Return early if not connected
  if (!client.connected) return;
  
  // Disconnect with timeout protection
  await Promise.race([
    new Promise(resolve => {
      client.once('disconnect', () => resolve());
      client.disconnect();
    }),
    new Promise(resolve => setTimeout(resolve, 300))
  ]);
}
```

### 4. Limited Reconnection Attempts

Limiting reconnection attempts prevents tests from hanging indefinitely:

```javascript
// Before optimization
client.io.opts.reconnectionAttempts = Infinity;

// After optimization
client.io.opts.reconnectionAttempts = 2;
```

## Usage Guidelines

1. **Always use optimized utilities** in Socket.IO tests, especially for reconnection testing
2. **Use shorter timeouts** (1000-2000ms) for all Socket.IO operations in Replit
3. **Run Socket.IO tests individually** with the `it.only` pattern when developing/debugging
4. **Always include cleanup logic** in both success and failure paths
5. **Apply server-side optimizations** with `optimizeSocketServer(io)`

## Implementation

The optimizations are provided through utility functions in `tests/unit/utils/socket-test-optimization.js`:

- `optimizeSocketClient(client)` - Configures client with Replit-friendly settings
- `optimizedWaitForEvent(socket, eventName, timeout)` - Safely waits for events with cleanup
- `safeDisconnect(client)` - Safely disconnects a client with timeout protection
- `createOptimizedReconnectionTest(socket)` - Creates utilities for reconnection testing
- `optimizeSocketServer(io)` - Configures server with Replit-friendly settings

## Example

The file `tests/unit/websocket/optimized-reconnect-test.vitest.js` demonstrates the use of these optimizations.

---

These optimizations are essential for the Socket.IO portion of the Vitest migration to ensure tests run reliably in the Replit environment.