/**
 * Socket.IO Reconnection Event Simulator (Improved)
 * 
 * This utility allows testing application reconnection logic without actual server restarts.
 * It provides controlled simulation of connection events that would occur during
 * network disruptions or server restarts.
 * 
 * This version uses standard Socket.IO events where possible and implements
 * more robust state management to prevent timing issues.
 */

import { waitForEvent } from './socketio-test-utilities';

/**
 * Creates a reconnection event simulator attached to a Socket.IO server
 * This allows tests to simulate the events that occur during reconnection
 * without the complexity and unpredictability of actual server restarts.
 * 
 * @param {Object} io - Socket.IO server instance
 * @returns {Object} - Simulator interface
 */
export function createReconnectionSimulator(io) {
  // Track registered handlers
  const handlers = {
    onClientDisconnect: new Map(),
    onClientReconnect: new Map(),
    onClientRecover: new Map()
  };
  
  // Track all client states
  const clientStates = new Map();
  
  // Debug logging
  const log = (...args) => {
    console.log('[ReconnectionSimulator]', ...args);
  };
  
  // Configure server event handling
  io.on('connection', (socket) => {
    log(`Client connected: ${socket.id}`);
    
    // Check if this is a reconnected client
    const existingState = Array.from(clientStates.values())
      .find(state => state.originalId && state.originalId === socket.handshake.auth.originalId);
    
    if (existingState) {
      log(`Detected reconnection from client with original ID: ${socket.handshake.auth.originalId}`);
      
      // Update state with new socket ID
      existingState.currentId = socket.id;
      existingState.reconnectCount++;
      existingState.isReconnected = true;
      
      // Ensure we have a mapping for the new socket ID
      clientStates.set(socket.id, existingState);
      
      // Notify registered reconnect handlers
      const handler = handlers.onClientReconnect.get(socket.handshake.auth.originalId);
      if (handler) {
        handler(socket, { reconnectCount: existingState.reconnectCount });
      }
    } else {
      // Initialize client state tracking for new connection
      clientStates.set(socket.id, {
        originalId: socket.id,
        currentId: socket.id,
        isReconnected: false,
        disconnectCount: 0,
        reconnectCount: 0,
        lastSequence: 0,
        pendingMessages: []
      });
    }
    
    // Handle simulated network drop
    socket.on('simulate_network_drop', () => {
      log(`Simulating network drop for client: ${socket.id}`);
      const clientState = clientStates.get(socket.id);
      
      if (clientState) {
        clientState.disconnectCount++;
        
        // Notify registered disconnect handlers
        const handler = handlers.onClientDisconnect.get(socket.id);
        if (handler) {
          handler(socket);
        }
        
        // Force disconnect the socket (but allow reconnection)
        socket.disconnect();
      }
    });
    
    // Handle recovery request
    socket.on('request_recovery_data', (lastSequence) => {
      log(`Recovery data requested by client ${socket.id}, last sequence: ${lastSequence}`);
      const clientState = clientStates.get(socket.id);
      
      if (clientState) {
        // In a real app, we'd calculate missed messages here
        const recoveryData = {
          lastSequence: clientState.lastSequence,
          pendingMessages: clientState.pendingMessages
        };
        
        // Notify recovery handlers
        const handler = handlers.onClientRecover.get(clientState.originalId);
        if (handler) {
          handler(socket, lastSequence, recoveryData);
        }
        
        log(`Sending recovery data to client ${socket.id}`);
        // Send recovery data to client
        socket.emit('recovery_data', recoveryData);
      }
    });
    
    // Handle specific application reconnection completion
    socket.on('app_reconnection_complete', (data) => {
      log(`Application reconnection completion signaled by client ${socket.id}`);
      
      const clientState = clientStates.get(socket.id);
      if (clientState) {
        clientState.isReconnected = true;
        
        // Send acknowledgment to client
        socket.emit('app_reconnection_acknowledged');
      }
    });
    
    // Track disconnection
    socket.on('disconnect', (reason) => {
      log(`Client ${socket.id} disconnected. Reason: ${reason}`);
      
      // Keep track of the original ID for reconnection detection
      const state = clientStates.get(socket.id);
      if (state) {
        state.willBeReconnection = true;
        // We keep the state in the map to detect reconnection
      }
    });
  });
  
  return {
    /**
     * Register a handler for client disconnection
     * 
     * @param {string} clientId - Socket.IO client ID
     * @param {Function} handler - Function to call on disconnect
     */
    onDisconnect: (clientId, handler) => {
      log(`Registering disconnect handler for client ${clientId}`);
      handlers.onClientDisconnect.set(clientId, handler);
    },
    
    /**
     * Register a handler for client reconnection
     * 
     * @param {string} clientId - Socket.IO client ID
     * @param {Function} handler - Function to call on reconnect
     */
    onReconnect: (clientId, handler) => {
      log(`Registering reconnect handler for client ${clientId}`);
      handlers.onClientReconnect.set(clientId, handler);
    },
    
    /**
     * Register a handler for client recovery request
     * 
     * @param {string} clientId - Socket.IO client ID
     * @param {Function} handler - Function to call on recovery
     */
    onRecover: (clientId, handler) => {
      log(`Registering recovery handler for client ${clientId}`);
      handlers.onClientRecover.set(clientId, handler);
    },
    
    /**
     * Update client state with pending messages
     * 
     * @param {string} clientId - Socket.IO client ID
     * @param {Array} messages - Messages to mark as pending
     * @param {number} sequence - Last sequence number
     */
    queuePendingMessages: (clientId, messages, sequence) => {
      log(`Queueing ${messages.length} pending messages for client ${clientId}, sequence: ${sequence}`);
      const state = clientStates.get(clientId);
      if (state) {
        state.pendingMessages = messages;
        state.lastSequence = sequence;
      }
    },
    
    /**
     * Get current state for a client
     * 
     * @param {string} clientId - Socket.IO client ID
     * @returns {Object} Client state
     */
    getClientState: (clientId) => {
      return clientStates.get(clientId);
    },
    
    /**
     * Clear all handlers and state
     */
    reset: () => {
      log('Resetting all simulator state');
      handlers.onClientDisconnect.clear();
      handlers.onClientReconnect.clear();
      handlers.onClientRecover.clear();
      clientStates.clear();
    }
  };
}

