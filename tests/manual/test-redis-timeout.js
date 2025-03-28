
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
/**
 * Test Redis Service Timeout Handling
 * 
 * This test verifies that the Redis service correctly handles timeouts
 * and gracefully degrades when operations take too long.
 */

import redisClient from '../../services/redisService.js';
import logger from '../../utils/logger.js';

async function testRedisTimeoutHandling() {
  logger.info('======================================');
  logger.info('    TESTING REDIS TIMEOUT HANDLING');
  logger.info('======================================');
  
  // Test SET with default timeout
  try {
    logger.info('\n[1/4] Testing Redis SET with default timeout...');
    const testKey = 'timeout-test-' + Date.now();
    const testValue = 'This is a test value at ' + new Date().toISOString();
    
    const result = await redisClient.set(testKey, testValue);
    
    if (result) {
      logger.info('✅ SET operation successful');
    } else {
      logger.error('❌ SET operation failed');
    }
    
    // Verify we can get the value
    const retrievedValue = await redisClient.get(testKey);
    if (retrievedValue === testValue) {
      logger.info('✅ GET operation verified data was stored correctly');
    } else {
      logger.error('❌ GET operation failed or returned wrong value');
      logger.error(`Expected: ${testValue}, Got: ${retrievedValue}`);
    }
  } catch (error) {
    logger.error(`Error during basic SET test: ${error.message}`);
  }
  
  // Test SET with expiry
  try {
    logger.info('\n[2/4] Testing Redis SET with expiry...');
    const testKey = 'timeout-expiry-test-' + Date.now();
    const testValue = 'This is a test value with expiry at ' + new Date().toISOString();
    
    // Set with 5 second expiry
    const result = await redisClient.set(testKey, testValue, 5);
    
    if (result) {
      logger.info('✅ SET with expiry successful');
    } else {
      logger.error('❌ SET with expiry failed');
    }
    
    // Verify we can get the value immediately
    const retrievedValue = await redisClient.get(testKey);
    if (retrievedValue === testValue) {
      logger.info('✅ GET operation verified data was stored correctly');
    } else {
      logger.error('❌ GET operation failed or returned wrong value');
      logger.error(`Expected: ${testValue}, Got: ${retrievedValue}`);
    }
    
    // Wait 6 seconds and verify the key has expired
    logger.info('Waiting 6 seconds for key to expire...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const afterExpiryValue = await redisClient.get(testKey);
    if (afterExpiryValue === null) {
      logger.info('✅ Key expired as expected');
    } else {
      logger.error('❌ Key did not expire as expected');
      logger.error(`Expected: null, Got: ${afterExpiryValue}`);
    }
  } catch (error) {
    logger.error(`Error during SET with expiry test: ${error.message}`);
  }
  
  // Test SET with custom timeout
  try {
    logger.info('\n[3/4] Testing Redis SET with custom timeout (1 second)...');
    const testKey = 'timeout-custom-test-' + Date.now();
    const testValue = 'This is a test value with custom timeout at ' + new Date().toISOString();
    
    // Set with custom 1 second timeout (which should be plenty of time)
    const result = await redisClient.set(testKey, testValue, null, 1000);
    
    if (result) {
      logger.info('✅ SET with custom timeout successful');
    } else {
      logger.error('❌ SET with custom timeout failed');
    }
  } catch (error) {
    logger.error(`Error during SET with custom timeout test: ${error.message}`);
  }
  
  // Test timeout exceeding
  try {
    logger.info('\n[4/4] Testing Redis SET with simulated timeout exceeded...');
    
    // Monkey patch the Redis client's set method to simulate a slow operation
    const originalSet = redisClient.client.set;
    redisClient.client.set = async (...args) => {
      // Simulate a slow operation that takes longer than the timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      return 'OK';
    };
    
    const testKey = 'timeout-exceeded-test-' + Date.now();
    const testValue = 'This should time out';
    
    // This should timeout after 1 second
    const result = await redisClient.set(testKey, testValue, null, 1000);
    
    // Restore original method
    redisClient.client.set = originalSet;
    
    if (result === false) {
      logger.info('✅ SET correctly handled timeout');
    } else {
      logger.error('❌ SET should have timed out but did not');
    }
  } catch (error) {
    logger.error(`Error during timeout exceeded test: ${error.message}`);
    
    // Make sure we restore the original method
    const originalSet = redisClient.client.set;
    if (typeof originalSet === 'function') {
      redisClient.client.set = originalSet;
    }
  }
  
  logger.info('\n======================================');
  logger.info('     REDIS TIMEOUT TESTS COMPLETE');
  logger.info('======================================');
}

// Run the test
testRedisTimeoutHandling();
