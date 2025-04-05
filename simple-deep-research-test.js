/**
 * Simple Deep Research Test
 * 
 * This script tests the Perplexity API deep research functionality directly
 * without going through the test runner infrastructure.
 */

import perplexityService from './services/perplexityService.js';

// Define a query for deep research
const query = 'What are the latest developments in quantum computing and their potential applications in cryptography?';

// Check if API key is available
if (!process.env.PERPLEXITY_API_KEY) {
  console.error('PERPLEXITY_API_KEY is required but not found in environment variables.');
  process.exit(1);
}

console.log('Starting simple deep research test...');
console.log('Query:', query);

async function runTest() {
  try {
    console.time('deepResearch');
    console.log('Using sonar-deep-research model with 5 minute timeout...');
    
    const result = await perplexityService.performDeepResearch(query, {
      model: 'sonar-deep-research',
      timeout: 300000, // 5 minutes
      maxTokens: 4096
    });
    
    console.timeEnd('deepResearch');
    
    console.log('\nDEEP RESEARCH RESULTS:');
    console.log('Model used:', result.modelUsed || 'sonar-deep-research');
    console.log('Content length:', result.content.length);
    console.log('Sources count:', (result.sources || []).length);
    
    console.log('\nFirst 500 characters of content:');
    console.log(result.content.substring(0, 500) + '...');
    
    if (result.sources && result.sources.length > 0) {
      console.log('\nSources:');
      result.sources.slice(0, 5).forEach((source, index) => {
        console.log(`${index + 1}. ${source.title || 'Unnamed source'} - ${source.url || 'No URL'}`);
      });
      
      if (result.sources.length > 5) {
        console.log(`... and ${result.sources.length - 5} more sources`);
      }
    }
    
    console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    
    if (error.message.includes('timeout')) {
      console.log('\nAPI TIMEOUT DETECTED - this is expected for deep research operations');
      console.log('Consider increasing the timeout value beyond 5 minutes or using the model with a smaller context window');
    }
    
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