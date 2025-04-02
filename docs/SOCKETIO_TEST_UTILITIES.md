# Socket.IO Test Utilities for Reliable Testing

## Overview

The `socketio-test-utilities.js` module provides robust utilities for testing Socket.IO applications, with special optimizations for the Replit environment. These utilities address common challenges in WebSocket testing, including connection stability, timing issues, and resource management.

## Core Components

### 1. Test Environment Creation

The `createSocketTestEnv` function creates an isolated test environment with a Socket.IO server and configurable options:

```javascript
/**
 * Create a Socket.IO test environment
 * @param {Object} options - Socket.IO server options
 * @returns {Object} Test environment with server and utility functions
 */
function createSocketTestEnv(options = {}) {
  // Default options optimized for Replit environment
  const serverOptions = {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    connectTimeout: options.connectTimeout || 3000,
    pingTimeout: options.pingTimeout || 200,
    pingInterval: options.pingInterval || 150,
    upgradeTimeout: options.upgradeTimeout || 10000,
    maxHttpBufferSize: options.maxHttpBufferSize || 1e6,
    ...options
  };

  // Create HTTP server
  const server = createServer();
  
  // Create Socket.IO server with optimized options
  const io = new Server(server, serverOptions);
  
  // Track active clients for proper cleanup
  const activeClients = new Set();
  
  // Start server on random port
  const port = getAvailablePort();
  const httpServer = server.listen(port);
  const serverUrl = `http://localhost:${port}`;
  
  // Setup heartbeat for connection verification
  const heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, options.heartbeatInterval || 5000);
  
  // Return environment with utilities
  return {
    server,
    io,
    port,
    serverUrl,
    activeClients,
    heartbeatInterval,
    
    // Create client with consistent configuration
    createClient(clientOptions = {}) {
      const client = io(serverUrl, {
        transports: ['websocket', 'polling'], // Enable transport fallback
        reconnectionDelay: clientOptions.reconnectionDelay || 100,
        reconnectionDelayMax: clientOptions.reconnectionDelayMax || 300,
        reconnectionAttempts: clientOptions.reconnectionAttempts || 5,
        timeout: clientOptions.timeout || 2000,
        forceNew: true,
        ...clientOptions
      });
      
      // Track for cleanup
      activeClients.add(client);
      
      return client;
    },
    
    // Comprehensive shutdown to prevent resource leaks
    async shutdown() {
      console.log('Shutdown steps starting...');
      
      // Disconnect all clients
      console.log('Disconnecting clients');
      for (const client of activeClients) {
        try {
          // Stop client heartbeat
          console.log(`Stopped heartbeat for client ${client.id}`);
          
          // Remove all listeners to prevent memory leaks
          client.removeAllListeners();
          console.log(`Removed listeners from client ${client.id}`);
          
          // Disconnect if still connected
          if (client.connected) {
            client.disconnect();
            console.log(`Disconnected client ${client.id}`);
          }
        } catch (error) {
          console.error(`Error cleaning up client: ${error.message}`);
        }
      }
      
      // Clear client tracking
      activeClients.clear();
      console.log('Cleared active clients');
      
      // Clean up server
      try {
        // Disconnect all server sockets
        console.log('Disconnecting server sockets');
        io.disconnectSockets();
        console.log('Disconnected all server sockets');
        
        // Remove all listeners
        io.removeAllListeners();
        console.log('Removed all IO event listeners');
        
        // Close the server
        console.log('Closing server');
        clearInterval(heartbeatInterval);
        
        // Close the actual http server
        await new Promise((resolve) => {
          httpServer.close(() => {
            console.log('Server closed successfully');
            resolve();
          });
        });
        
        // Close Socket.IO
        io.close();
        console.log('Closed IO normally');
      } catch (error) {
        console.error(`Error during server shutdown: ${error.message}`);
      }
      
      console.log('Shutdown steps completed');
    }
  };
}
```

### 2. Connection Utilities

Reliable connection management utilities:

```javascript
/**
 * Wait for socket connection with timeout
 * @param {SocketIOClient.Socket} socket - Socket.IO client
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<void>} Resolves when connected
 */
async function waitForConnect(socket, timeout = 1000) {
  // If already connected, return immediately
  if (socket.connected) {
    return;
  }
  
  // Otherwise wait for connection
  return promiseWithTimeout(timeout, "Connection timeout").resolveWith(
    () => new Promise((resolve) => {
      const handleConnect = () => {
        socket.off('connect', handleConnect);
        resolve();
      };
      
      socket.once('connect', handleConnect);
      
      // Make sure connection attempt is initiated
      if (socket.disconnected) {
        socket.connect();
      }
    })
  );
}

/**
 * Verify a socket connection is actually working by sending a ping
 * @param {SocketIOClient.Socket} socket - Socket.IO client
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<boolean>} True if connection verified
 */
async function verifyConnection(socket, timeout = 1000) {
  if (!socket.connected) return false;
  
  try {
    // Use Socket.IO's internal ping mechanism
    return await promiseWithTimeout(timeout, "Ping timeout").resolveWith(
      () => new Promise((resolve) => {
        const pingStart = Date.now();
        
        socket.io.engine.once('pong', () => {
          const latency = Date.now() - pingStart;
          resolve(true);
        });
        
        socket.io.engine.ping();
      })
    );
  } catch (error) {
    return false;
  }
}
```

### 3. Retry Operation Utility

Robust retry mechanism with exponential backoff:

```javascript
/**
 * Retry a socket operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the operation
 */
