/**
 * Vitest setup file
 * 
 * This file is executed before all test files. It:
 * 1. Sets up global test environment configuration
 * 2. Handles memory management to prevent OOM errors
 * 3. Provides clean-up functions for test runs
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi, expect } from 'vitest';
import { resetAllMocks } from './utils/test-helpers.js';

// Track memory usage for debugging
const logMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  console.log('Memory Usage:');
  console.log(`RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
  console.log(`Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
};

// Setup global test environment
beforeAll(() => {
  console.log('Setting up global test environment');
  // Set longer timeout for all tests to accommodate API call mocks
  vi.setConfig({ testTimeout: 20000 });
  logMemoryUsage();
});

// Apply cleanup after each test
afterEach(() => {
  // Reset all mocks to prevent state leakage between tests
  vi.clearAllMocks();
});

// Apply global cleanup
afterAll(() => {
  console.log('Cleaning up global test environment');
  // Ensure any remaining timers are cleared
  vi.useRealTimers();
  // Explicitly run garbage collection if enabled (node --expose-gc)
  if (global.gc) {
    console.log('Running garbage collection');
    global.gc();
  }
  logMemoryUsage();
});

// Enable fake time management for all tests by default
// This makes tests more deterministic and prevents timeout issues
vi.useFakeTimers();

// Add custom matchers or global helpers here
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Setup global console log/error capture if needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

if (process.env.SILENT_LOGS === 'true') {
  console.log = () => {}; // Silence logs during tests
  console.error = () => {}; // Silence errors during tests
}

// Restore console functions after tests
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});