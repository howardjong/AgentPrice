/**
 * Manual test for Perplexity service model extraction
 * 
 * This script tests the model extraction functionality in the Perplexity service.
 */

import perplexityService from '../../services/perplexityService.js';
import logger from '../../utils/logger.js';

async function testPerplexityModelExtraction() {
  try {
    console.log('Testing Perplexity service model extraction...');
    
    // Check if the API key is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('ERROR: PERPLEXITY_API_KEY is not set in environment variables!');
      console.log('Please set the environment variable and try again.');
      return;
    }
    
    console.log('API key check passed ✓');
    
    // Verify service status
    const status = perplexityService.getStatus();
    console.log('Service status:', status);
    
    if (!status.status === 'connected') {
      console.error('ERROR: Perplexity service is not connected!');
      return;
    }
    
    console.log('Service connection check passed ✓');
    
    // Test basic research with model extraction
    console.log('\nPerforming basic research with model extraction...');
    const response = await perplexityService.performResearch([
      { role: 'user', content: 'What is the current date today? Please be brief.' }
    ]);
    
    console.log('\nResponse content preview:');
    console.log(response.response.substring(0, 200) + '...');
    
    console.log('\nActual model used:', response.modelUsed);
    
    // Verify that model information is in the response
    if (response.response.includes(`[Using Perplexity AI - Model: ${response.modelUsed}]`)) {
      console.log('Model information included in response ✓');
    } else {
      console.error('ERROR: Model information not found in response!');
    }
    
    console.log('\nTest completed successfully.');
  } catch (error) {
    console.error('ERROR during test:', error.message);
    if (error.response) {
      console.error('API error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
  }
}

// Execute the test
testPerplexityModelExtraction().catch(err => {
  console.error('Unhandled error in test:', err);
});