/**
 * Reset Circuit Breaker Utility
 * 
 * This script resets the circuit breaker for the specified service
 * and attempts a test call to verify the service is working properly.
 */
import { CircuitBreaker } from '../utils/monitoring.js';
import logger from '../utils/logger.js';
import perplexityService from '../services/perplexityService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Verify API keys are loaded
const checkApiKey = (name, key) => {
  console.log(`${name} API key is ${key ? 'available' : 'NOT AVAILABLE'}`);
  return !!key;
};

const perplexityKeyAvailable = checkApiKey('PERPLEXITY', process.env.PERPLEXITY_API_KEY);

if (!perplexityKeyAvailable) {
  console.error('Perplexity API key is not available. Please check your environment variables.');
  process.exit(1);
}

// Create a new circuit breaker instance and reset the service
const circuitBreaker = new CircuitBreaker();
circuitBreaker.reset('perplexity-deep');
console.log('Circuit breaker for perplexity-deep has been reset');

// Attempt a test deep research call to verify service is working
async function testDeepResearch() {
  try {
    const testQuery = "What are the latest advancements in renewable energy?";
    const testJobId = "test-reset-job";
    
    console.log('Testing deep research with a simple query...');
    const result = await perplexityService.performDeepResearch(testQuery, testJobId);
    
    console.log('Deep research successful!');
    console.log(`Response length: ${result.content.length} characters`);
    console.log(`Sources: ${result.sources.length}`);
    
    // Log a small preview of the response
    console.log('\nResponse preview:');
    console.log(result.content.substring(0, 300) + '...');
    
    return true;
  } catch (error) {
    console.error('Deep research test failed:', error.message);
    if (error.response?.data) {
      console.error('API error details:', error.response.data);
    }
    return false;
  } finally {
    // Clean up
    circuitBreaker.stop();
  }
}

// Run the test
testDeepResearch()
  .then(success => {
    if (success) {
      console.log('\nCircuit breaker reset and service test successful!');
    } else {
      console.error('\nCircuit breaker reset but service test failed!');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });