/**
 * Manual Reconnection Test
 * 
 * This test focuses solely on manual reconnection after server restart,
 * without relying on Socket.IO's automatic reconnection mechanism.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SocketTestEnvironment, waitForEvent } from './socketio-test-environment';

describe('Socket.IO Manual Reconnection Test', () => {
  let env;
  
  // Set up a fresh test environment before each test
  beforeEach(async () => {
    env = new SocketTestEnvironment();
    await env.setup();
  });
  
  // Clean up after each test
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    try {
      await env.teardown();
    } catch (err) {
      console.error('Error during teardown:', err);
    }
  });
  
  it('should manually reconnect after server restart', async () => {
    console.log('Creating client with reconnection disabled');
    const client = env.createClient({ 
      reconnection: false,
      forceNew: true,
      timeout: 3000
    });
    
    console.log('Connecting client');
    await env.connectClient(client);
    console.log(`Client connected: ${client.connected}, ID: ${client.id}`);
    expect(client.connected).toBe(true);
    
    // Verify we can send and receive events
    const pongPromise = new Promise(resolve => {
      client.once('pong', (data) => {
        console.log('Received pong response:', data);
        resolve(data);
      });
    });
    
    console.log('Sending ping event');
    client.emit('ping', { test: 'initial-ping' });
    await pongPromise;
    console.log('Verified initial ping-pong');
    
    // Shut down the server
    console.log('Stopping server');
    await env.stopServer();
    
    // Wait for client to detect disconnect
    console.log('Waiting for client to detect disconnect');
    await waitForEvent(client, 'disconnect', 2000);
    expect(client.connected).toBe(false);
    console.log('Client disconnected, verified');
    
    // Restart the server
    console.log('Restarting server');
    await env.setup();
    console.log(`Server restarted on port ${env.port}`);
    
    // Manually reconnect
    console.log('Manually reconnecting client');
    client.connect();
    
    // Wait for connection to establish
    console.log('Waiting for connection to establish');
    await waitForEvent(client, 'connect', 3000);
    console.log(`Client connected after manual reconnect: ${client.connected}`);
    expect(client.connected).toBe(true);
    
    // Verify connection works after reconnection
    const reconnectPongPromise = new Promise(resolve => {
      client.once('pong', (data) => {
        console.log('Received pong after reconnect:', data);
        resolve(data);
      });
    });
    
    console.log('Sending ping after reconnect');
    client.emit('ping', { test: 'after-reconnect' });
    await reconnectPongPromise;
    console.log('Verified ping-pong after reconnect');
    
    // Cleanup
    console.log('Disconnecting client');
    client.disconnect();
  }, 20000); // 20 second timeout for this test
});