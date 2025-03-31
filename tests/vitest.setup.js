/**
 * Vitest Setup File
 * 
 * This file runs before all tests to set up the testing environment.
 * It includes:
 * - Global test helpers
 * - Environment variable setup
 * - Global error handling
 * - Utility functions for socket.io and websocket tests
 */

import { afterAll, beforeAll, vi, expect } from 'vitest';

// Ensure environment is set to test
process.env.NODE_ENV = 'test';

// Set up test timeout behavior
const originalSetTimeout = setTimeout;
global.setTimeout = (fn, ms, ...args) => {
  // Make debugging easier by setting a maximum timeout
  const MAX_TIMEOUT = 15000;
  const timeout = Math.min(ms, MAX_TIMEOUT);
  return originalSetTimeout(fn, timeout, ...args);
};

// Add utility to ensure ports are available
global.getFreePorts = async (count = 1) => {
  const getPort = require('get-port');
  if (count === 1) {
    return await getPort();
  }
  
  // Get multiple ports if needed
  const ports = [];
  for (let i = 0; i < count; i++) {
    ports.push(await getPort());
  }
  return ports;
};

// Helper for controlled delays in tests
global.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Global error handling for unhandled promises
const originalUnhandledRejection = process.listeners('unhandledRejection').pop();
process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled rejection during test execution:');
  console.error(err);
  if (originalUnhandledRejection) {
    originalUnhandledRejection(err, promise);
  }
});

// Clean up resources on test exit
afterAll(() => {
  // Ensure all timeouts are cleared
  vi.useRealTimers();
  
  // Force garbage collection if supported
  if (global.gc) {
    global.gc();
  }
  
  // Add a small delay to allow resources to be properly released
  return global.delay(100);
});

// Initialize logger mocks to prevent console noise during tests
global.mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Log test start/end for better visibility in debug mode
beforeAll(() => {
  if (process.env.DEBUG) {
    console.log(`🚀 Starting test: ${expect.getState().currentTestName}`);
  }
});

afterAll(() => {
  if (process.env.DEBUG) {
    console.log(`✅ Completed test: ${expect.getState().currentTestName}`);
  }
});

// Setup socket testing utilities
global.setupSocketTestEnvironment = async () => {
  const SocketTestEnvironment = require('./unit/websocket/socketio-test-environment');
  return new SocketTestEnvironment();
};

console.log('✅ Vitest setup complete');