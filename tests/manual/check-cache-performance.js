/**
 * LLM Cache Performance Checker
 * 
 * This script performs checks on the LLM cache performance and provides
 * diagnostics on how well the caching system is working. It generates
 * a detailed report of cache usage, hit rates, and cost savings.
 */

import { getCacheHitRateStats } from '../../utils/cacheMonitor.js';
import smartCache from '../../utils/smartCache.js';
import { clearLlmCache } from '../../utils/llmCacheOptimizer.js';
import logger from '../../utils/logger.js';

// Disable console logging for cleaner output
logger.transports.forEach(t => {
  if (t.name === 'console') {
    t.silent = true;
  }
});

// Run simple cache diagnostics
async function checkCachePerformance() {
  console.log('\n======================================');
  console.log('     LLM CACHE PERFORMANCE CHECK');
  console.log('======================================\n');
  
  // Get cache stats from both the monitor and smartCache
  const monitorStats = getCacheHitRateStats(true);
  const cacheStats = smartCache.getStats();
  
  // Calculate total lookups and hit rate from smart cache
  const totalSmartCacheLookups = cacheStats.exactHits + cacheStats.fuzzyHits + cacheStats.misses;
  const smartCacheHitRate = totalSmartCacheLookups === 0 
    ? 0 
    : ((cacheStats.exactHits + cacheStats.fuzzyHits) / totalSmartCacheLookups) * 100;
  
  // Overall cache performance (using smart cache stats primarily)
  console.log('[1] OVERALL CACHE PERFORMANCE');
  console.log(`- Total lookups (Smart Cache): ${totalSmartCacheLookups}`);
  console.log(`- Cache hits (Smart Cache): ${cacheStats.exactHits + cacheStats.fuzzyHits}`);
  console.log(`  - Exact hits: ${cacheStats.exactHits}`);
  console.log(`  - Fuzzy hits: ${cacheStats.fuzzyHits}`);
  console.log(`- Cache misses (Smart Cache): ${cacheStats.misses}`);
  console.log(`- Hit rate (Smart Cache): ${smartCacheHitRate.toFixed(2)}%`);
  console.log(`- Cache size: ${cacheStats.size}/${cacheStats.maxSize} (${cacheStats.utilization} utilized)`);
  
  // Also show monitor stats for comparison
  console.log(`- Monitor total lookups: ${monitorStats.totalLookups}`);
  console.log(`- Monitor hits: ${monitorStats.hits}`);
  console.log(`- Monitor misses: ${monitorStats.misses}`);
  console.log(`- Monitor hit rate: ${monitorStats.hitRate.toFixed(2)}%`);
  
  if (totalSmartCacheLookups === 0) {
    console.log('  ⚠️ No cache lookups recorded yet. LLM caching may not be properly integrated.');
  } else if (cacheStats.exactHits + cacheStats.fuzzyHits === 0 && cacheStats.misses > 10) {
    console.log('  ⚠️ Zero cache hits despite multiple lookups. Cache may not be working correctly.');
  } else if (smartCacheHitRate < 20 && totalSmartCacheLookups > 10) {
    console.log('  ⚠️ Low hit rate. Consider increasing cache TTL or improving cache key generation.');
  } else if (smartCacheHitRate > 60) {
    console.log('  ✅ Excellent hit rate! Cache is working effectively.');
  }
  
  // Service-specific performance
  console.log('\n[2] SERVICE-SPECIFIC PERFORMANCE');
  
  if (monitorStats.detailed) {
    // Claude performance
    console.log('- Claude Service:');
    console.log(`  - Hits: ${monitorStats.serviceBreakdown.claude.hits}`);
    console.log(`  - Misses: ${monitorStats.serviceBreakdown.claude.misses}`);
    console.log(`  - Hit rate: ${monitorStats.detailed.hitRateByService.claude.toFixed(2)}%`);
    console.log(`  - Tokens saved: ${monitorStats.serviceBreakdown.claude.tokensSaved.toLocaleString()}`);
    console.log(`  - Estimated cost saved: $${monitorStats.detailed.savingsByService.claude.toFixed(4)}`);
    
    // Perplexity performance
    console.log('- Perplexity Service:');
    console.log(`  - Hits: ${monitorStats.serviceBreakdown.perplexity.hits}`);
    console.log(`  - Misses: ${monitorStats.serviceBreakdown.perplexity.misses}`);
    console.log(`  - Hit rate: ${monitorStats.detailed.hitRateByService.perplexity.toFixed(2)}%`);
    console.log(`  - Tokens saved: ${monitorStats.serviceBreakdown.perplexity.tokensSaved.toLocaleString()}`);
    console.log(`  - Estimated cost saved: $${monitorStats.detailed.savingsByService.perplexity.toFixed(4)}`);
  } else {
    console.log('- Detailed monitor stats not available. Run with getCacheHitRateStats(true) to see service breakdown.');
  }
  
  // Cache memory usage
  console.log('\n[3] CACHE MEMORY USAGE');
  console.log(`- Estimated size in memory: ${cacheStats.estimatedSizeKB} KB`);
  console.log(`- Cache uptime: ${cacheStats.uptime}`);
  console.log(`- Evictions: LRU=${cacheStats.evictions.lru}, Expired=${cacheStats.evictions.expired}, Memory=${cacheStats.evictions.memory}`);
  
  if (cacheStats.estimatedSizeKB > 5000) {
    console.log('  ⚠️ Large cache size. Consider more frequent cleanup or lower TTL values.');
  }
  
  // Cost savings summary
  console.log('\n[4] COST SAVINGS SUMMARY');
  console.log(`- Total estimated tokens saved: ${monitorStats.estimatedTokensSaved.toLocaleString()}`);
  console.log(`- Total estimated cost saved: $${monitorStats.estimatedCostSavings.toFixed(4)}`);
  
  // Settings check
  console.log('\n[5] CACHE SETTINGS CHECK');
  console.log(`- Fuzzy matching: ${smartCache.enableFuzzyMatch ? 'Enabled' : 'Disabled'} (threshold: ${smartCache.fuzzyMatchThreshold})`);
  console.log(`- Default TTL: ${smartCache.defaultTTL / (60 * 60 * 1000)} hours`);
  console.log(`- Memory limit: ${smartCache.memoryLimitMB} MB`);
  console.log(`- Low memory mode: ${smartCache.lowMemoryMode ? 'Enabled' : 'Disabled'}`);
  
  // Recommendations
  console.log('\n[6] RECOMMENDATIONS');
  
  if (smartCacheHitRate < 20 && totalSmartCacheLookups > 10) {
    console.log('- ⚠️ Increase cache TTL for better hit rates');
    console.log('- ⚠️ Review cache key generation for more consistent keys');
    console.log('- ⚠️ Ensure all appropriate service methods are using caching');
  } else if (cacheStats.evictions.memory > 10) {
    console.log('- ⚠️ Reduce cache TTL to prevent excessive memory usage');
    console.log('- ⚠️ Consider enabling low memory mode');
    console.log('- ⚠️ Increase memory limit if resources allow');
  } else if (smartCacheHitRate > 60 && totalSmartCacheLookups > 10) {
    console.log('- ✅ Cache is performing well! Consider these optimizations:');
    console.log('  - Fine-tune fuzzy matching threshold for even better hit rates');
    console.log('  - Add more services or methods to caching system');
  } else {
    console.log('- Not enough data to make recommendations. Generate more cache activity.');
  }
  
  console.log('\n======================================');
  console.log('     CACHE PERFORMANCE SUMMARY');
  console.log('======================================');
  
  // Overall assessment
  if (smartCacheHitRate > 50 && totalSmartCacheLookups > 10) {
    console.log('✅ EXCELLENT: Cache is working effectively with high hit rates');
  } else if (smartCacheHitRate > 30 && totalSmartCacheLookups > 10) {
    console.log('✓ GOOD: Cache is working with moderate hit rates');
  } else if (totalSmartCacheLookups > 10) {
    console.log('⚠️ NEEDS IMPROVEMENT: Cache has low hit rates');
  } else {
    console.log('ℹ️ INSUFFICIENT DATA: Not enough cache activity to assess');
  }
  
  console.log('======================================');
}

// Run the check
checkCachePerformance().catch(error => {
  console.error('Error in cache performance check:', error);
});