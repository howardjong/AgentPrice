/**
 * Reset Circuit Breaker
 * 
 * This script resets the circuit breaker for a specified service.
 * Usage: node tests/reset-circuit-breaker.js [service] [--skip-test]
 * 
 * Parameters:
 *   service: The service to reset (e.g., 'perplexity', 'claude')
 *   --skip-test: Optional flag to skip test API call after reset
 */

import CircuitBreaker from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';

const serviceName = process.argv[2] || 'all';
const skipTest = process.argv.includes('--skip-test');

logger.info(`Resetting circuit breaker for: ${serviceName}`);

// Initialize circuit breaker(s)
const perplexityBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000,
  monitorInterval: 10000,
  name: 'perplexity-api'
});

const claudeBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000,
  monitorInterval: 10000,
  name: 'claude-api'
});

// Reset specified circuit breaker
if (serviceName === 'all' || serviceName === 'perplexity') {
  perplexityBreaker.resetBreaker(); // Use resetBreaker instead of reset
  logger.info('Reset perplexity-api circuit breaker');

  if (!skipTest) {
    // Make a test call to ensure circuit breaker is working
    perplexityBreaker.execute(
      async () => {
        logger.info('Test call to perplexity circuit breaker successful');
        return true;
      },
      error => {
        logger.error(`Test call to perplexity circuit breaker failed: ${error.message}`);
        return false;
      }
    );
  }
}

if (serviceName === 'all' || serviceName === 'claude') {
  claudeBreaker.resetBreaker(); // Updated method name
  logger.info('Reset claude-api circuit breaker');

  if (!skipTest) {
    // Make a test call to ensure circuit breaker is working
    claudeBreaker.execute(
      async () => {
        logger.info('Test call to claude circuit breaker successful');
        return true;
      },
      error => {
        logger.error(`Test call to claude circuit breaker failed: ${error.message}`);
        return false;
      }
    );
  }
}

logger.info('Circuit breaker reset completed');

// Exit after a short delay to allow logs to be flushed
setTimeout(() => {
  process.exit(0);
}, 500);