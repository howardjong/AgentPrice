
/**
 * API Call Optimization Test
 * 
 * This script tests various strategies to minimize LLM API calls:
 * 1. Effective caching through Redis
 * 2. Using mock responses for development
 * 3. Circuit breaker patterns to prevent cascading failures
 * 4. Rate limiting to stay within quotas
 */

import logger from '../../utils/logger.js';
import { isLlmApiDisabled } from '../../utils/disableLlmCalls.js';
import perplexityService from '../../services/perplexityService.js';
import claudeService from '../../services/claudeService.js';
import redisService from '../../services/redisService.js';
import promptManager from '../../services/promptManager.js';
import { CircuitBreaker } from '../../utils/monitoring.js';

// Configure logger
logger.configure({
  level: 'info',
  format: 'simple',
  console: true
});

async function testApiCallOptimization() {
  console.log('======================================');
  console.log('       API CALL OPTIMIZATION TEST     ');
  console.log('======================================');
  
  // Part 1: Check API call disabling functionality
  console.log('\n[1] Testing API Call Disabling:');
  const apiCallsDisabled = isLlmApiDisabled();
  console.log(`- LLM API calls disabled: ${apiCallsDisabled ? '✅ Yes (cost saving mode)' : '❌ No (making actual API calls)'}`);
  
  if (apiCallsDisabled) {
    console.log('- ✅ Running in mock mode - No actual API calls will be made');
  }

  // Part 2: Check redis caching capabilities
  console.log('\n[2] Testing Redis Caching:');
  try {
    const client = await redisService.getClient();
    const isConnected = await redisService.ping();
    
    if (isConnected) {
      console.log('- ✅ Redis connection successful');
      
      // Test cache operations for API response caching
      const cacheKey = 'test_api_cache_key';
      const cacheData = { 
        timestamp: Date.now(), 
        value: 'test_cache_data',
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

  // Part 3: Test circuit breaker for API protection
  console.log('\n[3] Testing Circuit Breaker Patterns:');
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

  // Part 4: Check rate limiter status
  console.log('\n[4] Testing Rate Limiter Status:');
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

  // Part 5: Check prompt versioning and optimizations
  console.log('\n[5] Testing Prompt Optimization:');
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

  // Summary and recommendations
  console.log('\n======================================');
  console.log('       OPTIMIZATION SUMMARY           ');
  console.log('======================================');
  
  console.log('\nKey strategies to minimize LLM API calls:');
  console.log('1. Use the disable API calls feature in development');
  console.log('   - Set DISABLE_LLM_API_CALLS=true in your environment');
  console.log('   - Or use the "Start App - No API Calls" workflow');
  
  console.log('\n2. Leverage Redis caching effectively');
  console.log('   - Cache common queries');
  console.log('   - Implement response fingerprinting');
  console.log('   - Use appropriate TTL values for different query types');
  
  console.log('\n3. Optimize prompt design');
  console.log('   - Shorter prompts use fewer tokens');
  console.log('   - Well-structured prompts require fewer follow-up calls');
  console.log('   - Test and iterate on prompt versions');
  
  console.log('\n4. Implement fallback mechanisms');
  console.log('   - Use cached responses when API limits are hit');
  console.log('   - Have fallback models configured in case of rate limiting');
  
  console.log('\n5. Monitor and analyze usage patterns');
  console.log('   - Track token usage across services');
  console.log('   - Identify opportunities for batching similar requests');
  
  console.log('\n======================================');
  console.log('       TEST COMPLETE                  ');
  console.log('======================================');
}

// Run the test
testApiCallOptimization().catch(error => {
  logger.error('API call optimization test failed', { error: error.message });
  console.error('Test failed with error:', error);
  process.exit(1);
});
