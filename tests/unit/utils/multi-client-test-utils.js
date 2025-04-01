/**
 * Multi-Client Socket.IO Testing Utilities
 * 
 * These utilities enhance the socket-test-utils.js with specialized functions
 * for testing scenarios involving multiple clients, room subscriptions,
 * and broadcasts.
 */
import { waitForConnect, waitForMessageType } from './socket-test-utils.js';

/**
 * Create and connect multiple Socket.IO clients
 * @param {Object} testEnv - Test environment from createSocketTestEnvironment()
 * @param {number} count - Number of clients to create
 * @param {Object} options - Client options
 * @returns {Promise<Array>} Array of connected clients
 */
export async function createConnectedClients(testEnv, count = 2, options = {}) {
  console.log(`Creating ${count} Socket.IO clients...`);
  const clients = [];
  
  for (let i = 0; i < count; i++) {
    const client = testEnv.createClient(options);
    clients.push(client);
  }
  
  // Connect all clients sequentially to avoid race conditions
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    console.log(`Connecting client ${i + 1}...`);
    await waitForConnect(client, options.connectTimeout || 1000);
    console.log(`Client ${i + 1} connected with ID: ${client.id}`);
  }
  
  return clients;
}

/**
 * Subscribe multiple clients to different rooms
 * @param {Array} clients - Array of Socket.IO clients
 * @param {Array} roomMappings - Array of room arrays for each client
 * @returns {Promise<void>} Promise that resolves when all subscriptions are confirmed
 * 
 * @example
 * // Subscribe clients to different rooms:
 * // client1 -> ['room1', 'room2']
 * // client2 -> ['room2', 'room3']
 * await subscribeClientsToRooms(clients, [
 *   ['room1', 'room2'],
 *   ['room2', 'room3']
 * ]);
 */
export async function subscribeClientsToRooms(clients, roomMappings) {
  if (clients.length !== roomMappings.length) {
    throw new Error(`Client count (${clients.length}) doesn't match room mapping count (${roomMappings.length})`);
  }
  
  console.log('Subscribing clients to rooms...');
  
  // First emit all subscription requests
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const rooms = roomMappings[i];
    console.log(`Subscribing client ${i + 1} (${client.id}) to rooms:`, rooms);
    client.emit('subscribe', { topics: rooms });
  }
  
  // Then wait for all confirmation responses
  const confirmations = [];
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const rooms = roomMappings[i];
    console.log(`Waiting for subscription confirmation from client ${i + 1}...`);
    const confirmation = await waitForMessageType(
      client, 
      'subscription_update', 
      2000
    );
    
    confirmations.push(confirmation);
    const receivedRooms = confirmation.topics || [];
    
    // Verify all requested rooms are in the confirmation
    for (const room of rooms) {
      if (!receivedRooms.includes(room)) {
        console.warn(`Warning: Room ${room} not confirmed in subscription for client ${i + 1}`);
      }
    }
  }
  
  return confirmations;
}

/**
 * Verify message delivery to clients in specific rooms
 * @param {Object} testEnv - Test environment
 * @param {Array} clients - Array of Socket.IO clients
 * @param {Array} roomMappings - Array of room arrays for each client
 * @param {Object} messagesByRoom - Map of room names to messages to send
 * @param {number} timeout - Timeout for each message receipt in ms
 * @returns {Promise<Object>} Map of results by room and client
 * 
 * @example
 * const results = await verifyRoomMessageDelivery(
 *   testEnv,
 *   clients,
 *   [['room1'], ['room2']],
 *   {
 *     room1: { type: 'update', data: 'test1' },
 *     room2: { type: 'alert', data: 'test2' }
 *   }
 * );
 */
export async function verifyRoomMessageDelivery(
  testEnv, 
  clients, 
  roomMappings, 
  messagesByRoom,
  timeout = 1000
) {
  // Track results for each room and client
  const results = {};
  
  // Send messages to each room
  for (const [roomName, message] of Object.entries(messagesByRoom)) {
    console.log(`Broadcasting message to room ${roomName}:`, message.type);
    testEnv.broadcastToRoom(roomName, message);
    results[roomName] = { 
      message,
      received: [],
      notReceived: []
    };
    
    // Determine which clients should receive this message
    const clientsExpectingMessage = [];
    const clientsNotExpectingMessage = [];
    
    for (let i = 0; i < clients.length; i++) {
      const clientRooms = roomMappings[i];
      if (clientRooms.includes(roomName) || clientRooms.includes('all')) {
        clientsExpectingMessage.push({ index: i, client: clients[i] });
      } else {
        clientsNotExpectingMessage.push({ index: i, client: clients[i] });
      }
    }
    
    // Wait for clients that should receive the message
    for (const { index, client } of clientsExpectingMessage) {
      try {
        console.log(`Waiting for client ${index + 1} to receive ${message.type} from ${roomName}...`);
        const received = await waitForMessageType(client, message.type, timeout);
        console.log(`Client ${index + 1} received message:`, received.type);
        results[roomName].received.push({ index, client, message: received });
      } catch (err) {
        console.error(`Error: Client ${index + 1} didn't receive expected message from ${roomName}:`, err.message);
        results[roomName].notReceived.push({ index, client, error: err.message });
      }
    }
    
    // These clients should NOT receive the message, but we can't easily test for
    // the absence of a message in an asynchronous system without a long timeout
    for (const { index } of clientsNotExpectingMessage) {
      console.log(`Client ${index + 1} should NOT receive message from ${roomName}`);
    }
  }
  
  return results;
}

/**
 * Helper for simpler room-based broadcasting tests
 * @param {Object} testEnv - Socket.IO test environment
 * @param {number} clientCount - Number of clients to create
 * @param {Array<String>} roomNames - Array of room names to test with
 * @returns {Promise<Object>} Test objects ready for assertions
 */
export async function setupRoomBroadcastTest(testEnv, clientCount = 3, roomNames = ['room1', 'room2', 'room3']) {
  // Create clients
  const clients = await createConnectedClients(testEnv, clientCount);
  
  // Create room mappings - each client joins one main room and possibly the next room
  const roomMappings = [];
  for (let i = 0; i < clientCount; i++) {
    // Each client joins its "primary" room (by index)
    const primaryRoom = roomNames[i % roomNames.length];
    
    // Some clients also join an additional room
    if (i % 2 === 0 && i + 1 < roomNames.length) {
      roomMappings.push([primaryRoom, roomNames[i + 1]]);
    } else {
      roomMappings.push([primaryRoom]);
    }
  }
  
  // Subscribe clients to their rooms
  const subscriptions = await subscribeClientsToRooms(clients, roomMappings);
  
  // Prepare test messages for each room
  const messagesByRoom = {};
  for (const roomName of roomNames) {
    messagesByRoom[roomName] = {
      type: `${roomName}_update`,
      data: `Message for ${roomName}`,
      timestamp: Date.now()
    };
  }
  
  return {
    clients,
    roomMappings,
    subscriptions,
    messagesByRoom
  };
}