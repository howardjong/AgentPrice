/**
 * Minimal Socket.IO Broadcast Test
 * 
 * Absolute minimal test of Socket.IO room broadcasting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSocketTestEnvironment, waitForConnect, waitForMessageType } from '../utils/socket-test-utils.js';

describe('Minimal Socket.IO Room Broadcasting', () => {
  let testEnv;
  
  beforeEach(async () => {
    testEnv = await createSocketTestEnvironment({ debug: true });
    console.log(`Test environment created on port ${testEnv.port}`);
  });
  
  afterEach(async () => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    if (testEnv) {
      await testEnv.shutdown();
    }
  });
  
  it('should broadcast to default room', async () => {
    // Create client
    const client = testEnv.createClient();
    await waitForConnect(client, 1000);
    
    // Broadcast to default room
    const message = { type: 'test_message', data: { value: 'test' }};
    
    // All connected clients are in the "all" room by default
    testEnv.broadcastToRoom('all', message);
    
    // Verify client received message
    const received = await waitForMessageType(client, 'test_message', 1000);
    expect(received.type).toBe('test_message');
    expect(received.data.value).toBe('test');
  });
});