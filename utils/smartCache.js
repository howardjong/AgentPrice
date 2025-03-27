
/**
 * Smart caching utility with advanced features
 * - Time-based expiration
 * - LRU eviction policy
 * - Size-aware storage
 * - Query similarity matching
 */
import logger from './logger.js';

class SmartCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 500; // Maximum number of items
    this.defaultTTL = options.defaultTTL || 24 * 60 * 60 * 1000; // 24 hours in ms
    this.cache = new Map();
    this.keyTimestamps = new Map(); // For LRU tracking
    this.hitCount = 0;
    this.missCount = 0;
    this.fuzzyMatchThreshold = options.fuzzyMatchThreshold || 0.85; // Similarity threshold
    this.enableFuzzyMatch = options.enableFuzzyMatch !== false;
    this.stats = {
      created: Date.now(),
      exactHits: 0,
      fuzzyHits: 0,
      misses: 0,
      evictions: {
        lru: 0,
        expired: 0,
        manual: 0
      }
    };
    
    // Clean expired items every hour
    this.cleanupInterval = setInterval(() => this.removeExpiredItems(), 60 * 60 * 1000);
  }
  
  /**
   * Set a cache item with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in ms (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    // Check if we need to evict items
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    // Create cache entry
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiresAt,
      size: this.estimateSize(value),
      accessCount: 0
    });
    
    // Update LRU tracking
    this.keyTimestamps.set(key, Date.now());
    
    logger.debug(`Cache item set: ${key.substring(0, 40)}...`, {
      ttl: `${Math.round(ttl / 1000 / 60)} minutes`,
      cacheSize: this.cache.size
    });
    
    return true;
  }
  
  /**
   * Get a value from cache with exact match
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.missCount++;
      return null;
    }
    
    // Check if item has expired
    if (item.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.keyTimestamps.delete(key);
      this.stats.evictions.expired++;
      this.stats.misses++;
      this.missCount++;
      return null;
    }
    
    // Update access stats
    item.accessCount++;
    this.keyTimestamps.set(key, Date.now());
    this.stats.exactHits++;
    this.hitCount++;
    
    return item.value;
  }
  
  /**
   * Find best matching cache entry for a query
   * @param {string} query - Query to find similar matches for
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Object|null} Best matching result or null
   */
  findSimilar(query, threshold = this.fuzzyMatchThreshold) {
    if (!this.enableFuzzyMatch || this.cache.size === 0) {
      return null;
    }
    
    let bestMatch = null;
    let highestSimilarity = threshold;
    
    // Normalize query for comparison
    const normalizedQuery = this.normalizeForComparison(query);
    
    // Check each cached item for similarity
    for (const [key, item] of this.cache.entries()) {
      // Skip expired items
      if (item.expiresAt < Date.now()) {
        continue;
      }
      
      // Calculate similarity
      const normalizedKey = this.normalizeForComparison(key);
      const similarity = this.calculateSimilarity(normalizedQuery, normalizedKey);
      
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = {
          key,
          value: item.value,
          similarity
        };
      }
    }
    
    if (bestMatch) {
      // Update access stats for the matched item
      const item = this.cache.get(bestMatch.key);
      item.accessCount++;
      this.keyTimestamps.set(bestMatch.key, Date.now());
      this.stats.fuzzyHits++;
      this.hitCount++;
      
      logger.debug(`Cache fuzzy match found: ${bestMatch.similarity.toFixed(2)} similarity`, {
        query: query.substring(0, 30),
        matchKey: bestMatch.key.substring(0, 30)
      });
    }
    
    return bestMatch;
  }
  
  /**
   * Find or create a cache entry
   * @param {string} key - Cache key
   * @param {Function} valueFactory - Function to create value if not cached
   * @param {number} ttl - Time to live in ms (optional)
   * @returns {Object} Cached value and status
   */
  async getOrCreate(key, valueFactory, ttl = this.defaultTTL) {
    // Try exact match first
    const exactMatch = this.get(key);
    if (exactMatch) {
      return {
        value: exactMatch,
        cached: true,
        source: 'exact-match'
      };
    }
    
    // Try fuzzy match if enabled
    if (this.enableFuzzyMatch) {
      const similarMatch = this.findSimilar(key);
      if (similarMatch) {
        return {
          value: similarMatch.value,
          cached: true,
          source: 'fuzzy-match',
          similarity: similarMatch.similarity
        };
      }
    }
    
    // Cache miss - create new value
    try {
      const startTime = Date.now();
      const value = await valueFactory();
      const duration = Date.now() - startTime;
      
      // Cache the result
      this.set(key, value, ttl);
      
      logger.debug(`Cache miss, created new value in ${duration}ms: ${key.substring(0, 40)}...`);
      
      return {
        value,
        cached: false,
        source: 'created',
        duration
      };
    } catch (error) {
      logger.error(`Error creating cache value for ${key}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Remove expired items
   * @returns {number} Number of items removed
   */
  removeExpiredItems() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        this.cache.delete(key);
        this.keyTimestamps.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.stats.evictions.expired += removed;
      logger.debug(`Removed ${removed} expired cache items`, {
        remaining: this.cache.size
      });
    }
    
    return removed;
  }
  
  /**
   * Evict least recently used items
   * @param {number} count - Number of items to evict
   * @returns {number} Number of items evicted
   */
  evictLRU(count = 1) {
    if (this.cache.size === 0) return 0;
    
    // Sort keys by timestamp (oldest first)
    const sortedKeys = [...this.keyTimestamps.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(entry => entry[0]);
    
    // Evict the oldest items
    const evictCount = Math.min(count, sortedKeys.length);
    for (let i = 0; i < evictCount; i++) {
      const key = sortedKeys[i];
      this.cache.delete(key);
      this.keyTimestamps.delete(key);
    }
    
    this.stats.evictions.lru += evictCount;
    
    if (evictCount > 0) {
      logger.debug(`Evicted ${evictCount} LRU cache items`, {
        reason: 'cache-full',
        remaining: this.cache.size
      });
    }
    
    return evictCount;
  }
  
  /**
   * Calculate similarity between two strings (0-1)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    // Simple Jaccard similarity for word sets
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    // Count intersections
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Normalize string for better comparison
   * @param {string} str - String to normalize
   * @returns {string} Normalized string
   */
  normalizeForComparison(str) {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }
  
  /**
   * Estimate size of value in bytes (approximate)
   * @param {any} value - Value to estimate size of
   * @returns {number} Approximate size in bytes
   */
  estimateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // Approximate UTF-16 encoding
    }
    
    if (typeof value === 'number') {
      return 8; // 64-bit number
    }
    
    if (value === null || value === undefined) {
      return 0;
    }
    
    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        return json.length * 2;
      } catch (e) {
        return 1000; // Fallback estimate
      }
    }
    
    return 100; // Default estimate
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const totalRequests = this.stats.exactHits + this.stats.fuzzyHits + this.stats.misses;
    const hitRate = totalRequests > 0 ? 
      ((this.stats.exactHits + this.stats.fuzzyHits) / totalRequests) * 100 : 0;
    
    // Calculate total size estimate
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size;
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: `${(this.cache.size / this.maxSize * 100).toFixed(1)}%`,
      hitRate: `${hitRate.toFixed(1)}%`,
      exactHits: this.stats.exactHits,
      fuzzyHits: this.stats.fuzzyHits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      estimatedSizeKB: Math.round(totalSize / 1024),
      uptime: `${Math.round((Date.now() - this.stats.created) / 1000 / 60)} minutes`
    };
  }
  
  /**
   * Clear the cache
   * @returns {number} Number of items cleared
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.keyTimestamps.clear();
    this.stats.evictions.manual += size;
    
    logger.info(`Cache cleared: ${size} items removed`);
    
    return size;
  }
  
  /**
   * Stop the cache cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

const smartCache = new SmartCache();
export default smartCache;
