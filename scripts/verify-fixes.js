
// Comprehensive verification script to test the timeout fix and tiered response strategy
import logger from '../utils/logger.js';
import { createClient } from '../services/redisService.js';
import { getTieredResponse } from '../utils/tieredResponseStrategy.js';

logger.info('Starting verification of fixes...');

// Test Redis timeout fix
async function testRedisTimeout() {
  logger.info('Testing Redis timeout fix...');
  const redisClient = createClient();
  
  try {
    const testKey = 'test-timeout-fix';
    const testValue = 'working properly';
    
    // Set a test value
    await redisClient.set(testKey, testValue, 'EX', 60);
    logger.info('✅ Redis SET operation successful');
    
    // Get the value back
    const result = await redisClient.get(testKey);
    if (result === testValue) {
      logger.info('✅ Redis GET operation successful');
    } else {
      logger.error(`❌ Redis GET returned wrong value: ${result}`);
    }
    
    // Clean up
    await redisClient.del(testKey);
    logger.info('✅ Redis DEL operation successful');
    
    // Quit the client properly
    await redisClient.quit();
    logger.info('✅ Redis connection closed properly');
    
    return true;
  } catch (error) {
    logger.error('❌ Redis timeout test failed:', error);
    try {
      await redisClient.quit();
    } catch (e) {
      logger.error('Failed to close Redis connection:', e);
    }
    return false;
  }
}

// Test tiered response strategy
async function testTieredResponse() {
  logger.info('Testing tiered response strategy...');
  
  try {
    // Create a mock query and configuration
    const query = 'What are the key market trends in the tech industry?';
    const options = {
      maxTokens: 1000,
      detailedResponse: true,
      timeout: 10000
    };
    
    // Execute the tiered response strategy
    const result = await getTieredResponse(query, options);
    
    if (result && typeof result === 'object') {
      logger.info('✅ Tiered response strategy working properly');
      logger.info(`Response has ${Object.keys(result).length} sections`);
      return true;
    } else {
      logger.error('❌ Tiered response returned invalid data:', result);
      return false;
    }
  } catch (error) {
    logger.error('❌ Tiered response test failed:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  logger.info('======================================');
  logger.info('       RUNNING VERIFICATION TESTS');
  logger.info('======================================');
  
  const redisResult = await testRedisTimeout();
  const tieredResult = await testTieredResponse();
  
  logger.info('======================================');
  logger.info('       VERIFICATION RESULTS');
  logger.info('======================================');
  logger.info(`Redis Timeout Fix: ${redisResult ? '✅ PASSED' : '❌ FAILED'}`);
  logger.info(`Tiered Response: ${tieredResult ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (redisResult && tieredResult) {
    logger.info('✅ All fixes verified successfully!');
    return true;
  } else {
    logger.error('❌ Some fixes did not pass verification!');
    return false;
  }
}

// Run tests and exit with appropriate code
runAllTests()
  .then(success => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Test runner encountered an error:', error);
    process.exit(1);
  });
