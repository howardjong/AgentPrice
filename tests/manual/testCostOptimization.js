
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

// Disable console logging for cleaner output
logger.transports.forEach(t => {
  if (t.name === 'console') {
    t.silent = true;
  }
});

// Enable test console output
const consoleLog = console.log;

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
  
  // Test 2: Smart Cache
  consoleLog('\n[2] Testing LLM Caching...');
  
  const mockApiCall = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      content: 'This is a test response',
      usage: { total_tokens: 150, prompt_tokens: 50, completion_tokens: 100 }
    };
  };
  
  try {
    // First call - should miss cache
    consoleLog('- Making first API call (should miss cache)...');
    const start1 = Date.now();
    const result1 = await cacheLlmCall(mockApiCall, {
      cacheKey: 'test-cache-key',
      ttl: 3600000,
      estimatedTokens: 150,
      model: 'test-model'
    });
    consoleLog(`  Response time: ${Date.now() - start1}ms`);
    
    // Second call - should hit cache
    consoleLog('- Making second API call (should hit cache)...');
    const start2 = Date.now();
    const result2 = await cacheLlmCall(mockApiCall, {
      cacheKey: 'test-cache-key',
      ttl: 3600000,
      estimatedTokens: 150,
      model: 'test-model'
    });
    consoleLog(`  Response time: ${Date.now() - start2}ms`);
    
    const cacheStats = smartCache.getStats();
    consoleLog(`- Cache hit rate: ${cacheStats.hitRate}`);
    consoleLog(`- Cache size: ${cacheStats.size} items`);
    
    if (Date.now() - start2 < 100) {
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
    // Set up tiered strategy
    tieredResponseStrategy.configure({
      defaultTier: 'standard',
      budget: {
        daily: 5.0, // $5 daily budget
        monthly: 100.0 // $100 monthly budget
      }
    });
    
    // Get options for different tiers
    const basicOptions = tieredResponseStrategy.getRequestOptions({
      service: 'perplexity',
      query: 'What is the capital of France?',
      forceTier: 'minimal'
    });
    
    const standardOptions = tieredResponseStrategy.getRequestOptions({
      service: 'perplexity',
      query: 'Can you explain how neural networks work?'
    });
    
    const premiumOptions = tieredResponseStrategy.getRequestOptions({
      service: 'perplexity',
      query: 'I need a comprehensive analysis of renewable energy solutions for urban environments, including cost-benefit analysis and implementation strategies.',
      forceTier: 'premium'
    });
    
    consoleLog('- Minimal tier options:');
    consoleLog(`  - Model: ${basicOptions.model}`);
    consoleLog(`  - Token limit: ${basicOptions.tokenLimit}`);
    consoleLog(`  - Cache TTL: ${basicOptions.cacheSettings.ttl / (60 * 60 * 1000)} hours`);
    
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
