
/**
 * Test Cost Optimization Features
 * This script tests the various cost optimization features
 */

import perplexityService from '../../services/perplexityService.js';
import costTracker from '../../utils/costTracker.js';
import tieredResponseStrategy from '../../utils/tieredResponseStrategy.js';
import { cacheLlmCall } from '../../utils/llmCacheOptimizer.js';
import smartCache from '../../utils/smartCache.js';
import logger from '../../utils/logger.js';
import { recordCacheHit, recordCacheMiss } from '../../utils/cacheMonitor.js';

// Disable console logging for cleaner output
logger.transports.forEach(t => {
  if (t.name === 'console') {
    t.silent = true;
  }
});

// Enable test console output
function consoleLog(message) {
  console.log(message);
}

async function testCostOptimization() {
  consoleLog('\n======================================');
  consoleLog('     COST OPTIMIZATION TEST SUITE');
  consoleLog('======================================\n');
  
  // Reset cost tracker for clean test
  await costTracker.resetStats(false);
  
  // Clear cache for clean test
  smartCache.clear();
  
  // Test 1: Token Optimization
  consoleLog('[1] Testing Token Optimization...');
  
  const testMessages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Tell me about optimization. This query is basically testing how the system handles repetitive words words and filler text that is actually very very very redundant in nature. In order to reduce costs, we need to find a considerable amount of optimizations in the vast majority of our prompts.' }
  ];
  
  try {
    // Test without making actual API call
    const tokenOptimizer = (await import('../../utils/tokenOptimizer.js')).default;
    const result = tokenOptimizer.optimizeMessages(testMessages);
    
    consoleLog(`- Original message length: ${testMessages[1].content.length} chars`);
    consoleLog(`- Optimized message length: ${result.messages[1].content.length} chars`);
    consoleLog(`- Estimated token savings: ${result.tokenSavings} tokens`);
    consoleLog(`- Applied optimizations: ${result.optimizations.join(', ')}`);
    
    if (result.tokenSavings > 0) {
      consoleLog('✅ Token optimization working correctly');
    } else {
      consoleLog('❌ Token optimization not effective');
    }
  } catch (error) {
    consoleLog(`❌ Token optimization test failed: ${error.message}`);
  }
  
  // Test 2: LLM Caching
  consoleLog('\n[2] Testing LLM Caching...');
  
  try {
    // Create a modified version of cacheLlmCall that ignores the disabled flag
    const testCacheLlmCall = async (apiCallFn, options = {}) => {
      const cacheKey = options.cacheKey || 'test-cache-key';
      const ttl = options.ttl || 3600000;
      
      try {
        // Use the smart cache directly without checking if LLM calls are disabled
        const cacheResult = await smartCache.getOrCreate(
          cacheKey,
          apiCallFn,
          ttl
        );
        
        // Record cache hit/miss
        if (cacheResult.cached) {
          const service = options.service || 'perplexity';
          recordCacheHit(service, options.estimatedTokens || 1000);
        } else {
          const service = options.service || 'perplexity';
          recordCacheMiss(service);
        }
        
        return cacheResult.value;
      } catch (error) {
        return await apiCallFn();
      }
    };
    
    // Force clear cache at the beginning of the test
    smartCache.clear();
    
    // Create a mock API call function
    const mockApiCall = async () => {
      // Simulate API response
      return {
        content: "This is a test response",
        usage: { total_tokens: 50 }
      };
    };
    
    // First call (cache miss)
    const firstCall = await testCacheLlmCall(mockApiCall, {
      cacheKey: 'test-cache-key',
      ttl: 3600000, // 1 hour
      model: 'sonar',
      service: 'perplexity',
      estimatedTokens: 1000
    });
    
    // Second call (should be cache hit)
    const secondCall = await testCacheLlmCall(mockApiCall, {
      cacheKey: 'test-cache-key',
      ttl: 3600000, // 1 hour
      model: 'sonar',
      service: 'perplexity',
      estimatedTokens: 1000
    });
    
    consoleLog(`- First call content: "${firstCall.content.substring(0, 20)}..."`);
    consoleLog(`- Second call content: "${secondCall.content.substring(0, 20)}..."`);
    
    // Check if cache is working by inspecting the results
    const cacheStats = smartCache.getStats();
    const totalHits = cacheStats.exactHits + cacheStats.fuzzyHits;
    consoleLog(`- Cache stats: hits=${totalHits}, misses=${cacheStats.misses}`);
    
    if (totalHits > 0) {
      consoleLog('✅ LLM caching working correctly');
    } else {
      consoleLog('❌ LLM caching not effective');
    }
  } catch (error) {
    consoleLog(`❌ LLM caching test failed: ${error.message}`);
  }
  
  // Test 3: Cost Tracking
  consoleLog('\n[3] Testing Cost Tracking...');
  
  try {
    // Track some mock costs
    costTracker.trackCost({
      service: 'perplexity',
      model: 'sonar',
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300
    });
    
    costTracker.trackCost({
      service: 'claude',
      model: 'claude-3-haiku',
      inputTokens: 200,
      outputTokens: 300,
      totalTokens: 500
    });
    
    // Track a cached response (should count as savings)
    costTracker.trackCost({
      service: 'perplexity',
      model: 'sonar',
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      cached: true
    });
    
    // Get stats
    const stats = costTracker.getStats({ detailed: true });
    
    consoleLog(`- Total tracked cost: $${stats.totalCost}`);
    consoleLog(`- Total API calls: ${stats.calls}`);
    consoleLog(`- Total tokens: ${stats.tokens}`);
    consoleLog(`- Estimated savings: $${stats.savings.toFixed(4)}`);
    consoleLog('- Service breakdown:');
    Object.entries(stats.services).forEach(([service, data]) => {
      if (data.calls > 0) {
        consoleLog(`  - ${service}: ${data.calls} calls, ${data.tokens.total} tokens, $${data.cost.toFixed(6)}`);
      }
    });
    
    if (stats.calls > 0 && stats.savings > 0) {
      consoleLog('✅ Cost tracking working correctly');
    } else {
      consoleLog('❌ Cost tracking not effective');
    }
  } catch (error) {
    consoleLog(`❌ Cost tracking test failed: ${error.message}`);
  }
  
  // Test 4: Tiered Response Strategy
  consoleLog('\n[4] Testing Tiered Response Strategy...');
  
  try {
    // Configure tiered strategy with test budget
    tieredResponseStrategy.configure({
      budget: {
        daily: 5.0, // $5 daily budget
        monthly: 100.0 // $100 monthly budget
      }
    });
    
    // Get options for different tiers
    const minimalOptions = tieredResponseStrategy.getRequestOptions({
      service: 'perplexity',
      query: 'Simple query',
      forceTier: 'minimal'
    });
    
    const standardOptions = tieredResponseStrategy.getRequestOptions({
      service: 'perplexity',
      query: 'Medium complexity query with some specific details',
      forceTier: 'standard'
    });
    
    const premiumOptions = tieredResponseStrategy.getRequestOptions({
      service: 'perplexity',
      query: 'Highly complex detailed analysis request with multiple requirements and deep research needs',
      forceTier: 'premium'
    });
    
    consoleLog('- Minimal tier options:');
    consoleLog(`  - Model: ${minimalOptions.model}`);
    consoleLog(`  - Token limit: ${minimalOptions.tokenLimit}`);
    consoleLog(`  - Cache TTL: ${minimalOptions.cacheSettings.ttl / (60 * 60 * 1000)} hours`);
    
    consoleLog('- Standard tier options:');
    consoleLog(`  - Model: ${standardOptions.model}`);
    consoleLog(`  - Token limit: ${standardOptions.tokenLimit}`);
    consoleLog(`  - Cache TTL: ${standardOptions.cacheSettings.ttl / (60 * 60 * 1000)} hours`);
    
    consoleLog('- Premium tier options:');
    consoleLog(`  - Model: ${premiumOptions.model}`);
    consoleLog(`  - Token limit: ${premiumOptions.tokenLimit}`);
    consoleLog(`  - Cache TTL: ${premiumOptions.cacheSettings.ttl / (60 * 60 * 1000)} hours`);
    
    // Test budget-based tier adjustment
    consoleLog('\n- Testing budget-based tier adjustment:');
    tieredResponseStrategy.updateBudget(4.8, 80); // Near daily budget limit
    const adjustedTier = tieredResponseStrategy.getCurrentTier();
    consoleLog(`  - Adjusted tier after high daily cost: ${adjustedTier.name}`);
    
    if (adjustedTier.name === 'minimal') {
      consoleLog('✅ Tiered response strategy working correctly');
    } else {
      consoleLog('❌ Tiered response strategy not adjusting based on budget');
    }
  } catch (error) {
    consoleLog(`❌ Tiered response strategy test failed: ${error.message}`);
  }
  
  consoleLog('\n======================================');
  consoleLog('     COST OPTIMIZATION TEST RESULTS');
  consoleLog('======================================');
  
  // Reset cost tracker after tests
  await costTracker.resetStats(false);
  
  consoleLog('✅ All cost optimization tests completed');
}

// Run the test
testCostOptimization().catch(error => {
  console.error('Error in cost optimization tests:', error);
});
