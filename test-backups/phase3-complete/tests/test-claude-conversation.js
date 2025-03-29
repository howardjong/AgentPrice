/**
 * Test Claude Conversation with Model Detection
 * 
 * This script tests the Claude service's conversation function
 * with the enhanced model detection feature.
 */

import claudeService from '../services/claudeService.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testClaudeConversation() {
  try {
    console.log('Testing Claude conversation with model detection...');
    
    // Basic test query - keep it very simple to reduce response time
    const message = {
      role: 'user',
      content: 'Say hello and identify yourself in one short sentence.'
    };
    
    // Set a timeout for the API call
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API call timed out after 10 seconds')), 10000);
    });
    
    // Call the processConversation method with the enhanced model detection and timeout
    const result = await Promise.race([
      claudeService.processConversation([message]),
      timeoutPromise
    ]);
    
    console.log('Response from Claude:');
    console.log('---------------');
    console.log(`Requested model: ${result.requestedModel}`);
    console.log(`Actual model: ${result.actualModel}`);
    console.log('---------------');
    console.log('Response content:');
    console.log(result.response.substring(0, 300) + '...');
    console.log('---------------');
    
    if (result.requestedModel !== result.actualModel) {
      console.log(`⚠️ MODEL MISMATCH: Requested "${result.requestedModel}" but got "${result.actualModel}"`);
    } else {
      console.log('✅ Model match confirmed');
    }
    
    console.log(`Token usage: ${result.tokens.input} input / ${result.tokens.output} output`);
    
    return result;
  } catch (error) {
    console.error('Error testing Claude conversation:', error.message);
    throw error;
  }
}

// Run the test
testClaudeConversation()
  .then(result => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });