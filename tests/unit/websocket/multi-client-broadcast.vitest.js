/**
 * Multi-Client Socket.IO Broadcasting Tests
 * 
 * This test file demonstrates reliable testing of Socket.IO broadcasting to
 * multiple clients in different rooms, using the enhanced testing utilities.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSocketTestEnvironment } from '../utils/socket-test-utils.js';
import {
  createConnectedClients,
  subscribeClientsToRooms,
  verifyRoomMessageDelivery,
  setupRoomBroadcastTest
} from '../utils/multi-client-test-utils.js';

describe('Multi-Client Socket.IO Broadcasting', () => {
  // Shared test environment
  let testEnv;
  
  // Set up a fresh test environment before each test
  beforeEach(async () => {
    testEnv = await createSocketTestEnvironment();
    console.log(`Created test environment on port ${testEnv.port}`);
  });
  
  // Clean up all resources after each test
  afterEach(async () => {
    if (testEnv) {
      await testEnv.shutdown();
    }
  });
  
  it('should deliver messages only to clients in the target room', async () => {
    // Create three clients
    const clients = await createConnectedClients(testEnv, 3);
    
    // Subscribe clients to different rooms:
    // Client 1: 'metrics'
    // Client 2: 'alerts'
    // Client 3: 'metrics' and 'alerts'
    const roomMappings = [
      ['metrics'],
      ['alerts'],
      ['metrics', 'alerts']
    ];
    
    // Perform subscription
    await subscribeClientsToRooms(clients, roomMappings);
    
    // Prepare test messages for each room
    const messagesByRoom = {
      metrics: {
        type: 'metrics_update',
        data: { cpu: 50, memory: 75 }
      },
      alerts: {
        type: 'alert_notification',
        data: { level: 'warning', message: 'Test alert' }
      },
      all: {
        type: 'global_notification',
        message: 'Broadcast to everyone'
      }
    };
    
    // Send messages and verify delivery
    const results = await verifyRoomMessageDelivery(
      testEnv,
      clients,
      roomMappings,
      messagesByRoom
    );
    
    // Verify metrics room results
    expect(results.metrics.received.length).toBe(2); // Clients 1 and 3
    expect(results.metrics.notReceived.length).toBe(0);
    
    // Check client IDs to make sure the right clients received messages
    const metricsReceivers = results.metrics.received.map(r => r.index).sort();
    expect(metricsReceivers).toEqual([0, 2]); // Client indices 0 and 2
    
    // Verify alerts room results
    expect(results.alerts.received.length).toBe(2); // Clients 2 and 3
    expect(results.alerts.notReceived.length).toBe(0);
    
    // Check client IDs to make sure the right clients received messages
    const alertsReceivers = results.alerts.received.map(r => r.index).sort();
    expect(alertsReceivers).toEqual([1, 2]); // Client indices 1 and 2
    
    // Verify all room results (everyone should get this)
    expect(results.all.received.length).toBe(3); // All clients
    expect(results.all.notReceived.length).toBe(0);
    
    // Verify actual message content
    const metricsMsg = results.metrics.received.find(r => r.index === 0).message;
    expect(metricsMsg.type).toBe('metrics_update');
    expect(metricsMsg.data.cpu).toBe(50);
    
    const alertMsg = results.alerts.received.find(r => r.index === 1).message;
    expect(alertMsg.type).toBe('alert_notification');
    expect(alertMsg.data.level).toBe('warning');
  });
  
  it('should handle clients joining and leaving rooms', async () => {
    // Create two clients
    const clients = await createConnectedClients(testEnv, 2);
    
    // Initially subscribe clients to these rooms:
    // Client 1: 'room1'
    // Client 2: 'room2'
    const initialRoomMappings = [
      ['room1'],
      ['room2']
    ];
    
    // Perform initial subscription
    await subscribeClientsToRooms(clients, initialRoomMappings);
    
    // Send test messages to verify initial subscription
    const initialMessages = {
      room1: {
        type: 'room1_message',
        data: 'test1'
      },
      room2: {
        type: 'room2_message',
        data: 'test2'
      }
    };
    
    // Verify initial delivery
    const initialResults = await verifyRoomMessageDelivery(
      testEnv,
      clients,
      initialRoomMappings,
      initialMessages
    );
    
    // Verify room1 message went only to client 1
    expect(initialResults.room1.received.length).toBe(1);
    expect(initialResults.room1.received[0].index).toBe(0);
    
    // Verify room2 message went only to client 2
    expect(initialResults.room2.received.length).toBe(1);
    expect(initialResults.room2.received[0].index).toBe(1);
    
    // Change subscriptions:
    // Client 1: now joins 'room2' (leaving 'room1')
    // Client 2: now joins 'room1' (leaving 'room2')
    const newRoomMappings = [
      ['room2'],
      ['room1']
    ];
    
    // Update subscriptions (essentially swapping rooms)
    await subscribeClientsToRooms(clients, newRoomMappings);
    
    // Same test messages for the second test
    const newMessages = {
      room1: {
        type: 'room1_message',
        data: 'test1-updated'
      },
      room2: {
        type: 'room2_message',
        data: 'test2-updated'
      }
    };
    
    // Verify new delivery
    const newResults = await verifyRoomMessageDelivery(
      testEnv,
      clients,
      newRoomMappings,
      newMessages
    );
    
    // Verification should now be reversed
    // Verify room1 message went only to client 2
    expect(newResults.room1.received.length).toBe(1);
    expect(newResults.room1.received[0].index).toBe(1);
    
    // Verify room2 message went only to client 1
    expect(newResults.room2.received.length).toBe(1);
    expect(newResults.room2.received[0].index).toBe(0);
  });
  
  it('should support complex room subscription patterns', async () => {
    // Use the helper to set up a more complex test
    const { clients, roomMappings, messagesByRoom } = await setupRoomBroadcastTest(
      testEnv, 
      4, // 4 clients
      ['team1', 'team2', 'admin', 'notifications'] // 4 different rooms
    );
    
    // Verify the delivery
    const results = await verifyRoomMessageDelivery(
      testEnv,
      clients,
      roomMappings,
      messagesByRoom
    );
    
    // All results should have at least one recipient
    for (const roomName in results) {
      expect(results[roomName].received.length).toBeGreaterThan(0);
      
      // Verify that all messages were received with correct data
      for (const receipt of results[roomName].received) {
        expect(receipt.message.type).toBe(`${roomName}_update`);
        expect(receipt.message.data).toBe(`Message for ${roomName}`);
      }
    }
  });
});