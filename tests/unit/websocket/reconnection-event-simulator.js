/**
 * Socket.IO Reconnection Event Simulator
 * 
 * This utility allows testing application reconnection logic without actual server restarts.
 * It provides controlled simulation of connection events that would occur during
 * network disruptions or server restarts.
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
  
  // Configure server event handling
  io.on('connection', (socket) => {
    // Initialize client state tracking
    clientStates.set(socket.id, {
      isReconnected: false,
      disconnectCount: 0,
      reconnectCount: 0,
      lastSequence: 0,
      pendingMessages: []
    });
    
    // Handle simulated network drop
    socket.on('__simulate_network_drop', () => {
      const clientState = clientStates.get(socket.id);
      if (clientState) {
        clientState.disconnectCount++;
        
        // Notify registered disconnect handlers
        const handler = handlers.onClientDisconnect.get(socket.id);
        if (handler) {
          handler(socket);
        }
        
        // Force disconnect the socket (but don't prevent reconnection)
        socket.disconnect();
      }
    });
    
    // Handle client signaling reconnection completion
    socket.on('__reconnection_complete', (recoveryData) => {
      const clientState = clientStates.get(socket.id);
      if (clientState) {
        clientState.isReconnected = true;
        clientState.reconnectCount++;
        
        // Notify registered reconnect handlers
        const handler = handlers.onClientReconnect.get(socket.id);
        if (handler) {
          handler(socket, recoveryData);
        }
        
        // Acknowledge the reconnection
        socket.emit('__reconnection_acknowledged', {
          reconnectCount: clientState.reconnectCount
        });
      }
    });
    
    // Handle recovery request
    socket.on('__request_recovery_data', (lastSequence) => {
      const clientState = clientStates.get(socket.id);
      if (clientState) {
        // In a real app, we'd calculate missed messages here
        const recoveryData = {
          lastSequence: clientState.lastSequence,
          pendingMessages: clientState.pendingMessages
        };
        
        // Notify recovery handlers
        const handler = handlers.onClientRecover.get(socket.id);
        if (handler) {
          handler(socket, lastSequence, recoveryData);
        }
        
        // Send recovery data to client
        socket.emit('__recovery_data', recoveryData);
      }
    });
    
    // Track disconnection
    socket.on('disconnect', () => {
      // Mark future connections as reconnections
      const state = clientStates.get(socket.id);
      if (state) {
        state.willBeReconnection = true;
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
      handlers.onClientDisconnect.set(clientId, handler);
    },
    
    /**
     * Register a handler for client reconnection
     * 
     * @param {string} clientId - Socket.IO client ID
     * @param {Function} handler - Function to call on reconnect
     */
    onReconnect: (clientId, handler) => {
      handlers.onClientReconnect.set(clientId, handler);
    },
    
    /**
     * Register a handler for client recovery request
     * 
     * @param {string} clientId - Socket.IO client ID
     * @param {Function} handler - Function to call on recovery
     */
    onRecover: (clientId, handler) => {
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
    recoveredData: null
  };
  
  // Debug logging
  const log = (...args) => {
    if (config.debug) {
      console.log('[ReconnectionHandler]', ...args);
    }
  };
  
  // Set up event handlers
  socket.on('disconnect', (reason) => {
    reconnectState.wasDisconnected = true;
    reconnectState.isReconnecting = true;
    log(`Disconnected: ${reason}`);
    
    // Socket.IO will handle the actual reconnection
  });
  
  socket.on('connect', () => {
    // Only trigger recovery on reconnection, not initial connection
    if (reconnectState.wasDisconnected) {
      reconnectState.reconnectCount++;
      log(`Reconnected (socket transport)`);
      
      if (config.autoRecover) {
        // Request recovery data
        log('Requesting recovery data');
        reconnectState.recoveryRequested = true;
        socket.emit('__request_recovery_data', config.recoveryData.lastSequence);
      }
      
      // Signal application-level reconnection
      socket.emit('__reconnection_complete', {
        reconnectCount: reconnectState.reconnectCount,
        clientInfo: config.recoveryData
      });
    }
  });
  
  // Handle reconnection acknowledgment
  socket.on('__reconnection_acknowledged', (data) => {
    log('Reconnection acknowledged by server', data);
    reconnectState.isReconnecting = false;
  });
  
  // Handle recovery data
  socket.on('__recovery_data', (data) => {
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
      socket.emit('__simulate_network_drop');
    },
    
    /**
     * Wait for reconnection to complete
     * This waits for both the transport reconnection and application-level reconnection
     * 
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Object>} - Reconnection state
     */
    waitForReconnection: async (timeoutMs = 2000) => {
      // First wait for acknowledgment
      await waitForEvent(socket, '__reconnection_acknowledged', timeoutMs);
      
      // If we're also waiting for recovery, wait for that too
      if (config.autoRecover && reconnectState.recoveryRequested) {
        await waitForEvent(socket, '__recovery_data', timeoutMs);
      }
      
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
    }
  };
}