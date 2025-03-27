/**
 * Circuit Breaker Reset Tool
 * 
 * This tool resets the circuit breaker for a specified service
 * to recover from rate limiting or other API issues.
 */

import { CircuitBreaker } from '../utils/monitoring.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get service from command line args
const args = process.argv.slice(2);
const serviceToReset = args[0] || 'all';
const skipTest = args.includes('--skip-test');

// Create circuit breaker instance
const circuitBreaker = new CircuitBreaker();

// Function to reset circuit breaker and perform test if needed
async function resetAndTest() {
  try {
    // Reset the circuit breaker
    if (serviceToReset === 'all') {
      circuitBreaker.resetAll();
      console.log('All circuit breakers have been reset');
    } else {
      circuitBreaker.reset(serviceToReset);
      console.log(`Circuit breaker for ${serviceToReset} has been reset`);
    }

    // Skip test if requested or API keys are missing
    if (skipTest) {
      console.log('Skipping test API call as requested');
      return;
    }

    // Verify API keys are loaded based on which service we're resetting
    const checkApiKey = (name, key) => {
      console.log(`${name} API key is ${key ? 'available' : 'NOT AVAILABLE'}`);
      return !!key;
    };

    let requiredKeyAvailable = true;

    if (serviceToReset.includes('perplexity') || serviceToReset === 'all') {
      requiredKeyAvailable = checkApiKey('PERPLEXITY', process.env.PERPLEXITY_API_KEY);
      if (!requiredKeyAvailable) {
        console.error(`
⚠️  WARNING: Perplexity API key is not available. The circuit breaker will be reset, 
   but the service may not function until a valid API key is provided.
   
   To add a Perplexity API key:
   1. Get a key from https://www.perplexity.ai/api
   2. Add it to Replit secrets as PERPLEXITY_API_KEY
   
   Continuing with reset anyway...
`);
      }
    } else if (serviceToReset.includes('claude') || serviceToReset === 'all') {
      requiredKeyAvailable = checkApiKey('ANTHROPIC', process.env.ANTHROPIC_API_KEY);
      if (!requiredKeyAvailable) {
        console.error('Anthropic API key is not available. Please check your environment variables.');
        process.exit(1);
      }
    }

    if (!requiredKeyAvailable) {
      console.log('Skipping service test due to missing API key...');
      return;
    }


    // Wait a moment before testing
    console.log('Waiting 2 seconds before testing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Perform a quick check based on the service
    if (serviceToReset === 'perplexity' || serviceToReset === 'all') {
      // Import the service dynamically to avoid circular dependencies
      try {
        const { default: perplexityService } = await import('../services/perplexityService.js');
        console.log('Testing Perplexity service status...');

        // Use a dummy request to test the circuit
        const response = await perplexityService.checkAvailability();
        console.log(`✅ Perplexity service check: ${response.status}`);
      } catch (error) {
        console.error(`❌ Perplexity service check failed: ${error.message}`);
      }
    }

    if (serviceToReset === 'claude' || serviceToReset === 'all') {
      try {
        const { default: claudeService } = await import('../services/claudeService.js');
        console.log('Testing Claude service status...');

        // Use a dummy request to test the circuit
        const response = await claudeService.checkAvailability();
        console.log(`✅ Claude service check: ${response.status}`);
      } catch (error) {
        console.error(`❌ Claude service check failed: ${error.message}`);
      }
    }

    console.log('\nCircuit breaker reset completed');
  } catch (error) {
    logger.error('Error resetting circuit breaker', { error: error.message, service: serviceToReset });
    console.error('Failed to reset circuit breaker:', error);
    process.exit(1);
  }
}

// Run the reset and test
resetAndTest();