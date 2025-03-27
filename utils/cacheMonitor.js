/**
 * Cache Monitor Utility
 * 
 * This module tracks cache usage statistics and estimates cost savings from cache hits.
 */

class CacheMonitor {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.totalLookups = 0;
    // Cost estimate per API call (in cents)
    this.apiCallCost = 0.5;
  }

  recordHit() {
    this.hits++;
    this.totalLookups++;
    return true;
  }

  recordMiss() {
    this.misses++;
    this.totalLookups++;
    return false;
  }

  getStats() {
    const hitRate = this.totalLookups === 0 
      ? 0 
      : (this.hits / this.totalLookups * 100).toFixed(2) + '%';

    // Calculate estimated cost savings (hits × cost per call)
    const estimatedSavings = `$${((this.hits * this.apiCallCost) / 100).toFixed(2)}`;

    return {
      hits: this.hits,
      misses: this.misses,
      totalLookups: this.totalLookups,
      hitRate,
      estimatedSavings
    };
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.totalLookups = 0;
  }
}

// Export a singleton instance
export default new CacheMonitor();