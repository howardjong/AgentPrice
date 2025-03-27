/**
 * API Call Optimization Test
 * 
 * This script tests the cache optimization and cost saving features
 * to ensure LLM API calls are minimized when appropriate.
 */

import logger from '../../utils/logger.js';
import cacheMonitor from '../../utils/cacheMonitor.js';
import { isLlmApiDisabled } from '../../utils/disableLlmCalls.js';
import redisService from '../../services/redisService.js';
import perplexityService from '../../services/perplexityService.js';
import claudeService from '../../services/claudeService.js';
import promptManager from '../../services/promptManager.js';
import { CircuitBreaker } from '../../utils/monitoring.js';

async function testApiCallOptimization() {
  console.log('======================================');
  console.log('    API CALL OPTIMIZATION TEST');
  console.log('======================================');

  // Check if LLM API calls are disabled
  console.log('\n[1] Checking API call settings...');
  const apiCallsDisabled = isLlmApiDisabled();

  if (apiCallsDisabled) {
    console.log('- ✅ LLM API calls are disabled - running in cost saving mode');
  } else {
    console.log('- ℹ️ LLM API calls are enabled - tests will simulate caching behavior');
  }

  // Test cache monitor functionality
  console.log('\n[2] Testing cache monitoring system...');

  // Reset stats before testing
  cacheMonitor.resetStats();
  console.log('- Cache statistics reset');

  // Simulate some cache hits and misses
  const testServices = ['perplexity', 'claude'];
  const testKeys = ['test_query_1', 'test_query_2', 'test_query_3'];

  for (const service of testServices) {
    console.log(`\n- Testing cache for ${service} service:`);

    // Simulate some hits
    for (let i = 0; i < 5; i++) {
      cacheMonitor.recordHit(service, `${testKeys[i % 3]}_hit`);
    }

    // Simulate some misses
    for (let i = 0; i < 2; i++) {
      cacheMonitor.recordMiss(service, `${testKeys[i % 3]}_miss`);
    }

    // Test error handling
    cacheMonitor.recordError(service, new Error('Test error'));
  }

  // Get and display statistics
  const stats = cacheMonitor.getStats();
  console.log('\n- Cache effectiveness statistics:');
  console.log(`  - Total lookups: ${stats.totalLookups}`);
  console.log(`  - Hits: ${stats.hits}`);
  console.log(`  - Misses: ${stats.misses}`);
  console.log(`  - Hit rate: ${stats.hitRate}`);
  console.log(`  - Estimated savings: ${stats.estimatedSavings}`);

  // Check each service
  console.log('\n- Service-specific statistics:');
  for (const [service, serviceStats] of Object.entries(stats.byService)) {
    console.log(`  - ${service}: ${serviceStats.hits} hits, ${serviceStats.misses} misses`);
  }

  // Test exists function with Redis
  console.log('\n[3] Testing cache key existence check...');
  try {
    const client = await redisService.getClient();

    // Set a test key
    const testCacheKey = 'test_optimization_key';
    await client.set(testCacheKey, 'test_value', 'EX', 10);
    console.log(`- ✅ Set test key in Redis`);

    // Check if key exists (should be a hit)
    const exists = await cacheMonitor.exists(testCacheKey, 'test');
    if (exists) {
      console.log(`- ✅ Cache hit correctly identified`);
    } else {
      console.log(`- ❌ Cache hit not correctly identified`);
    }

    // Check non-existent key (should be a miss)
    const nonExistent = await cacheMonitor.exists('non_existent_key', 'test');
    if (!nonExistent) {
      console.log(`- ✅ Cache miss correctly identified`);
    } else {
      console.log(`- ❌ Cache miss not correctly identified`);
    }

    // Clean up
    await client.del(testCacheKey);
  } catch (error) {
    console.error(`- ❌ Error testing Redis cache: ${error.message}`);
  }


  // Part 2: Check redis caching capabilities (original code, modified slightly)
  console.log('\n[4] Testing Redis Caching:');
  try {
    const client = await redisService.getClient();
    const isConnected = await redisService.ping();
    
    if (isConnected) {
      console.log('- ✅ Redis connection successful');
      
      // Test cache operations for API response caching
      const cacheKey = 'test_api_cache_key_2'; //avoid collision with previous test
      const cacheData = { 
        timestamp: Date.now(), 
        value: 'test_cache_data_2',
        response: 'This is a cached API response to avoid calling the actual API',
        modelUsed: 'cached-model-response' 
      };
      
      // Set cache with 30 minute expiry (typical for research queries)
      await client.set(cacheKey, JSON.stringify(cacheData), 'EX', 1800);
      console.log('- ✅ Cache SET with 30 minute expiry successful');
      
      // Get cache data
      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        console.log('- ✅ Cache GET successful');
        console.log(`- Cache hit would save an API call cost`);
      }
      
      // Clean up
      await client.del(cacheKey);
    } else {
      console.log('- ❌ Redis connection failed - caching not available');
      console.log('  > Warning: Without caching, duplicate requests will result in additional API calls');
    }
  } catch (error) {
    console.log(`- ❌ Redis test failed: ${error.message}`);
  }

  // Part 3: Test circuit breaker for API protection (original code)
  console.log('\n[5] Testing Circuit Breaker Patterns:');
  try {
    const testBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    });
    
    console.log('- ✅ Circuit breaker initialized');
    console.log('- This pattern will prevent cascading failures and excessive API calls during errors');
    
    // Log circuit breaker status
    const perplexityBreakerState = perplexityService.circuitBreaker?.state['perplexity-deep'] || { status: 'unknown' };
    const claudeBreakerState = claudeService.circuitBreaker?.state['claude-questions'] || { status: 'unknown' };
    
    console.log(`- Perplexity circuit status: ${perplexityBreakerState.status}`);
    console.log(`- Claude circuit status: ${claudeBreakerState.status}`);
  } catch (error) {
    console.log(`- ❌ Circuit breaker test failed: ${error.message}`);
  }

  // Part 4: Check rate limiter status (original code)
  console.log('\n[6] Testing Rate Limiter Status:');
  try {
    // Dynamic import for rate limiter
    const perplexityRateLimiter = (await import('../../utils/rateLimiter.js')).default;
    const rateLimiterStatus = perplexityRateLimiter.getStatus();
    
    console.log(`- Active requests: ${rateLimiterStatus.activeRequests}`);
    console.log(`- Queued requests: ${rateLimiterStatus.queuedRequests}`);
    console.log(`- Rate limited: ${rateLimiterStatus.isRateLimited ? 'Yes ⚠️' : 'No ✅'}`);
    console.log(`- Next available slot: ${rateLimiterStatus.nextAvailableSlot}ms`);
    
    console.log('- ✅ Rate limiting will prevent exceeding API quotas and unexpected charges');
  } catch (error) {
    console.log(`- ❌ Rate limiter test failed: ${error.message}`);
  }

  // Part 5: Check prompt versioning and optimizations (original code)
  console.log('\n[7] Testing Prompt Optimization:');
  try {
    // Check if prompt manager is working
    const promptCount = await promptManager.countPrompts();
    console.log(`- Found ${promptCount} prompt templates`);
    
    if (promptCount > 0) {
      console.log('- ✅ Using optimized prompts can reduce token usage and improve response quality');
    } else {
      console.log('- ⚠️ No prompt templates found - token usage might not be optimized');
    }
  } catch (error) {
    console.log(`- ❌ Prompt optimization test failed: ${error.message}`);
  }

  // Recommendations based on test results
  console.log('\n[8] Optimization recommendations:');
  const hitRate = (stats.hits / stats.totalLookups) * 100;

  if (hitRate < 50) {
    console.log('- ⚠️ Low cache hit rate detected. Consider:');
    console.log('  - Reviewing cache key generation for better reuse');
    console.log('  - Increasing cache TTL values');
    console.log('  - Implementing result normalization for better cache hits');
  } else {
    console.log('- ✅ Cache hit rate is good');
  }

  // If API calls are enabled, suggest cost-saving options
  if (!apiCallsDisabled) {
    console.log('\n- Cost-saving opportunities:');
    console.log('  - Consider enabling API call disable mode during development');
    console.log('  - Set up regular cache analysis to identify optimization opportunities');
  }

  console.log('\n======================================');
  console.log('   API CALL OPTIMIZATION TEST COMPLETE');
  console.log('======================================');
}

// Run the test
testApiCallOptimization().catch(error => {
  logger.error('API call optimization test failed', { error: error.message });
  console.error('Test failed with error:', error);
  process.exit(1);
});