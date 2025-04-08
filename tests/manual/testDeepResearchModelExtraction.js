
/**
 * Manual test for Perplexity deep research model extraction
 * 
 * This script tests the model extraction functionality in deep research mode
 * using sonar-deep-research model with fallback to sonar-pro if needed.
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
    const healthStatus = perplexityService.getHealthStatus 
      ? perplexityService.getHealthStatus() 
      : { status: 'unknown' };
      
    console.log('Service health status:', healthStatus);
    
    if (healthStatus.status !== 'available' && healthStatus.status !== 'connected') {
      console.error('ERROR: Perplexity service is not available!');
      return;
    }
    
    console.log('Service connection check passed ✓');
    
    // Generate a test job ID
    const testJobId = uuidv4();
    
    // Set query options with specific model and fallback
    const options = {
      model: 'sonar-deep-research',
      fallbackModels: ['sonar-pro', 'sonar'],
      requestId: testJobId,
      enableChunking: true
    };
    
    // Test deep research with model extraction
    console.log('\nPerforming deep research with model extraction...');
    console.log('Test job ID:', testJobId);
    console.log('Primary model:', options.model);
    console.log('Fallback models:', options.fallbackModels.join(', '));
    
    try {
      const result = await perplexityService.performDeepResearch(
        'Summarize briefly the most important technology advances from 2025 so far. Be concise.',
        options
      );
      
      console.log('\nDeep research result received.');
      console.log('Content preview:');
      console.log(result.content.substring(0, 200) + '...');
      
      console.log('\nActual model used:', result.modelUsed || 'Not specified');
      console.log('Citations count:', (result.citations || []).length);
      
      if (result.originalModel && result.originalModel !== result.modelUsed) {
        console.log('\nModel fallback occurred:');
        console.log(`Original model: ${result.originalModel}`);
        console.log(`Fallback model used: ${result.modelUsed}`);
      }
      
      console.log('\nTest completed successfully ✓');
      
    } catch (error) {
      console.error('\nDeep research failed with error:', error.message);
      
      // Retry with sonar-pro explicitly
      console.log('\nRetrying with sonar-pro model explicitly...');
      
      try {
        const fallbackResult = await perplexityService.performDeepResearch(
          'Summarize briefly the most important technology advances from 2025 so far. Be concise.',
          {
            ...options,
            model: 'sonar-pro'
          }
        );
        
        console.log('\nFallback research result received.');
        console.log('Content preview:');
        console.log(fallbackResult.content.substring(0, 200) + '...');
        
        console.log('\nFallback model used:', fallbackResult.modelUsed || 'sonar-pro');
        console.log('Citations count:', (fallbackResult.citations || []).length);
        
        console.log('\nFallback test completed successfully ✓');
      } catch (fallbackError) {
        console.error('\nFallback research also failed:', fallbackError.message);
        console.log('\nTest failed. Please check API credentials and model availability.');
      }
    }
    
  } catch (error) {
    console.error('Critical error during test execution:', error);
  }
}

// Run the test
testDeepResearchModelExtraction();
