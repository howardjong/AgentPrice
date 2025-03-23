/**
 * Reset Circuit Breaker Utility
 * 
 * This script resets the circuit breaker for the specified service
 * and attempts a test call to verify the service is working properly.
 * 
 * Usage:
 * node tests/reset-circuit-breaker.js [service-name]
 * 
 * Example:
 * node tests/reset-circuit-breaker.js perplexity-deep
 */
import { CircuitBreaker } from '../utils/monitoring.js';
import logger from '../utils/logger.js';
import perplexityService from '../services/perplexityService.js';
import claudeService from '../services/claudeService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const serviceToReset = args[0] || 'perplexity-deep';
const skipTest = args.includes('--skip-test');

console.log(`=== Circuit Breaker Reset Utility ===`);
console.log(`Target service: ${serviceToReset}`);

// Verify API keys are loaded based on which service we're resetting
const checkApiKey = (name, key) => {
  console.log(`${name} API key is ${key ? 'available' : 'NOT AVAILABLE'}`);
  return !!key;
};

let requiredKeyAvailable = true;

if (serviceToReset.includes('perplexity')) {
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
    // Don't exit, continue with reset but skip test
  }
} else if (serviceToReset.includes('claude')) {
  requiredKeyAvailable = checkApiKey('ANTHROPIC', process.env.ANTHROPIC_API_KEY);
  
  if (!requiredKeyAvailable) {
    console.error('Anthropic API key is not available. Please check your environment variables.');
    process.exit(1);
  }
}

// Create a new circuit breaker instance and reset the service
const circuitBreaker = new CircuitBreaker();
circuitBreaker.reset(serviceToReset);
console.log(`Circuit breaker for ${serviceToReset} has been reset`);

// Skip test if requested or if the API key is not available
if (skipTest || !requiredKeyAvailable) {
  console.log('Skipping service test...');
  console.log('Circuit breaker reset complete!');
  process.exit(0);
}

// Attempt a test call to verify the service is working
async function testService() {
  try {
    let result;
    
    if (serviceToReset.includes('perplexity')) {
      console.log('Testing Perplexity service...');
      const testQuery = "What are the latest advancements in renewable energy?";
      const testJobId = "test-reset-job";
      
      if (serviceToReset === 'perplexity-deep') {
        console.log('Testing deep research with a simple query...');
        result = await perplexityService.performDeepResearch(testQuery, testJobId);
      } else {
        console.log('Testing basic research with a simple query...');
        result = await perplexityService.performResearch([
          { role: 'user', content: testQuery }
        ]);
      }
      
      console.log('Perplexity test successful!');
      console.log(`Response length: ${result.content ? result.content.length : result.response.length} characters`);
      console.log(`Sources: ${result.sources ? result.sources.length : (result.citations ? result.citations.length : 0)}`);
      
      // Log a preview of the response
      console.log('\nResponse preview:');
      const previewText = result.content || result.response;
      console.log(previewText.substring(0, 300) + '...');
      
    } else if (serviceToReset.includes('claude')) {
      console.log('Testing Claude service...');
      result = await claudeService.processConversation([
        { role: 'user', content: 'Please respond with a brief hello world message' }
      ]);
      
      console.log('Claude test successful!');
      console.log(`Response: ${result.response.substring(0, 100)}...`);
    }
    
    return true;
  } catch (error) {
    console.error(`Service test failed:`, error.message);
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
if (!skipTest) {
  testService()
    .then(success => {
      if (success) {
        console.log('\n✅ Circuit breaker reset and service test successful!');
      } else {
        console.error('\n❌ Circuit breaker reset but service test failed!');
        console.error('The service may still be experiencing issues or may require a valid API key.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}