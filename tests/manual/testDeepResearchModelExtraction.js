/**
 * Manual test for Perplexity deep research model extraction
 * 
 * This script tests the model extraction functionality in deep research mode.
 */

import perplexityService from '../../services/perplexityService.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

async function testDeepResearchModelExtraction() {
  try {
    console.log('Testing Perplexity deep research model extraction...');
    
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
    
    // Generate a test job ID
    const testJobId = uuidv4();
    
    // Test deep research with model extraction
    console.log('\nPerforming deep research with model extraction...');
    console.log('Test job ID:', testJobId);
    
    const result = await perplexityService.performDeepResearch(
      'Summarize briefly the most important technology advances from 2025 so far. Be concise.', 
      testJobId
    );
    
    console.log('\nDeep research result received.');
    console.log('Content preview:');
    console.log(result.content.substring(0, 200) + '...');
    
    console.log('\nActual model used:', result.modelUsed);
    
    // Verify that model information is in the content
    if (result.content.includes(`[Using Perplexity AI - Model: ${result.modelUsed}]`)) {
      console.log('Model information included in content ✓');
    } else {
      console.error('ERROR: Model information not found in content!');
    }
    
    // Check if sources were returned
    console.log('\nSources included:', result.sources.length);
    if (result.sources.length > 0) {
      console.log('First few sources:');
      result.sources.slice(0, 3).forEach((source, index) => {
        console.log(`  ${index + 1}. ${source}`);
      });
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
testDeepResearchModelExtraction().catch(err => {
  console.error('Unhandled error in test:', err);
});