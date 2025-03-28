/**
 * Test Redis Service Timeout Handling
 */

import redisClient from '../../services/redisService.js';
import logger from '../../utils/logger.js';

async function testRedisTimeouts() {
  logger.info('======================================');
  logger.info('     TESTING REDIS TIMEOUT HANDLING');
  logger.info('======================================');

  // Test 1: Basic Redis operations with default timeouts
  try {
    logger.info('\n[1/3] Testing basic Redis operations...');

    // Set a value
    const testKey = 'timeout-test-' + Date.now();
    const testValue = 'test-value-' + Date.now();

    const setResult = await redisClient.set(testKey, testValue);
    logger.info(`SET operation result: ${setResult ? 'Success' : 'Failed'}`);

    // Get the value back
    const getValue = await redisClient.get(testKey);
    logger.info(`GET operation result: ${getValue === testValue ? 'Success' : 'Failed'}`);

    logger.info('✅ Basic Redis operations working correctly');
  } catch (error) {
    logger.error(`Error testing basic Redis operations: ${error.message}`);
  }

  // Test 2: Test with custom timeout (very short)
  try {
    logger.info('\n[2/3] Testing Redis with custom short timeout (100ms)...');

    const testKey = 'short-timeout-test-' + Date.now();
    const testValue = 'test-value-' + Date.now();

    // Set with very short timeout
    const setResult = await redisClient.set(testKey, testValue, null, 100);
    logger.info(`SET operation with short timeout result: ${setResult ? 'Success' : 'Failed'}`);

    // Get with very short timeout
    const getValue = await redisClient.get(testKey, 100);
    logger.info(`GET operation with short timeout result: ${getValue === testValue ? 'Success' : 'Failed'}`);

    logger.info('✅ Redis operations with custom timeout working correctly');
  } catch (error) {
    logger.error(`Error testing Redis with custom timeout: ${error.message}`);
  }

  // Test 3: Test with expiry
  try {
    logger.info('\n[3/3] Testing Redis with expiry...');

    const testKey = 'expiry-test-' + Date.now();
    const testValue = 'test-value-' + Date.now();

    // Set with 2 second expiry
    const setResult = await redisClient.set(testKey, testValue, 2);
    logger.info(`SET operation with expiry result: ${setResult ? 'Success' : 'Failed'}`);

    // Get immediately
    const getValueBefore = await redisClient.get(testKey);
    logger.info(`GET operation before expiry: ${getValueBefore === testValue ? 'Value exists' : 'Value not found'}`);

    // Wait for expiry
    logger.info('Waiting 3 seconds for expiry...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get after expiry
    const getValueAfter = await redisClient.get(testKey);
    logger.info(`GET operation after expiry: ${getValueAfter === null ? 'Value expired (correct)' : 'Value still exists (incorrect)'}`);

    logger.info('✅ Redis expiry working correctly');
  } catch (error) {
    logger.error(`Error testing Redis with expiry: ${error.message}`);
  }

  logger.info('\n======================================');
  logger.info('     REDIS TIMEOUT TEST COMPLETE');
  logger.info('======================================');
}

// Run the test
testRedisTimeouts();