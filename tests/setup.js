
// Using ES modules for Jest
import { jest } from '@jest/globals';
global.jest = jest;

// Store information to track originally loaded modules
global.__ORIGINAL_MODULES__ = {};

// Ensure all tests have proper cleanup
afterAll(async () => {
  // Add any global cleanup here
  if (global.__CIRCUIT_BREAKERS__) {
    for (const breaker of global.__CIRCUIT_BREAKERS__) {
      breaker.stop();
    }
  }
  
  // Import and clean up services that might have open handles
  try {
    const jobManager = (await import('../services/jobManager.js')).default;
    await jobManager.stop();
  } catch (error) {
    console.warn('Could not stop job manager:', error);
  }
  
  try {
    const redisClient = (await import('../services/redisService.js')).default;
    await redisClient.stop();
  } catch (error) {
    console.warn('Could not stop redis client:', error);
  }
  
  // Reset any fake timers
  try {
    jest.useRealTimers();
  } catch (error) {
    console.warn('Could not reset timers:', error);
  }
  
  // Clear mocks and reset modules
  jest.clearAllMocks();
  jest.resetModules();
  
  // No need to restore module state at global level
});

// Track circuit breakers created during tests
global.__CIRCUIT_BREAKERS__ = [];

// Export a function to register circuit breakers for cleanup
global.registerCircuitBreakerForCleanup = (breaker) => {
  global.__CIRCUIT_BREAKERS__.push(breaker);
};
