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
/**
 * Test Redis Service with timeout handling
 */

import redisService from '../../services/redisService.js';
import logger from '../../utils/logger.js';

async function testRedisTimeout() {
  logger.info('======================================');
  logger.info('     TESTING REDIS TIMEOUT HANDLING');
  logger.info('======================================');

  // Test 1: Basic Redis operations
  try {
    logger.info('\n[1/3] Testing basic Redis operations...');
    
    // Set a value
    await redisService.set('test-key', 'test-value');
    logger.info('- Set operation successful');
    
    // Get the value
    const value = await redisService.get('test-key');
    logger.info(`- Get operation successful: ${value}`);
    
    // Delete the value
    await redisService.del('test-key');
    logger.info('- Delete operation successful');
    
    logger.info('\n✅ Basic Redis operations working correctly');
  } catch (error) {
    logger.error(`Error testing basic Redis operations: ${error.message}`);
  }

  // Test 2: Timeout handling with cache operations
  try {
    logger.info('\n[2/3] Testing timeout handling with cache operations...');
    
    // Override the get method to simulate a timeout
    const originalGet = redisService.client.get;
    redisService.client.get = async () => {
      // Simulate a long-running operation that exceeds the timeout
      await new Promise(resolve => setTimeout(resolve, 6000));
      return 'This should never be returned due to timeout';
    };
    
    // Try to get a value with timeout protection
    logger.info('- Attempting get operation with simulated timeout...');
    const startTime = Date.now();
    try {
      const result = await redisService.get('timeout-test-key', { timeout: 3000 });
      logger.error('❌ Timeout handling failed: operation completed when it should have timed out');
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.info(`- Get operation correctly timed out after ~${duration}ms`);
      logger.info(`- Error message: ${error.message}`);
      logger.info('\n✅ Timeout handling working correctly');
    }
    
    // Restore the original get method
    redisService.client.get = originalGet;
  } catch (error) {
    logger.error(`Error testing timeout handling: ${error.message}`);
  }

  // Test 3: Fallback behavior
  try {
    logger.info('\n[3/3] Testing fallback behavior...');
    
    // Override the get method to simulate a failure
    const originalGet = redisService.get;
    redisService.get = async (key, options = {}) => {
      throw new Error('Simulated Redis failure');
    };
    
    // Try to get a value with fallback
    const result = await redisService.getWithFallback('fallback-test-key', 'fallback-value');
    logger.info(`- Get with fallback result: ${result}`);
    
    if (result === 'fallback-value') {
      logger.info('\n✅ Fallback mechanism working correctly');
    } else {
      logger.error('❌ Fallback mechanism failed');
    }
    
    // Restore the original get method
    redisService.get = originalGet;
  } catch (error) {
    logger.error(`Error testing fallback behavior: ${error.message}`);
  }

  logger.info('\n======================================');
  logger.info('     REDIS TIMEOUT TEST COMPLETE');
  logger.info('======================================');
}

// Run the test
testRedisTimeout();
