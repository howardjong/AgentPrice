
/**
 * Cache Monitor Utility
 * 
 * Provides tracking and statistics for cache performance to optimize API usage
 * and reduce costs.
 */

import logger from './logger.js';

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  totalLookups: 0,
  
  // Token tracking for cost estimation
  tokensSaved: 0,
  
  // Service-specific stats
  serviceStats: {
    claude: { hits: 0, misses: 0, tokensSaved: 0 },
    perplexity: { hits: 0, misses: 0, tokensSaved: 0 }
  },
  
  // Cost estimation rates ($/1K tokens)
  costRates: {
    claude: 0.025, // $0.025 per 1K tokens for Claude 3.5 Haiku (output)
    perplexity: 0.015 // $0.015 per 1K tokens for Perplexity
  }
};

/**
 * Record a cache hit
 * @param {string} service - Service name (claude, perplexity)
 * @param {number} tokensSaved - Estimated tokens saved (optional)
 */
function recordCacheHit(service = 'unknown', tokensSaved = 0) {
  cacheStats.hits++;
  cacheStats.totalLookups++;
  cacheStats.tokensSaved += tokensSaved;
  
  // Record service-specific stats
  if (cacheStats.serviceStats[service]) {
    cacheStats.serviceStats[service].hits++;
    cacheStats.serviceStats[service].tokensSaved += tokensSaved;
  }
  
  logger.debug(`Cache hit recorded for ${service}`, {
    service: 'multi-llm-research',
    component: 'cacheMonitor',
    tokensSaved
  });
}

/**
 * Record a cache miss
 * @param {string} service - Service name (claude, perplexity)
 */
function recordCacheMiss(service = 'unknown') {
  cacheStats.misses++;
  cacheStats.totalLookups++;
  
  // Record service-specific stats
  if (cacheStats.serviceStats[service]) {
    cacheStats.serviceStats[service].misses++;
  }
  
  logger.debug(`Cache miss recorded for ${service}`, {
    service: 'multi-llm-research',
    component: 'cacheMonitor'
  });
}

/**
 * Get cache hit rate statistics
 * @param {boolean} detailed - Whether to include detailed stats
 * @returns {Object} Cache statistics including hit rate
 */
function getCacheHitRateStats(detailed = false) {
  const hitRate = cacheStats.totalLookups === 0 
    ? 0 
    : (cacheStats.hits / cacheStats.totalLookups) * 100;
  
  // Calculate estimated cost savings
  const estimatedCostSavings = 
    (cacheStats.serviceStats.claude.tokensSaved / 1000) * cacheStats.costRates.claude +
    (cacheStats.serviceStats.perplexity.tokensSaved / 1000) * cacheStats.costRates.perplexity;
  
  const stats = {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    totalLookups: cacheStats.totalLookups,
    hitRate,
    estimatedTokensSaved: cacheStats.tokensSaved,
    estimatedCostSavings,
    serviceBreakdown: cacheStats.serviceStats
  };
  
  if (detailed) {
    // Add more detailed statistics
    stats.detailed = {
      costRates: cacheStats.costRates,
      savingsByService: {
        claude: (cacheStats.serviceStats.claude.tokensSaved / 1000) * cacheStats.costRates.claude,
        perplexity: (cacheStats.serviceStats.perplexity.tokensSaved / 1000) * cacheStats.costRates.perplexity
      },
      hitRateByService: {
        claude: cacheStats.serviceStats.claude.hits + cacheStats.serviceStats.claude.misses > 0 
          ? (cacheStats.serviceStats.claude.hits / (cacheStats.serviceStats.claude.hits + cacheStats.serviceStats.claude.misses)) * 100 
          : 0,
        perplexity: cacheStats.serviceStats.perplexity.hits + cacheStats.serviceStats.perplexity.misses > 0 
          ? (cacheStats.serviceStats.perplexity.hits / (cacheStats.serviceStats.perplexity.hits + cacheStats.serviceStats.perplexity.misses)) * 100 
          : 0
      }
    };
  }
  
  return stats;
}

/**
 * Reset cache statistics
 */
function resetCacheStats() {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.totalLookups = 0;
  cacheStats.tokensSaved = 0;
  
  // Reset service-specific stats
  Object.keys(cacheStats.serviceStats).forEach(service => {
    cacheStats.serviceStats[service] = { hits: 0, misses: 0, tokensSaved: 0 };
  });
  
  logger.info('Cache statistics reset', {
    service: 'multi-llm-research',
    component: 'cacheMonitor'
  });
}

// Initialize and export
export {
  recordCacheHit,
  recordCacheMiss,
  getCacheHitRateStats,
  resetCacheStats
};

export default {
  recordCacheHit,
  recordCacheMiss,
  getCacheHitRateStats,
  resetCacheStats
};
