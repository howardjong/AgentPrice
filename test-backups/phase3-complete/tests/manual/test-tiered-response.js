/**
 * Test Tiered Response Strategy with timeout handling
 */

import tieredResponse from '../../utils/tieredResponseStrategy.js';
import logger from '../../utils/logger.js';

export async function testTieredResponse() {
  logger.info('======================================');
  logger.info('   TESTING TIERED RESPONSE STRATEGY');
  logger.info('======================================');
  
  // Test basic tier with timeout
  logger.info('\nTesting basic tier response with 1s timeout:');
  try {
    // Overriding the tier for testing
    const startTime = Date.now();
    const response = await tieredResponse._generateResponseWithTimeout('basic', { 
      query: 'What is machine learning?',
      timeout: 1000  // 1 second timeout
    });
    const elapsed = Date.now() - startTime;
    
    logger.info(`- Received response in ${elapsed}ms`);
    logger.info(`- Response length: ${response ? response.length : 0} characters`);
    logger.info('- Success: true');
  } catch (error) {
    logger.info(`- Error: ${error.message}`);
    logger.info('- Success: false');
  }
  
  // Test timeout handling with an artificially long delay
  logger.info('\nTesting timeout handling with artificial 3s delay:');
  try {
    const startTime = Date.now();
    const response = await tieredResponse._generateResponseWithTimeout('basic', { 
      query: 'What is machine learning?',
      timeout: 1000,  // 1 second timeout
      _testDelay: 3000  // force a 3 second delay to trigger timeout
    });
    const elapsed = Date.now() - startTime;
    
    logger.info(`- Received response in ${elapsed}ms`);
    logger.info(`- Response length: ${response ? response.length : 0} characters`);
    logger.info('- Success: true');
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.info(`- Timeout triggered after ${elapsed}ms`);
    logger.info(`- Error: ${error.message}`);
    logger.info('- Success: false (expected)');
  }
  
  // Test fallback mechanism (assuming it exists in the implementation)
  logger.info('\nTesting tier fallback mechanism:');
  try {
    const startTime = Date.now();
    const response = await tieredResponse.getResponse('test-query', 'enhanced', {
      query: 'What is machine learning?',
      timeout: 1000,
      _testFallback: true  // force fallback to occur
    });
    const elapsed = Date.now() - startTime;
    
    logger.info(`- Received response in ${elapsed}ms`);
    logger.info(`- Response length: ${response ? response.length : 0} characters`);
    logger.info(`- Fallback occurred: ${response.fallback === true}`);
    logger.info(`- Original tier: enhanced, Fallback tier: ${response.tier || 'unknown'}`);
    logger.info('- Success: true');
  } catch (error) {
    logger.info(`- Error: ${error.message}`);
    logger.info('- Success: false');
  }
  
  logger.info('\n======================================');
  logger.info('   TIERED RESPONSE TEST COMPLETE');
  logger.info('======================================');
}

// Run the test
testTieredResponse();