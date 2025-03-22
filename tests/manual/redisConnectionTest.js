import redisClient from '../../services/redisService.js';
import logger from '../../utils/logger.js';

async function testRedisConnection() {
  try {
    logger.info('Starting Redis connection test');
    
    // Connect to Redis
    const client = redisClient.getClient();
    await client.connect();
    
    // Test simple operations
    logger.info('Setting test value');
    await client.set('test-key', 'test-value');
    
    logger.info('Getting test value');
    const value = await client.get('test-key');
    logger.info(`Retrieved value: ${value}`);
    
    logger.info('Deleting test value');
    await client.del('test-key');
    
    logger.info('Testing ping');
    const pingResult = await redisClient.ping();
    
    if (pingResult) {
      logger.info('Redis connection test successful');
    } else {
      logger.error('Redis ping failed');
    }
    
    // Cleanup
    await redisClient.stop();
    logger.info('Redis connection test completed');
  } catch (error) {
    logger.error('Redis connection test failed', { error: error.message, stack: error.stack });
  }
}

testRedisConnection();