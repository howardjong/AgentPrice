
/**
 * Test Claude Fallback Mechanism
 * 
 * This script tests the Claude service's fallback from claude-3-7-sonnet to claude-3-5-haiku
 * when the primary model fails.
 */

import claudeService from '../services/claudeService.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testClaudeFallback() {
  try {
    console.log('Testing Claude fallback mechanism...');
    console.log(`Primary model: ${claudeService.model}`);
    console.log(`Fallback model: ${claudeService.fallbackModel}`);
    
    // Create a simple test message
    const message = {
      role: 'user',
      content: 'Please respond with a simple hello and identify yourself.'
    };
    
    // Force the primary model to "fail" by temporarily changing it to an invalid model
    const originalModel = claudeService.model;
    claudeService.model = 'claude-invalid-model-to-force-fallback';
    
    console.log(`Temporarily changed primary model to: ${claudeService.model} (to force fallback)`);
    
    try {
      console.log('Sending request, expecting it to fall back to the fallback model...');
      const result = await claudeService.processConversation([message]);
      
      console.log('\n===== RESPONSE DETAILS =====');
      console.log(`Used fallback: ${result.usedFallback === true ? 'YES ✅' : 'NO ❌'}`);
      console.log(`Requested model: ${claudeService.model}`);
      console.log(`Actual model used: ${result.actualModel}`);
      console.log('\n===== RESPONSE CONTENT =====');
      console.log(result.response.substring(0, 200) + '...');
      console.log('\n===== TOKEN USAGE =====');
      console.log(`Input tokens: ${result.tokens.input}`);
      console.log(`Output tokens: ${result.tokens.output}`);
      
      // Verify fallback was used
      if (result.usedFallback === true) {
        console.log('\n✅ TEST PASSED: Fallback mechanism worked correctly');
      } else {
        console.log('\n❌ TEST FAILED: Fallback mechanism was not used');
      }
      
      return result;
    } catch (error) {
      console.error('Error during test:', error.message);
      console.log('\n❌ TEST FAILED: Both primary and fallback models failed');
      throw error;
    } finally {
      // Restore the original model
      claudeService.model = originalModel;
      console.log(`\nRestored primary model to: ${claudeService.model}`);
    }
  } catch (error) {
    console.error('Test execution error:', error.message);
    throw error;
  }
}

// Run the test
testClaudeFallback()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  });
