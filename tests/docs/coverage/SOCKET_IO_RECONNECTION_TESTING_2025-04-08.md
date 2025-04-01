# Socket.IO Reconnection Testing Guide
**Date: April 8, 2025**

## Overview

Socket.IO reconnection testing has historically been challenging due to its asynchronous nature, timing variability, and complex state transitions. This document outlines our approach to creating reliable and maintainable Socket.IO reconnection tests using an event-driven pattern.

## Challenges in Socket.IO Reconnection Testing

1. **Timing Unpredictability**: Network events have inherent timing variability
2. **Race Conditions**: Disconnect/reconnect events may overlap or occur in unexpected order
3. **State Management Complexity**: Tracking connection states across server restarts
4. **Resource Cleanup**: Ensuring proper cleanup to prevent cross-test interference
5. **Error Diagnosis**: Understanding why tests fail due to limited visibility into event sequence

## Event-Driven Testing Solution

Our event-driven approach addresses these challenges by:

1. Using explicit promises for event waiting
2. Tracking all events for diagnostic purposes
3. Verifying connections through message exchange
4. Implementing comprehensive cleanup
5. Providing detailed connection history

## Core Reconnection Test Pattern

The basic pattern for testing reconnection involves:

```javascript
// 1. Start the server
const server = createAndStartServer();

// 2. Connect client with reconnection enabled
const client = createClientWithReconnection();

// 3. Wait for initial connection
await waitForEvent(client, 'connect');

// 4. Verify connection through message exchange
const initialResponseData = await sendTestMessageAndWaitForResponse(client);

// 5. Stop the server
await stopServer(server);

// 6. Verify disconnection
await waitForEvent(client, 'disconnect');

// 7. Start a new server on the same port
const newServer = createAndStartServer();

// 8. Wait for automatic reconnection
await waitForEvent(client, 'connect');

// 9. Verify reconnection through message exchange
const reconnectResponseData = await sendTestMessageAndWaitForResponse(client);

// 10. Verify different server instance by comparing IDs
expect(reconnectResponseData.serverId).not.toBe(initialResponseData.serverId);
```

## Utility Functions

### Promise-Based Event Waiting

```javascript
function waitForEvent(emitter, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    // Handle special cases like already connected/disconnected
    if (eventName === 'connect' && emitter.connected) {
      resolve();
      return;
    }
    if (eventName === 'disconnect' && !emitter.connected) {
      resolve('already-disconnected');
      return;
    }
    
    // Set timeout to avoid hanging
    const timer = setTimeout(() => {
      emitter.off(eventName, handler);
      reject(new Error(`Timeout waiting for ${eventName} after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Event handler
    function handler(...args) {
      clearTimeout(timer);
      emitter.off(eventName, handler);
      resolve(args.length > 1 ? args : args[0]);
    }
    
    emitter.on(eventName, handler);
  });
}
```

### Event Logging

```javascript
function logEvent(type, data = {}) {
  const entry = { type, time: Date.now(), ...data };
  events.push(entry);
  console.log(`Event ${events.length}: ${type}:`, JSON.stringify(data));
}