/**
 * Creates a client-side reconnection handler
 * This provides standardized reconnection behavior for the client
 * that works with the server-side simulator.
 * 
 * @param {Object} socket - Socket.IO client
 * @param {Object} options - Configuration options
 * @returns {Object} - Client reconnection controller
 */
export function createClientReconnectionHandler(socket, options = {}) {
  const config = {
    autoRecover: options.autoRecover !== undefined ? options.autoRecover : true,
    debug: options.debug !== undefined ? options.debug : false,
    recoveryData: options.recoveryData || { lastSequence: 0 }
  };
  
  // Track state
  let reconnectState = {
    isReconnecting: false,
    wasDisconnected: false,
    reconnectCount: 0,
    recoveryRequested: false,
    recoveryReceived: false,
    recoveredData: null,
    originalId: socket.id || 'pending'
  };
  
  // Debug logging
  const log = (...args) => {
    if (config.debug) {
      console.log('[ReconnectionHandler]', ...args);
    }
  };
  
  // Store original ID for reconnection tracking
  socket.once('connect', () => {
    reconnectState.originalId = socket.id;
    log(`Initial connection established. Original ID: ${socket.id}`);
    
    // Update auth data to include original ID for server-side reconnection detection
    if (socket.auth) {
      socket.auth.originalId = socket.id;
    } else {
      socket.auth = { originalId: socket.id };
    }
  });
  
  // Set up event handlers
  socket.on('disconnect', (reason) => {
    reconnectState.wasDisconnected = true;
    reconnectState.isReconnecting = true;
    log(`Disconnected: ${reason}`);
  });
  
  socket.on('connect', () => {
    // Only trigger recovery on reconnection, not initial connection
    if (reconnectState.wasDisconnected) {
      reconnectState.reconnectCount++;
      log(`Reconnected (transport layer). Socket ID: ${socket.id}`);
      
      // Set the auth with original ID for server to detect reconnection
      if (socket.auth) {
        socket.auth.originalId = reconnectState.originalId;
      } else {
        socket.auth = { originalId: reconnectState.originalId };
      }
      
      if (config.autoRecover) {
        // Request recovery data
        log('Requesting recovery data');
        reconnectState.recoveryRequested = true;
        socket.emit('request_recovery_data', config.recoveryData.lastSequence);
      }
      
      // Signal application-level reconnection completion
      socket.emit('app_reconnection_complete', {
        reconnectCount: reconnectState.reconnectCount,
        originalId: reconnectState.originalId,
        clientInfo: config.recoveryData
      });
    }
  });
  
  // Handle application reconnection acknowledgment
  socket.on('app_reconnection_acknowledged', () => {
    log('Application reconnection acknowledged by server');
    reconnectState.isReconnecting = false;
  });
  
  // Handle recovery data
  socket.on('recovery_data', (data) => {
    log('Received recovery data', data);
    reconnectState.recoveryReceived = true;
    reconnectState.recoveredData = data;
    
    // Update our sequence tracking
    if (data && data.lastSequence) {
      config.recoveryData.lastSequence = data.lastSequence;
    }
  });
  
  return {
    /**
     * Simulate a network drop
     * This sends a message to the server to force a disconnect
     */
    simulateNetworkDrop: () => {
      log('Simulating network drop');
      socket.emit('simulate_network_drop');
    },
    
    /**
     * Wait for reconnection to complete
     * This waits for both the transport reconnection and application-level reconnection
     * 
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Object>} - Reconnection state
     */
    waitForReconnection: async (timeoutMs = 2000) => {
      log('Waiting for reconnection to complete');
      
      // First wait for socket to reconnect (using standard Socket.IO event)
      if (!socket.connected) {
        log('Socket not connected, waiting for connect event');
        await waitForEvent(socket, 'connect', timeoutMs);
      }
      
      // Then wait for application-level acknowledgment
      log('Transport connected, waiting for application acknowledgment');
      await waitForEvent(socket, 'app_reconnection_acknowledged', timeoutMs);
      
      // If we're also waiting for recovery, wait for that too
      if (config.autoRecover && reconnectState.recoveryRequested) {
        log('Waiting for recovery data');
        await waitForEvent(socket, 'recovery_data', timeoutMs);
      }
      
      log('Reconnection complete');
      return {
        reconnectCount: reconnectState.reconnectCount,
        recoveredData: reconnectState.recoveredData
      };
    },
    
    /**
     * Get current reconnection state
     * 
     * @returns {Object} - Current state
     */
    getState: () => {
      return { ...reconnectState };
    },
    
    /**
     * Update recovery data
     * 
     * @param {Object} data - New recovery data
     */
    updateRecoveryData: (data) => {
      config.recoveryData = { ...config.recoveryData, ...data };
    },
    
    /**
     * Disconnect and cleanup all event listeners
     * This ensures proper cleanup even in error cases
     */
    cleanup: () => {
      log('Performing cleanup');
      // Disable reconnection to prevent automatic reconnect attempts
      if (socket.io && socket.io.opts) {
        log('Disabling automatic reconnection');
        socket.io.opts.reconnection = false;
      }
      
      if (socket.connected) {
        log('Disconnecting socket');
        socket.disconnect();
      }
      
      log('Removing all listeners');
      socket.removeAllListeners();
    }
  };
}