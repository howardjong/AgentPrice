
/**
 * Test script for improved deep research flow
 * This script tests the updated Perplexity deep research implementation
 * with better error handling and fallback mechanisms
 */

import perplexityService from '../../services/perplexityService.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

async function testImprovedDeepResearch() {
  try {
    console.log('Testing improved Perplexity deep research implementation...');
    
    // Check if the API key is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('ERROR: PERPLEXITY_API_KEY is not set in environment variables!');
      console.log('Please set the environment variable and try again.');
      return;
    }
    
    console.log('API key check passed ✓');
    
    // Generate a test job ID
    const testJobId = uuidv4();
    
    // Set query options with specific model and fallback
    const options = {
      model: 'sonar-deep-research',
      fallbackModels: ['sonar-pro', 'sonar'],
      requestId: testJobId,
      enableChunking: true,
      saveResult: true,
      maxRetries: 2
    };
    
    // Test query
    const testQuery = 'Summarize the most effective pricing strategies for SaaS products in 2025. Be concise.';
    
    // Test deep research with model extraction
    console.log('\nPerforming deep research with improved fallback mechanism...');
    console.log('Test job ID:', testJobId);
    console.log('Primary model:', options.model);
    console.log('Fallback models:', options.fallbackModels.join(', '));
    console.log('Query:', testQuery);
    
    const startTime = Date.now();
    
    try {
      const result = await perplexityService.performDeepResearch(testQuery, options);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`\nDeep research completed in ${duration.toFixed(1)} seconds.`);
      console.log('Content preview:');
      console.log(result.content.substring(0, 200) + '...');
      
      console.log('\nActual model used:', result.modelUsed || 'Not specified');
      console.log('Citations count:', (result.citations || []).length);
      
      if (result.fallbackUsed) {
        console.log('\nModel fallback occurred:');
        console.log(`Original model: ${result.originalModel}`);
        console.log(`Fallback model used: ${result.modelUsed}`);
        console.log(`Fallback reason: ${result.fallbackReason || 'Primary model failed'}`);
      }
      
      // Log citation examples if available
      if (result.citations && result.citations.length > 0) {
        console.log('\nCitation examples:');
        result.citations.slice(0, 3).forEach((citation, index) => {
          console.log(`${index+1}. ${citation.title || 'Untitled'} - ${citation.url || 'No URL'}`);
        });
      }
      
      console.log('\nTest completed successfully ✓');
      
    } catch (error) {
      console.error('\nDeep research failed with error:', error.message);
      
      if (error.type) {
        console.error('Error type:', error.type);
      }
      
      if (error.model) {
        console.error('Failed model:', error.model);
      }
      
      console.error('\nTrying explicit sonar-pro model as fallback...');
      
      try {
        const fallbackResult = await perplexityService.performDeepResearch(
          testQuery,
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
        
        console.log('\nManual fallback test completed successfully ✓');
      } catch (fallbackError) {
        console.error('\nEven fallback to sonar-pro failed:', fallbackError.message);
        console.error('Test failed ✗');
      }
    }
    
  } catch (error) {
    console.error('Unhandled error in test:', error);
  }
}

// Run the test
testImprovedDeepResearch().catch(err => {
  console.error('Unhandled error in test:', err);
});
