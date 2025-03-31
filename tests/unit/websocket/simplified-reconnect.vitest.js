/**
 * Ultra-Simplified Socket.IO Disconnect Test
 * 
 * This test focuses on verifying the most basic disconnect/reconnect functionality
 * with minimal complexity to demonstrate reliable testing patterns.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createSocketTestEnv, waitForEvent, waitForConnect } from './socketio-test-utilities';

describe('Socket.IO Disconnect', () => {
  // Test environment state
  let testEnv;
  
  // Clean up after each test to prevent memory leaks
  afterEach(async () => {
    // Use the utility's cleanup method to ensure proper teardown
    if (testEnv) {
      await testEnv.shutdown();
    }
  });
  
  it('should handle server-forced disconnects', async () => {
    // Create a test environment with proper resource tracking
    testEnv = createSocketTestEnv({
      pingTimeout: 100,
      pingInterval: 50,
      connectTimeout: 200
    });
    
    // Setup server handlers
    testEnv.io.on('connection', (socket) => {
      socket.emit('welcome', { message: 'Connected' });
      
      socket.on('disconnect_me', () => {
        socket.disconnect(true);
      });
    });
    
    // Create client with reconnection disabled for simpler test
    const client = testEnv.createClient({
      reconnection: false // Explicitly disable reconnection
    });
    
    // Track events
    const events = [];
    client.on('connect', () => events.push('connect'));
    client.on('disconnect', (reason) => events.push(`disconnect:${reason}`));
    client.on('welcome', () => events.push('welcome'));
    
    // Wait for initial connection
    await waitForConnect(client, 300);
    
    // Wait for welcome message
    await waitForEvent(client, 'welcome', 300);
    
    // Verify connection status before disconnect
    expect(client.connected).toBe(true);
    expect(events).toContain('connect');
    expect(events).toContain('welcome');
    
    // Set up disconnect promise
    const disconnectPromise = waitForEvent(client, 'disconnect', 300);
    
    // Request server to disconnect this client
    client.emit('disconnect_me');
    
    // Wait for disconnect event
    const disconnectReason = await disconnectPromise;
    
    // Verify client is disconnected
    expect(client.connected).toBe(false);
    expect(events.some(e => e.startsWith('disconnect:'))).toBe(true);
  });
});