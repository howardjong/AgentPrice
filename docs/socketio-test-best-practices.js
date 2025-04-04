/**
 * Socket.IO Testing Best Practices
 * 
 * This document outlines recommended patterns and practices for testing Socket.IO applications
 * to ensure reliable, deterministic tests that avoid common issues like resource leaks,
 * race conditions, and test timeouts.
 */

/**
 * Top 10 Socket.IO Testing Best Practices
 * 
 * 1. Explicit Resource Cleanup
 *    - Always disconnect all sockets in afterEach/afterAll
 *    - Call removeAllListeners() to prevent memory leaks
 *    - Close Socket.IO and HTTP servers in afterAll
 * 
 * 2. Use Dedicated Test Ports
 *    - Use different ports for different test files
 *    - Avoid port conflicts with the main application
 * 
 * 3. Shorter Timeouts for Socket.IO Tests
 *    - Use shorter timeouts (2000ms instead of 5000ms)
 *    - Fail fast to identify socket issues quickly
 * 
 * 4. Event-Driven Test Patterns
 *    - Wait for specific events rather than arbitrary timeouts
 *    - Use promise-based waitForEvent helpers instead of setTimeout
 * 
 * 5. Isolate Tests from Each Other
 *    - Clean state between tests
 *    - Use new socket connections for each test
 *    - Reset event listeners between tests
 * 
 * 6. Debug Mode Activation
 *    - Use DEBUG=socket.io* environment variable
 *    - Run problematic tests individually with verbose logging
 * 
 * 7. Run Socket.IO Tests in Sequence
 *    - Avoid parallel test execution
 *    - Use --runInBand or similar options
 * 
 * 8. Mock External Dependencies
 *    - Isolate Socket.IO behavior from external services
 *    - Use in-memory adapters for Socket.IO
 * 
 * 9. Set Up Timeout Safety Mechanisms
 *    - Always set timeouts for asynchronous operations
 *    - Use promise race patterns for timeout safety
 * 
 * 10. Testing Socket.IO Middleware
 *     - Test both success and failure paths in middleware
 *     - Check error handling for auth failures
 */

/**
 * Common Socket.IO Testing Pitfalls
 * 
 * 1. Event Listener Leaks
 *    Socket.IO event listeners can accumulate across tests if not explicitly
 *    removed, causing unexpected behaviors as test suites grow.
 * 
 *    Solution: Always call removeAllListeners() in afterEach.
 * 
 * 2. Port Conflicts
 *    Tests can conflict with each other or with the running application.
 * 
 *    Solution: Use dedicated ports for tests, with unique ports for each test file.
 * 
 * 3. Zombie Connections
 *    Connections that aren't properly closed can persist and interfere with later tests.
 * 
 *    Solution: Always disconnect clients and close servers, verify disconnection.
 * 
 * 4. Race Conditions in Tests
 *    Waiting for fixed timeouts is unreliable and dependent on system load.
 * 
 *    Solution: Use event-based waiting patterns instead of setTimeout.
 * 
 * 5. Timeout Values Too Long
 *    Default timeouts (e.g., 5000ms) can slow down test failures.
 * 
 *    Solution: Use shorter timeouts (1000-2000ms) for faster failure detection.
 * 
 * 6. Running Tests in Parallel
 *    Socket.IO tests running in parallel can cause flaky results.
 * 
 *    Solution: Run Socket.IO tests sequentially.
 * 
 * 7. Middleware Authentication Testing
 *    Not testing both success and failure scenarios.
 *  
 *    Solution: Explicitly test auth failures and successful auth flows.
 * 
 * 8. Inadequate Error Logging
 *    Socket.IO errors can be silent without proper logging.
 * 
 *    Solution: Add error event listeners to all socket instances during tests.
 * 
 * 9. Namespace Conflicts
 *    Reusing the same namespace across tests without cleanup.
 * 
 *    Solution: Use unique namespaces per test or clean up namespace handlers.
 * 
 * 10. Room Cleanup Failures
 *     Not cleaning up room memberships between tests.
 * 
 *     Solution: Explicitly leave all rooms or disconnect sockets between tests.
 */

