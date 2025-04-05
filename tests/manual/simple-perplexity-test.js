/**
 * Simple test for Perplexity API
 * 
 * This script tests the basic functionality of the Perplexity service
 * without the complex workflow.
 */

import perplexityService from '../../services/perplexityService.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
  console.log('Testing Perplexity API...');
  console.log(`API Key Present: ${!!process.env.PERPLEXITY_API_KEY}\n`);

  console.log('=== Testing Basic Web Query ===');
  console.log('Query: "What is quantum computing?"');

  try {
    // Simple web query test
    const query = 'What is quantum computing?';
    const result = await perplexityService.processWebQuery(query, {
      model: 'llama-3.1-sonar-small-128k-online',
      maxTokens: 1024,
      timeout: 60000 // 60 second timeout
    });

    console.log('=== Results ===');
    console.log(`Response length: ${result.content.length} characters`);
    console.log(`Citations: ${result.citations.length}`);
    console.log(`Model used: ${result.model}`);

    if (result.usage) {
      console.log('Token usage:', result.usage);
    }

    // Display first 200 chars of the response
    console.log('\nResponse preview:');
    console.log(result.content.substring(0, 200) + '...');

    console.log('\n=== Test completed successfully ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();