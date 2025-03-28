// Vitest setup file - similar to Jest setup but for Vitest

// Store information to track originally loaded modules
globalThis.__ORIGINAL_MODULES__ = {};

// Ensure all tests have proper cleanup
afterAll(async () => {
  // Add any global cleanup here
  if (globalThis.__CIRCUIT_BREAKERS__) {
    for (const breaker of globalThis.__CIRCUIT_BREAKERS__) {
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
});

// Track circuit breakers created during tests
globalThis.__CIRCUIT_BREAKERS__ = [];

// Export a function to register circuit breakers for cleanup
globalThis.registerCircuitBreakerForCleanup = (breaker) => {
  globalThis.__CIRCUIT_BREAKERS__.push(breaker);
};