async function retrySocketOperation(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 1000,
    factor = 2,
    jitter = 0.1
  } = options;
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt <= maxRetries) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      attempt++;
      
      if (attempt > maxRetries) {
        break;
      }
      
      // Calculate backoff with jitter
      const delay = Math.min(
        maxDelay,
        initialDelay * Math.pow(factor, attempt - 1)
      );
      
      // Add jitter to prevent thundering herd
      const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
      const finalDelay = Math.max(0, delay + jitterAmount);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  throw lastError || new Error(`Operation failed after ${maxRetries} attempts`);
}
```

### 4. Promise Utilities

Enhanced promise utilities for timeouts and event-driven testing:

```javascript
/**
 * Create a promise with timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout error message
 * @returns {Object} Promise wrapper with resolveWith method
 */
function promiseWithTimeout(ms, message = "Operation timed out") {
  let timeoutId;
  
  return {
    resolveWith(promiseFactory) {
      return new Promise(async (resolve, reject) => {
        // Set timeout
        timeoutId = setTimeout(() => {
          reject(new Error(message));
        }, ms);
        
        try {
          // Attempt to resolve the promise
          const result = await promiseFactory();
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    }
  };
}

/**
 * Wait for a specific event from a socket
 * @param {SocketIOClient.Socket} socket - Socket.IO client
 * @param {string} eventName - Event to wait for
 * @param {number} timeout - Optional timeout in ms
 * @returns {Promise<any>} Event data
 */
async function waitForEvent(socket, eventName, timeout) {
  const promise = new Promise((resolve) => {
    socket.once(eventName, (data) => {
      resolve(data);
    });
  });
  
  if (typeof timeout === 'number') {
    return promiseWithTimeout(timeout, `Event ${eventName} timed out`).resolveWith(
      () => promise
    );
  }
  
  return promise;
}
```

### 5. Event Tracking Utility

For comprehensive event monitoring:

```javascript
/**
 * Create an event tracker to monitor multiple events
 * @param {string[]} eventTypes - Event types to track
 * @returns {Object} Event tracker
 */
function createEventTracker(eventTypes = []) {
  const events = {};
  const eventPromises = {};
  
  // Initialize containers for each event type
  eventTypes.forEach(type => {
    events[type] = {};
    eventPromises[type] = {};
  });
  
  return {
    // Add an event to the tracker
    add(type, data) {
      if (!events[type]) {
        events[type] = {};
      }
      
      const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      events[type][id] = data;
      
      // Resolve any pending promises for this event type
      if (eventPromises[type]) {
        Object.values(eventPromises[type]).forEach(({resolve}) => {
          resolve(data);
        });
        eventPromises[type] = {};
      }
      
      return id;
    },
    
    // Get tracked data for an event type
    getData(type) {
      return events[type] || {};
    },
    
    // Wait for specific event types to occur
    async waitForAll(types, timeout = 1000) {
      return promiseWithTimeout(timeout, `Waiting for events ${types.join(', ')} timed out`).resolveWith(
        () => new Promise((resolve) => {
          // Check if we already have all required events
          const missingTypes = types.filter(type => 
            !events[type] || Object.keys(events[type]).length === 0
          );
          
          if (missingTypes.length === 0) {
            // All events already received
            resolve(
              types.reduce((result, type) => {
                result[type] = Object.values(events[type])[0];
                return result;
              }, {})
            );
            return;
          }
          
          // Track this promise for each missing event type
          const promiseId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          
          missingTypes.forEach(type => {
            if (!eventPromises[type]) {
              eventPromises[type] = {};
            }
            eventPromises[type][promiseId] = { resolve };
          });
        })
      );
    },
    
    // Reset tracker state
    reset() {
      eventTypes.forEach(type => {
        events[type] = {};
        eventPromises[type] = {};
      });
    }
  };
}
```

## Usage Best Practices

1. **Proper Environment Setup and Teardown**

```javascript
beforeEach(() => {
  // Create test environment with Replit-optimized settings
  testEnv = createSocketTestEnv({
    pingTimeout: 200,
    pingInterval: 150,
    connectTimeout: 2000
  });
});

afterEach(async () => {
  // Complete shutdown
  if (testEnv) {
    await testEnv.shutdown();
  }
});
```

2. **Resilient Connection Management**

```javascript
// Use retry logic for connection with verification
await retrySocketOperation(
  async () => {
    // Connect the client
    await waitForConnect(client, 2000);
    
    // Verify connection is working
    const isActive = await verifyConnection(client, 2000);
    if (!isActive) {
      throw new Error('Connection verification failed');
    }
    
    return true;
  },
  {
    maxRetries: 5,
    initialDelay: 250,
    maxDelay: 2000
  }
);
```

3. **Event-Driven Testing**

```javascript
// Send a test message
client.emit('send_test_message', { topic: 'test_topic', data: { test: true } });

// Wait for response using event-driven approach
const response = await promiseWithTimeout(300, "No test message response").resolveWith(
  () => waitForEvent(client, 'message')
);

// Verify response
expect(response.type).toBe('test_topic');
```

4. **Explicit Client Cleanup**

```javascript
// Always clean up client regardless of test outcome
try {
  // Test logic here
} catch (error) {
  throw error;
} finally {
  // Clean up client events and connection
  if (client) {
    client.removeAllListeners();
    if (client.connected) {
      client.disconnect();
    }
  }
}
```

## Conclusion

The Socket.IO test utilities provide a robust foundation for testing WebSocket applications in challenging environments like Replit. By addressing common issues like connection instability, timing problems, and resource leaks, these utilities enable more reliable and consistent tests.

For specific implementation details, refer to the `tests/unit/websocket/socketio-test-utilities.js` file in the project.