// Use for all significant events
client.on('connect', () => logEvent('client-connect', { id: client.id }));
client.on('disconnect', (reason) => logEvent('client-disconnect', { reason }));
```

### Message Exchange Verification

```javascript
async function sendTestMessageAndWaitForResponse(client, testData = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 2000);
    
    // Setup one-time response handler
    const messageHandler = (data) => {
      if (data.type === 'test-response' && 
          data.original.id === testData.id) {
        clearTimeout(timer);
        client.off('message', messageHandler);
        resolve(data);
      }
    };
    
    client.on('message', messageHandler);
    
    // Send test message
    client.emit('test-message', {
      id: Date.now().toString(),
      timestamp: Date.now(),
      ...testData
    });
  });
}
```

### Cleanup

```javascript
function cleanup(client, server, httpServer) {
  // Always use try/catch for each operation
  if (client) {
    try {
      client.disconnect();
      client.removeAllListeners();
    } catch (e) {
      console.error('Error cleaning up client:', e);
    }
  }
  
  if (server) {
    try {
      server.close();
    } catch (e) {
      console.error('Error closing server:', e);
    }
  }
  
  if (httpServer && httpServer.listening) {
    try {
      return new Promise(resolve => httpServer.close(resolve));
    } catch (e) {
      console.error('Error closing httpServer:', e);
    }
  }
}
```

## Recommended Server Setup

```javascript
function createAndStartServer(port) {
  const httpServer = createServer();
  const io = new Server(httpServer);
  
  // Setup message handlers
  io.on('connection', socket => {
    logEvent('server-connection', { id: socket.id });
    
    socket.on('test-message', data => {
      logEvent('server-test-message', { data });
      
      socket.emit('message', {
        type: 'test-response',
        original: data,
        serverId: serverInstanceId,
        timestamp: Date.now()
      });
    });
  });
  
  // Start server and return components
  return new Promise(resolve => {
    httpServer.listen(port, () => {
      resolve({ httpServer, io, port });
    });
  });
}
```

## Recommended Client Setup

```javascript
function createClientWithReconnection(port) {
  const client = SocketIOClient(`http://localhost:${port}`, {
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 100,
    timeout: 2000
  });
  
  // Setup basic event handlers for logging
  client.on('connect', () => logEvent('client-connect', { id: client.id }));
  client.on('disconnect', reason => logEvent('client-disconnect', { reason }));
  client.on('error', err => logEvent('client-error', { message: err.message }));
  client.on('connect_error', err => logEvent('client-connect-error', { message: err.message }));
  
  // General message handler
  client.on('message', data => {
    logEvent('client-message', { data });
  });
  
  return client;
}
```

## Handling Edge Cases

### Already Connected/Disconnected States

```javascript
if (eventName === 'connect' && emitter.connected) {
  resolve();
  return;
}

if (eventName === 'disconnect' && !emitter.connected) {
  resolve('already-disconnected');
  return;
}
```

### Multiple Reconnection Attempts

```javascript
// Track reconnection attempts
let reconnectCount = 0;
client.on('reconnect_attempt', (attemptNumber) => {
  logEvent('reconnect-attempt', { attemptNumber });
  reconnectCount++;
});

// Verify expected number of attempts
expect(reconnectCount).toBeGreaterThanOrEqual(expectedMinAttempts);
```

### Different Transport Types

```javascript
// Test with a specific transport
const client = SocketIOClient(`http://localhost:${port}`, {
  transports: ['websocket']  // or ['polling']
});

// Verify transport used
expect(client.io.engine.transport.name).toBe('websocket');
```

## Best Practices

1. **Always use promise-based event waiting** instead of arbitrary timeouts
2. **Track and log all significant events** for better diagnostics
3. **Verify connections through message exchange**, not just checking connected status
4. **Implement comprehensive cleanup** in finally blocks
5. **Handle edge cases explicitly** like already connected/disconnected states
6. **Use message typing** to verify specific message types and content
7. **Verify server instance identity** by comparing socket IDs or server signatures
8. **Keep tests focused and minimal** - test one aspect of reconnection per test
9. **Use semantic test names** that describe the specific reconnection scenario
10. **Structure tests in logical phases**: setup, connect, verify, disconnect, reconnect, verify, cleanup

## Example Tests

For complete working examples, see:
- [event-driven-reconnect-reliable.vitest.js](../../unit/websocket/event-driven-reconnect-reliable.vitest.js)
- [event-driven-reconnect-minimal.vitest.js](../../unit/websocket/event-driven-reconnect-minimal.vitest.js)

## Common Pitfalls

1. **Arbitrary Timeouts**: Avoid `setTimeout` for waiting; use event-based promises
2. **Missing Cleanup**: Always clean up resources in finally blocks
3. **Insufficient Diagnostics**: Track all events for debugging failures
4. **Simplistic Verification**: Verify through message exchange, not just connection status
5. **Ignoring Edge Cases**: Handle already connected/disconnected states
6. **Incomplete Error Handling**: Catch and log all errors during cleanup
7. **Tight Timing Assumptions**: Don't assume specific timing for network events
8. **Overcomplex Tests**: Focus each test on one specific aspect of reconnection

## Conclusion

By adopting an event-driven approach to Socket.IO reconnection testing, we create more reliable, maintainable, and readable tests. This approach directly aligns with Socket.IO's own event-driven nature and provides better diagnostics when issues occur.