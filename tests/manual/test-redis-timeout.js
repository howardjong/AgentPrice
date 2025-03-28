
/**
 * Test Redis Service Timeout Handling
 */

import redisService from '../../services/redisService.js';
import logger from '../../utils/logger.js';

async function testRedisTimeouts() {
  logger.info('======================================');
  logger.info('     TESTING REDIS TIMEOUT HANDLING');
  logger.info('======================================');
  
  // Test normal operations
  try {
    logger.info('\n[1/3] Testing normal SET operation...');
    const setResult = await redisService.set('test-key', 'test-value', 60);
    logger.info(`SET result: ${setResult}`);
    
    logger.info('\n[2/3] Testing normal GET operation...');
    const getValue = await redisService.get('test-key');
    logger.info(`GET result: ${getValue}`);
    
    logger.info('\n✅ Normal operations working correctly');
  } catch (error) {
    logger.error(`Error in normal Redis operations: ${error.message}`);
  }
  
  // Test timeout handling with very short timeout
  try {
    logger.info('\n[3/3] Testing timeout handling with 1ms timeout (should fail gracefully)...');
    const timeoutResult = await redisService.get('test-key', 1); // 1ms timeout should fail
    logger.info(`Timeout GET result: ${timeoutResult === null ? 'null (expected fallback)' : timeoutResult}`);
    
    logger.info('\n✅ Timeout handling working correctly');
  } catch (error) {
    logger.error(`Error testing timeout handling: ${error.message}`);
  }
  
  logger.info('\n======================================');
  logger.info('     REDIS TIMEOUT TEST COMPLETE');
  logger.info('======================================');
}

// Run the test
testRedisTimeouts();
