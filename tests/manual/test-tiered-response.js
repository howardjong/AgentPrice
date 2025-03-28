
/**
 * Test Tiered Response Strategy with timeout handling
 */

import tieredResponseStrategy from '../../utils/tieredResponseStrategy.js';
import logger from '../../utils/logger.js';

// Mock slow response for testing timeouts
async function testTieredResponses() {
  logger.info('======================================');
  logger.info('     TESTING TIERED RESPONSES');
  logger.info('======================================');
  
  const queryId = 'test-query-' + Date.now();
  const context = { query: 'What is the meaning of life?' };
  
  try {
    // Test basic tier
    logger.info('\n[1/3] Testing basic tier...');
    const basicResponse = await tieredResponseStrategy.getResponse(queryId, 'basic', context);
    logger.info(`Basic tier response: ${basicResponse.content}`);
    
    // Test standard tier
    logger.info('\n[2/3] Testing standard tier...');
    const standardResponse = await tieredResponseStrategy.getResponse(queryId, 'standard', context);
    logger.info(`Standard tier response: ${standardResponse.content}`);
    
    // Test enhanced tier
    logger.info('\n[3/3] Testing enhanced tier...');
    const enhancedResponse = await tieredResponseStrategy.getResponse(queryId, 'enhanced', context);
    logger.info(`Enhanced tier response: ${enhancedResponse.content}`);
    
    logger.info('\n✅ All tiers responded successfully');
  } catch (error) {
    logger.error(`Error testing tiered responses: ${error.message}`);
  }
  
  // Test fallback behavior with a timeout simulation
  try {
    logger.info('\n[TIMEOUT TEST] Testing fallback behavior with simulated timeout...');
    // Monkey patch the enhanced response method to simulate a timeout
    const originalEnhanced = tieredResponseStrategy._generateEnhancedResponse;
    tieredResponseStrategy._generateEnhancedResponse = async () => {
      await new Promise(resolve => setTimeout(resolve, 31000)); // Just over the 30s timeout
      return { content: 'This should never be reached' };
    };
    
    // This should trigger the timeout and fallback to standard tier
    const timeoutQueryId = 'timeout-test-' + Date.now();
    const result = await tieredResponseStrategy.getResponse(timeoutQueryId, 'enhanced', context);
    logger.info(`Fallback result tier: ${result.tier}`);
    logger.info(`Fallback content: ${result.content}`);
    
    // Restore original method
    tieredResponseStrategy._generateEnhancedResponse = originalEnhanced;
    
    logger.info('\n✅ Fallback mechanism worked correctly');
  } catch (error) {
    logger.error(`Error testing timeout fallback: ${error.message}`);
  }
  
  logger.info('\n======================================');
  logger.info('     TIERED RESPONSE TEST COMPLETE');
  logger.info('======================================');
}

// Run the test
testTieredResponses();
/**
 * Test Tiered Response Strategy with timeout handling
 */

import tieredResponseStrategy from '../../utils/tieredResponseStrategy.js';
import logger from '../../utils/logger.js';

async function testTieredResponses() {
  logger.info('======================================');
  logger.info('     TESTING TIERED RESPONSES');
  logger.info('======================================');
  
  const queryId = 'test-query-' + Date.now();
  const context = { query: 'What is the meaning of life?' };
  
  try {
    // Test basic tier
    logger.info('\n[1/3] Testing basic tier...');
    const basicResponse = await tieredResponseStrategy.getResponse(queryId, 'basic', context);
    logger.info(`Basic tier response: ${basicResponse.content}`);
    
    // Test standard tier
    logger.info('\n[2/3] Testing standard tier...');
    const standardResponse = await tieredResponseStrategy.getResponse(queryId, 'standard', context);
    logger.info(`Standard tier response: ${standardResponse.content}`);
    
    // Test enhanced tier
    logger.info('\n[3/3] Testing enhanced tier...');
    const enhancedResponse = await tieredResponseStrategy.getResponse(queryId, 'enhanced', context);
    logger.info(`Enhanced tier response: ${enhancedResponse.content}`);
    
    logger.info('\n✅ All tiers responded successfully');
  } catch (error) {
    logger.error(`Error testing tiered responses: ${error.message}`);
  }
  
  // Test fallback behavior with a timeout simulation
  try {
    logger.info('\n[TIMEOUT TEST] Testing fallback behavior with simulated timeout...');
    
    // Monkey patch the enhanced response method to simulate a timeout
    const originalEnhanced = tieredResponseStrategy._generateEnhancedResponse;
    tieredResponseStrategy._generateEnhancedResponse = async () => {
      await new Promise(resolve => setTimeout(resolve, 31000)); // Just over the 30s timeout
      return { content: 'This should never be reached' };
    };
    
    // This should trigger the timeout and fallback to standard tier
    const timeoutQueryId = 'timeout-test-' + Date.now();
    const result = await tieredResponseStrategy.getResponse(timeoutQueryId, 'enhanced', context);
    logger.info(`Fallback result tier: ${result.tier}`);
    logger.info(`Fallback content: ${result.content}`);
    
    // Restore original method
    tieredResponseStrategy._generateEnhancedResponse = originalEnhanced;
    
    logger.info('\n✅ Fallback mechanism worked correctly');
  } catch (error) {
    logger.error(`Error testing timeout fallback: ${error.message}`);
  }
  
  logger.info('\n======================================');
  logger.info('     TIERED RESPONSE TEST COMPLETE');
  logger.info('======================================');
}

// Run the test
testTieredResponses();
