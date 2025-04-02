/**
 * Socket.IO Reconnection Test
 * 
 * This test demonstrates reliable patterns for testing Socket.IO reconnection,
 * using the SocketTestEnvironment class to manage the testing lifecycle.
 * 
 * Key strategies:
 * 1. Explicit cleanup of resources between tests
 * 2. Event-driven approach to connection management
 * 3. Real server and client instances with clean isolation
 * 4. Manual verification via ping/pong messages
 */

const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Test environment will be initialized in beforeEach
let testEnv;

describe('Socket.IO Reconnection', () => {
  // Set up a fresh test environment before each test
  beforeEach(async () => {
    // Get the test environment (setup in vitest.setup.js)
    testEnv = await global.setupSocketTestEnvironment();
    
    // Start the server
    await testEnv.start({
      pingTimeout: 500,  // Use shorter timeouts for faster tests
      pingInterval: 500,
    });
  });
  
  // Ensure cleanup after each test
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    await testEnv.stop();
  });
  
  it('should reconnect automatically after server restart', async () => {
    // Create client with reconnection enabled
    const client = await testEnv.createClient({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 300,
    });
    
    // Verify initial connection
    expect(client.connected).toBe(true);
    
    // Track connection events
    const connectEvents = [];
    client.on('connect', () => {
      connectEvents.push({ time: Date.now(), type: 'connect' });
    });
    
    client.on('disconnect', (reason) => {
      connectEvents.push({ time: Date.now(), type: 'disconnect', reason });
    });
    
    client.on('reconnect_attempt', (attempt) => {
      connectEvents.push({ time: Date.now(), type: 'reconnect_attempt', attempt });
    });
    
    client.on('reconnect', (attempt) => {
      connectEvents.push({ time: Date.now(), type: 'reconnect', attempt });
    });
    
    // Stop and restart the server to force disconnection
    await testEnv.stop();
    
    // Wait for the client to detect disconnection
    await delay(300);
    
    // Restart the server
    await testEnv.start();
    
    // Give time for reconnection to occur
    await delay(1500);
    
    // Verify reconnection worked
    const reconnectEvents = connectEvents.filter(e => e.type === 'reconnect');
    expect(reconnectEvents.length).toBeGreaterThan(0);
    
    // Verify client is connected
    expect(client.connected).toBe(true);
    
    // Verify connection with a ping/pong exchange
    let pongReceived = false;
    client.once('pong-test', () => {
      pongReceived = true;
    });
    
    client.emit('ping-test');
    
    // Wait for pong response
    await delay(500);
    expect(pongReceived).toBe(true);
    
    // Cleanup
    await testEnv.disconnectClient(client);
  });
  
  it('should handle explicit disconnect and reconnect', async () => {
    // Create client
    const client = await testEnv.createClient();
    
    // Verify initial connection
    expect(client.connected).toBe(true);
    
    // Disconnect the client
    await testEnv.disconnectClient(client);
    
    // Verify disconnection
    expect(client.connected).toBe(false);
    
    // Create a new client connection
    const newClient = await testEnv.createClient();
    
    // Verify new connection
    expect(newClient.connected).toBe(true);
    
    // Test actual message exchange
    let messageReceived = false;
    
    // Set up an event handler on the server
    testEnv.io.on('connection', (socket) => {
      socket.on('test-message', (data) => {
        socket.emit('test-response', { received: data, timestamp: Date.now() });
      });
    });
    
    // Set up the client handler
    newClient.on('test-response', () => {
      messageReceived = true;
    });
    
    // Send a test message
    newClient.emit('test-message', { text: 'hello', timestamp: Date.now() });
    
    // Wait for response
    await delay(500);
    
    // Verify communication worked
    expect(messageReceived).toBe(true);
    
    // Cleanup
    await testEnv.disconnectClient(newClient);
  });
  
  it('should not reconnect when reconnection is disabled', async () => {
    // Create client with reconnection disabled
    const client = await testEnv.createClient({
      reconnection: false,
    });
    
    // Verify initial connection
    expect(client.connected).toBe(true);
    
    // Track disconnects
    let disconnectCalled = false;
    client.once('disconnect', () => {
      disconnectCalled = true;
    });
    
    // Stop the server to force disconnection
    await testEnv.stop();
    
    // Wait for disconnect detection
    await delay(300);
    
    // Verify disconnect was detected
    expect(disconnectCalled).toBe(true);
    expect(client.connected).toBe(false);
    
    // Restart the server
    await testEnv.start();
    
    // Wait to see if it reconnects
    await delay(1000);
    
    // Verify client did not reconnect
    expect(client.connected).toBe(false);
  });
});