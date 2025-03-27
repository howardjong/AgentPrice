
/**
 * Cache Monitor Utility
 * 
 * This utility helps track cache hits and misses to optimize API call efficiency
 */

import logger from './logger.js';
import redisService from '../services/redisService.js';

class CacheMonitor {
  constructor() {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      estimatedSavings: 0,
      byService: {
        perplexity: { hits: 0, misses: 0, estimatedCost: 0.0002 }, // $0.0002 per request estimated
        claude: { hits: 0, misses: 0, estimatedCost: 0.0003 }     // $0.0003 per request estimated
      }
    };

    // Reset stats periodically
    setInterval(() => this.logStats(), 3600000); // Log every hour
  }

  /**
   * Record a cache hit (successful cache retrieval)
   * @param {string} service - The service name (perplexity, claude, etc.)
   * @param {string} cacheKey - The cache key that was hit
   */
  recordHit(service, cacheKey) {
    this.stats.hits++;
    
    if (this.stats.byService[service]) {
      this.stats.byService[service].hits++;
      // Calculate estimated savings based on service cost
      const estimatedSaving = this.stats.byService[service].estimatedCost || 0.0001;
      this.stats.estimatedSavings += estimatedSaving;
    }
    
    logger.debug(`Cache HIT for ${service}`, { cacheKey, service });
  }

  /**
   * Record a cache miss (cache lookup failed, API call required)
   * @param {string} service - The service name (perplexity, claude, etc.)
   * @param {string} cacheKey - The cache key that was missed
   */
  recordMiss(service, cacheKey) {
    this.stats.misses++;
    
    if (this.stats.byService[service]) {
      this.stats.byService[service].misses++;
    }
    
    logger.debug(`Cache MISS for ${service}`, { cacheKey, service });
  }

  /**
   * Record a cache error
   * @param {string} service - The service name
   * @param {Error} error - The error that occurred
   */
  recordError(service, error) {
    this.stats.errors++;
    logger.warn(`Cache error for ${service}`, { error: error.message, service });
  }

  /**
   * Get the current cache effectiveness stats
   * @returns {Object} Cache statistics
   */
  getStats() {
    const totalLookups = this.stats.hits + this.stats.misses;
    const hitRate = totalLookups > 0 ? (this.stats.hits / totalLookups) * 100 : 0;
    
    return {
      ...this.stats,
      totalLookups,
      hitRate: hitRate.toFixed(2) + '%',
      estimatedSavings: '$' + this.stats.estimatedSavings.toFixed(4)
    };
  }

  /**
   * Log current cache statistics
   */
  logStats() {
    const stats = this.getStats();
    
    logger.info('Cache effectiveness statistics', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      estimatedSavings: stats.estimatedSavings
    });
    
    // Reset stats after logging if needed
    // this.resetStats();
  }

  /**
   * Reset statistics counters
   */
  resetStats() {
    const previousSavings = this.stats.estimatedSavings;
    
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      estimatedSavings: 0,
      byService: {
        perplexity: { hits: 0, misses: 0, estimatedCost: 0.0002 },
        claude: { hits: 0, misses: 0, estimatedCost: 0.0003 }
      },
      previousPeriodSavings: previousSavings
    };
    
    logger.info('Cache statistics reset', { previousSavings: '$' + previousSavings.toFixed(4) });
  }

  /**
   * Helper method to check if a key exists in cache
   * @param {string} cacheKey - The key to check
   * @param {string} service - The service name for statistics
   * @returns {Promise<boolean>} Whether the key exists
   */
  async exists(cacheKey, service = 'unknown') {
    try {
      const client = await redisService.getClient();
      const exists = await client.exists(cacheKey);
      
      if (exists) {
        this.recordHit(service, cacheKey);
        return true;
      } else {
        this.recordMiss(service, cacheKey);
        return false;
      }
    } catch (error) {
      this.recordError(service, error);
      return false;
    }
  }
}

export default new CacheMonitor();