/**
 * Example: Event Tracker Utility for Socket.IO Tests
 * 
 * This is a reusable utility that tracks socket events and provides 
 * methods to wait for specific events or event counts.
 */
class EventTracker {
  constructor() {
    this.events = [];
    this.listening = false;
  }

  trackEvent(eventName, data) {
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

  async waitForEvent(eventName, timeoutMs = 2000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.events.some(e => e.eventName === eventName)) {
        return this.getLastEvent(eventName);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error(`Timeout waiting for event: ${eventName}`);
  }

  async waitForEventCount(eventName, count, timeoutMs = 2000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const currentCount = this.events.filter(e => e.eventName === eventName).length;
      if (currentCount >= count) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error(`Timeout waiting for ${count} occurrences of event: ${eventName}`);
  }
}

/**
 * Example: Timeout Wrapper Utility
 * 
 * This utility can be used to add timeout safety to any asynchronous operation
 * to prevent tests from hanging indefinitely.
 */
async function withTimeout(promise, timeoutMs = 2000, message = 'Operation timed out') {
  let timeoutId;
  
  // Create a timeout promise that rejects after timeoutMs
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  
  try {
    // Race the original promise against the timeout
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    // Clear the timeout to prevent memory leaks
    clearTimeout(timeoutId);
  }
}

/**
 * Example: Socket.IO Test Setup Template
 */
function socketIoTestTemplate() {
  // This is a template, not actual runnable code
  
  // Imports
  // import { Server as SocketIOServer } from 'socket.io';
  // import { io as ioc } from 'socket.io-client';
  // import { createServer } from 'http';
  
  // Constants
  const PORT = 9999;
  const SOCKET_URL = `http://localhost:${PORT}`;
  
  // Socket options
  const SOCKET_OPTIONS = {
    reconnectionDelay: 100,
    reconnectionAttempts: 3,
    forceNew: true,
    transports: ['websocket']
  };
  
  // Tests
  describe('Socket.IO Test Suite', () => {
    let httpServer;
    let socketServer;
    let clientSocket;
    
    beforeAll(async () => {
      // Create HTTP server
      httpServer = createServer();
      
      // Create Socket.IO server
      socketServer = new SocketIOServer(httpServer);
      
      // Start the server
      await new Promise(resolve => {
        httpServer.listen(PORT, resolve);
      });
    });
    
    afterEach(() => {
      // Disconnect client socket
      if (clientSocket && clientSocket.connected) {
        clientSocket.removeAllListeners();
        clientSocket.disconnect();
      }
    });
    
    afterAll(async () => {
      // Close servers
      await new Promise(resolve => {
        if (socketServer) {
          socketServer.close(() => {
            httpServer.close(resolve);
          });
        } else {
          resolve();
        }
      });
    });
    
    it('should connect to server', async () => {
      // Connect to server
      clientSocket = ioc(SOCKET_URL, SOCKET_OPTIONS);
      
      // Wait for connection
      await withTimeout(
        new Promise(resolve => clientSocket.on('connect', resolve)),
        2000,
        'Timeout connecting to Socket.IO server'
      );
      
      // Verify connection
      expect(clientSocket.connected).toBe(true);
    });
    
    // Additional tests...
  });
}

/**
 * Recommendations for CI/CD Pipeline Configuration
 * 
 * 1. Run Socket.IO tests in isolation from other tests
 *    - Create a separate test job for Socket.IO tests
 *    - Ensures dedicated resources and minimizes interference
 * 
 * 2. Add additional timeouts for CI environments
 *    - CI environments may be slower than local development
 *    - Increase timeouts slightly (e.g., 3000ms instead of 2000ms)
 * 
 * 3. Enable verbose logging in CI
 *    - Set DEBUG=socket.io* for all Socket.IO test runs in CI
 *    - Helps diagnose intermittent failures
 * 
 * 4. Implement retry mechanism for flaky tests
 *    - Allow Socket.IO tests to retry 1-2 times before failing
 *    - Helps with network-related flakiness
 * 
 * 5. Capture and store test logs
 *    - Save Socket.IO test logs as artifacts
 *    - Critical for debugging CI failures
 */

module.exports = {
  // Export these as examples for use in tests
  EventTracker,
  withTimeout
};