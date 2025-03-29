import { InMemoryStore } from '../../services/redisService.js';
import logger from '../../utils/logger.js';

// Create a new instance of InMemoryStore directly
class RedisClientTester {
  constructor() {
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      // Create a new InMemoryStore directly
      this.client = new InMemoryStore();
    }
    return this.client;
  }
}

async function testInMemoryStore() {
  try {
    logger.info('Starting In-Memory Store test');
    
    // Get an in-memory store instance
    const redisClient = new RedisClientTester();
    const store = redisClient.getClient();
    
    // Test simple operations
    logger.info('Setting test value');
    await store.set('test-key', 'test-value');
    
    logger.info('Getting test value');
    const value = await store.get('test-key');
    logger.info(`Retrieved value: ${value}`);
    
    logger.info('Deleting test value');
    await store.del('test-key');
    
    // Check the value was deleted
    const deletedValue = await store.get('test-key');
    if (deletedValue === null) {
      logger.info('Value successfully deleted');
    } else {
      logger.warn(`Value still exists: ${deletedValue}`);
    }
    
    // Test hash operations
    logger.info('Testing hash operations');
    await store.hSet('test-hash', 'field1', 'value1');
    await store.hSet('test-hash', 'field2', 'value2');
    
    const field1 = await store.hGet('test-hash', 'field1');
    logger.info(`Hash field1: ${field1}`);
    
    const allFields = await store.hGetAll('test-hash');
    logger.info(`All hash fields: ${JSON.stringify(allFields)}`);
    
    // Cleanup
    await store.quit();
    logger.info('In-Memory Store test completed successfully');
  } catch (error) {
    logger.error('In-Memory Store test failed', { error: error.message, stack: error.stack });
  }
}

testInMemoryStore();