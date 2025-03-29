
import redisService from '../../services/redisService.js';
import logger from '../../utils/logger.js';

async function testRedisService() {
  console.log('======================================');
  console.log('      REDIS SERVICE TEST');
  console.log('======================================');
  
  // Test connection
  console.log('[1] Testing Redis connection...');
  const client = await redisService.getClient();
  const isConnected = await redisService.ping();
  
  if (isConnected) {
    console.log('- ✅ Redis connection successful');
  } else {
    console.log('- ❌ Redis connection failed');
    process.exit(1);
  }
  
  // Test basic operations
  console.log('\n[2] Testing basic Redis operations...');
  
  try {
    // Test SET operation
    const testKey = 'test_health_key';
    const testValue = 'test_health_value_' + Date.now();
    await client.set(testKey, testValue);
    console.log('- ✅ SET operation successful');
    
    // Test GET operation
    const retrievedValue = await client.get(testKey);
    if (retrievedValue === testValue) {
      console.log('- ✅ GET operation successful');
    } else {
      console.log('- ❌ GET operation failed: value mismatch');
    }
    
    // Test DEL operation
    await client.del(testKey);
    const deletedValue = await client.get(testKey);
    if (deletedValue === null) {
      console.log('- ✅ DEL operation successful');
    } else {
      console.log('- ❌ DEL operation failed: key still exists');
    }
  } catch (error) {
    console.log('- ❌ Redis operations failed:', error.message);
  }
  
  // Test cache operations
  console.log('\n[3] Testing Redis cache operations...');
  
  try {
    const cacheKey = 'test_cache_key';
    const cacheData = { timestamp: Date.now(), value: 'test_cache_data' };
    
    // Set cache with 5 second expiry
    await client.set(cacheKey, JSON.stringify(cacheData), 'EX', 5);
    console.log('- ✅ Cache SET with expiry successful');
    
    // Get cache immediately
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      console.log('- ✅ Cache GET successful');
    } else {
      console.log('- ❌ Cache GET failed');
    }
    
    // Wait and check expiry
    console.log('- Waiting 6 seconds to test expiry...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const expiredData = await client.get(cacheKey);
    if (expiredData === null) {
      console.log('- ✅ Cache expiry working correctly');
    } else {
      console.log('- ❌ Cache expiry failed: key still exists');
    }
  } catch (error) {
    console.log('- ❌ Cache operations failed:', error.message);
  }
  
  console.log('\n======================================');
  console.log('       REDIS SERVICE TEST COMPLETE');
  console.log('======================================');
}

// Run the test
testRedisService().catch(error => {
  logger.error('Redis service test failed', { error: error.message });
  console.error('Test failed with error:', error);
  process.exit(1);
});
