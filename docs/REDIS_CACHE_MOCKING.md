# Redis Cache Mocking

This document provides comprehensive information about the Redis cache mocking implementation for testing Redis-dependent code without requiring a real Redis instance.

## Overview

The Redis cache mocking implementation provides a complete in-memory replacement for Redis that can be used in tests. It offers:

1. A full Redis-compatible API with support for key-value operations, hash operations, list operations, expiry, and more
2. IoRedis adapter for seamless replacement in code that uses the IoRedis client
3. Test utilities for simulating various Redis scenarios like errors, timeouts, and disconnections
4. Helper methods for populating test data and inspecting the cache state

## Components

### 1. RedisMock (`utils/redis-mock.js`)

The core implementation of the Redis mock that provides a complete in-memory replacement for Redis. It implements:

- Basic key operations (get, set, del, exists, expire)
- Hash operations (hset, hget, hgetall, hdel)
- List operations (lpush, rpush, lpop, rpop, lrange)
- Pattern matching for keys with wildcards
- Key expiration with proper TTL handling
- Pub/Sub functionality

### 2. RedisMockAdapter (`utils/redis-mock-adapter.js`)

An adapter that wraps the Redis mock to provide a compatible interface with the IoRedis client. It adds:

- IoRedis-compatible event handling (connect, ready, end, error)
- Support for the IoRedis `multi` command for transactions
- Command method proxying to the underlying mock

### 3. Redis Test Utilities (`utils/redis-test-utils.js`)

Utilities for testing Redis-dependent code, including:

- Functions to create and configure mock Redis clients
- Utilities to populate mock Redis instances with test data
- Functions to simulate Redis errors, timeouts, and disconnections
- Factory methods for creating complete Redis service mocks

## Usage Examples

### Basic Usage

```javascript
import { createMockRedisClient } from '../../../utils/redis-test-utils.js';

describe('My Redis-dependent Component', () => {
  let redisClient;
  
  beforeEach(() => {
    // Create a fresh Redis mock for each test
    redisClient = createMockRedisClient();
  });
  
  it('should store and retrieve values', async () => {
    // Use like a normal Redis client
    await redisClient.set('key', 'value');
    const result = await redisClient.get('key');
    expect(result).toBe('value');
  });
});
```

### Testing with Initial Data

```javascript
import { createMockRedisClient } from '../../../utils/redis-test-utils.js';

describe('Cache Service', () => {
  it('should use cached data when available', async () => {
    // Create Redis mock with pre-populated data
    const redisClient = createMockRedisClient({
      initialData: {
        'cache:user:123': JSON.stringify({ id: 123, name: 'Test User' }),
        'cache:counts': '42'
      }
    });
    
    // Test code that expects this data to be in Redis
    const cacheService = new CacheService(redisClient);
    const user = await cacheService.getUser(123);
    expect(user.name).toBe('Test User');
  });
});
```

### Testing Error Handling

```javascript
import { 
  createMockRedisClient, 
  simulateRedisError 
} from '../../../utils/redis-test-utils.js';

describe('Error Handling', () => {
  it('should handle Redis connection errors', async () => {
    // Create Redis client mock
    const redisClient = createMockRedisClient();
    
    // Simulate error on get method
    simulateRedisError(redisClient, 'get', new Error('Redis connection error'));
    
    // Test that your code handles the error properly
    const cacheService = new CacheService(redisClient);
    const result = await cacheService.getSafely('some-key', 'fallback');
    expect(result).toBe('fallback');
  });
});
```

### Testing Key Expiration

```javascript
import { vi } from 'vitest';
import { createMockRedisClient } from '../../../utils/redis-test-utils.js';

describe('Key Expiration', () => {
  it('should respect TTL for cached items', async () => {
    // Use fake timers to control time
    vi.useFakeTimers();
    
    // Create Redis client mock
    const redisClient = createMockRedisClient();
    
    // Set a key with 60 second expiry
    await redisClient.set('expiring-key', 'value', 'EX', 60);
    
    // Check it exists
    let value = await redisClient.get('expiring-key');
    expect(value).toBe('value');
    
    // Advance time by 61 seconds
    vi.advanceTimersByTime(61 * 1000);
    
    // Key should now be expired
    value = await redisClient.get('expiring-key');
    expect(value).toBeNull();
    
    // Clean up
    vi.useRealTimers();
  });
});
```

### Mocking Entire Redis Service

```javascript
import { createMockRedisService } from '../../../utils/redis-test-utils.js';

describe('Service with Redis Dependency', () => {
  it('should use the Redis service for caching', async () => {
    // Create a complete mock of the Redis service
    const redisService = createMockRedisService({
      initialData: {
        'service:data': JSON.stringify({ type: 'service-data' })
      }
    });
    
    // Inject into your application service
    const appService = new AppService(redisService);
    
    // Test with the mock Redis service
    const data = await appService.getServiceData();
    expect(data.type).toBe('service-data');
  });
});
```

## Real-world Testing Scenarios

The Redis mock implementation supports testing several common Redis usage patterns:

1. **Caching**: Test cache hit/miss logic, expiration, and fallback behavior
2. **Rate Limiting**: Verify rate limit counting, window expiration, and limit enforcement
3. **Distributed Locks**: Test lock acquisition, release, and auto-expiration
4. **Session Storage**: Validate session creation, retrieval, and expiration
5. **Pub/Sub Messaging**: Test message publishing and subscription handling
6. **Leaderboards**: Verify sorted set operations and ranking logic

## Comparison with Other Approaches

### Advantages over Other Mocking Solutions

1. **Complete API Coverage**: Implements a comprehensive set of Redis commands
2. **Time Control**: Works seamlessly with Vitest's fake timers for testing temporal behavior
3. **Realistic Behavior**: Simulates real Redis behavior including proper expiry and pattern matching
4. **IoRedis Compatibility**: Specifically designed to match IoRedis's interface
5. **Test Utilities**: Includes helpers for common testing scenarios

### Advantages over Using Real Redis

1. **No Dependencies**: Tests run without requiring a Redis server
2. **Deterministic**: Tests are not affected by external Redis state
3. **Faster**: No network latency or connection overhead
4. **Simpler Setup**: No configuration or cleanup needed
5. **Controllable**: Can simulate errors, timeouts, and edge cases

## Future Improvements

Potential areas for enhancement:

1. Support for more advanced Redis data structures (sorted sets, bit arrays)
2. Cluster mode simulation
3. Transaction failure simulation
4. Network latency simulation
5. Redis Streams API support