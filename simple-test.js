/**
 * Simple test to verify the Perplexity service
 */
import perplexityService from './services/perplexityService.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function printMethods(obj) {
  console.log('Available methods:');
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'function') {
      console.log(` - ${key}`);
    }
  });
}

async function runTest() {
  console.log('Testing Perplexity Service...');
  
  try {
    console.log('Service status:', perplexityService.getStatus());
    
    // Print available methods
    printMethods(perplexityService);
    
    // Check if the conductDeepResearch method exists
    if (typeof perplexityService.conductDeepResearch === 'function') {
      console.log('✅ conductDeepResearch method is available');
    } else {
      console.log('❌ conductDeepResearch method is missing');
    }
    
    // Check API key
    if (process.env.PERPLEXITY_API_KEY) {
      console.log('✅ PERPLEXITY_API_KEY is available');
    } else {
      console.log('❌ PERPLEXITY_API_KEY is missing');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

runTest();