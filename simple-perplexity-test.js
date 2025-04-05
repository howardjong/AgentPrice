/**
 * Simple Perplexity API Test
 * 
 * This script tests the basic Perplexity API functionality with a simple query
 * using the standard 'sonar' model instead of the deep research model.
 */

import perplexityService from './services/perplexityService.js';

// Define a simple query for testing
const query = 'What is quantum computing?';

// Check if API key is available
if (!process.env.PERPLEXITY_API_KEY) {
  console.error('PERPLEXITY_API_KEY is required but not found in environment variables.');
  process.exit(1);
}

console.log('Starting simple Perplexity API test...');
console.log('Query:', query);

async function runTest() {
  try {
    console.time('perplexityQuery');
    console.log('Using standard sonar model...');
    
    // Use processWebQuery instead of performDeepResearch for a faster response
    const result = await perplexityService.processWebQuery(query, {
      model: 'sonar', // Use standard model
      timeout: 30000, // 30 seconds should be enough
      maxTokens: 1000
    });
    
    console.timeEnd('perplexityQuery');
    
    console.log('\nPERPLEXITY API RESULTS:');
    console.log('Model used:', result.modelUsed || 'sonar');
    console.log('Content length:', result.content.length);
    console.log('Sources count:', (result.sources || []).length);
    
    console.log('\nFirst 500 characters of content:');
    console.log(result.content.substring(0, 500) + '...');
    
    if (result.sources && result.sources.length > 0) {
      console.log('\nSources:');
      result.sources.forEach((source, index) => {
        console.log(`${index + 1}. ${source.title || 'Unnamed source'} - ${source.url || 'No URL'}`);
      });
    }
    
    console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    return false;
  }
}

runTest()
  .then(success => {
    console.log('\nTest execution completed.');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });