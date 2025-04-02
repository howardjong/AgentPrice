/**
 * Basic test to verify Vitest is working properly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SocketTestEnvironment } from './socketio-test-environment';

describe('Basic Socket.IO Connection Test', () => {
  let env;
  
  // Create a fresh test environment before each test
  beforeEach(async () => {
    console.log("Setting up test environment...");
    env = new SocketTestEnvironment();
    await env.setup();
  });
  
  // Clean up after each test
  afterEach(async () => {
    console.log("Tearing down test environment...");
    if (env) {
      await env.teardown();
    }
  });
  
  it('should connect to the server', async () => {
    // Create and connect a client
    const client = env.createClient();
    await env.connectClient(client);
    
    // Verify the client is connected
    expect(client.connected).toBe(true);
    
    // Disconnect the client
    client.disconnect();
  }, 5000); // 5 second timeout
  
  it('should emit and receive a basic event', async () => {
    // Create and connect a client
    const client = env.createClient();
    await env.connectClient(client);
    console.log("Client connected successfully, setting up event handlers");
    
    // Add handler directly to the current socket instead of the general io connection
    const connectedSockets = Array.from(env.io.sockets.sockets.values());
    console.log(`Number of connected sockets: ${connectedSockets.length}`);
    
    const socket = connectedSockets[0];
    if (!socket) {
      console.error("No sockets connected on server side!");
      throw new Error("No sockets connected on server side");
    }
    
    console.log(`Setting up ping handler on socket: ${socket.id}`);
    socket.on('ping', (data) => {
      console.log(`Server received ping:`, data);
      console.log(`Emitting pong response from socket: ${socket.id}`);
      socket.emit('pong', { message: 'pong', received: data });
    });
    
    // Listen for the response with timeout
    const responsePromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout waiting for pong event"));
      }, 2000);
      
      client.on('pong', (data) => {
        console.log("Client received pong:", data);
        clearTimeout(timeoutId);
        resolve(data);
      });
    });
    
    // Emit the event
    console.log(`Client ${client.id} emitting ping event`);
    client.emit('ping', { message: 'ping' });
    
    try {
      // Wait for the response
      const response = await responsePromise;
      
      // Verify the response
      expect(response).toHaveProperty('message', 'pong');
      expect(response).toHaveProperty('received');
      expect(response.received).toHaveProperty('message', 'ping');
      
    } catch (error) {
      console.error("Error in test:", error.message);
      throw error;
    } finally {
      // Disconnect the client
      client.disconnect();
    }
  }, 10000); // 10 second timeout for more flexibility
});