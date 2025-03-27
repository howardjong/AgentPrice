
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
    this.maxSize = options.maxSize || 250; // Reduced maximum number of items
    this.defaultTTL = options.defaultTTL || 4 * 60 * 60 * 1000; // 4 hours in ms (reduced from 24)
    this.cache = new Map();
    this.keyTimestamps = new Map(); // For LRU tracking
    this.hitCount = 0;
    this.missCount = 0;
    this.fuzzyMatchThreshold = options.fuzzyMatchThreshold || 0.85; // Similarity threshold
    this.enableFuzzyMatch = options.enableFuzzyMatch !== false;
    
    // Add memory-sensitive options
    this.memoryLimitMB = options.memoryLimitMB || 50; // Memory limit in MB
    this.lowMemoryMode = options.lowMemoryMode || false; // Disable extra features in low memory
    this.aggressiveEviction = options.aggressiveEviction || false; // Evict more items when memory is low
    
    this.stats = {
      created: Date.now(),
      exactHits: 0,
      fuzzyHits: 0,
      misses: 0,
      evictions: {
        lru: 0,
        expired: 0,
        manual: 0,
        memory: 0
      }
    };
    
    // More frequent cleanup in low memory mode
    const cleanupInterval = this.lowMemoryMode ? 15 * 60 * 1000 : 60 * 60 * 1000;
    this.cleanupInterval = setInterval(() => this.removeExpiredItems(), cleanupInterval);
    
    // Add memory check interval (every 5 minutes)
    this.memoryCheckInterval = setInterval(() => this.checkMemoryUsage(), 5 * 60 * 1000);
  }
  
  /**
   * Configure the cache with new options
   * @param {Object} options - Configuration options
   * @returns {SmartCache} this instance for chaining
   */
  configure(options = {}) {
    // Update cache size
    if (options.maxSize !== undefined) {
      this.maxSize = options.maxSize;
    }
    
    // Update TTL
    if (options.ttl !== undefined) {
      this.defaultTTL = options.ttl;
    }
    
    // Update cleanup interval
    if (options.cleanInterval !== undefined) {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      this.cleanupInterval = setInterval(() => this.removeExpiredItems(), options.cleanInterval);
    }
    
    // Update fuzzy matching
    if (options.fuzzyMatchThreshold !== undefined) {
      this.fuzzyMatchThreshold = options.fuzzyMatchThreshold;
    }
    
    if (options.enableFuzzyMatch !== undefined) {
      this.enableFuzzyMatch = options.enableFuzzyMatch;
    }
    
    // Update memory settings
    if (options.memoryLimitMB !== undefined) {
      this.memoryLimitMB = options.memoryLimitMB;
    }
    
    if (options.lowMemoryMode !== undefined) {
      this.lowMemoryMode = options.lowMemoryMode;
      
      // If switching to low memory mode, force cleanup
      if (options.lowMemoryMode === true) {
        this.checkMemoryUsage();
      }
    }
    
    if (options.aggressiveEviction !== undefined) {
      this.aggressiveEviction = options.aggressiveEviction;
    }
    
    logger.info('Smart cache configured', {
      maxSize: this.maxSize,
      defaultTTL: `${Math.round(this.defaultTTL / 1000 / 60)} minutes`,
      enableFuzzyMatch: this.enableFuzzyMatch,
      memoryLimitMB: this.memoryLimitMB,
      lowMemoryMode: this.lowMemoryMode
    });
    
    return this;
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

  /**
   * Check memory usage and evict items if necessary
   */
  checkMemoryUsage() {
    try {
      // Get current memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // Calculate total cache size estimate
      let totalSizeBytes = 0;
      for (const item of this.cache.values()) {
        totalSizeBytes += item.size;
      }
      const cacheSizeMB = Math.round(totalSizeBytes / 1024 / 1024);
      
      // If total heap usage is high or cache size is above limit
      if (cacheSizeMB > this.memoryLimitMB || heapUsedMB > 150) {
        const itemsToEvict = Math.max(
          5,
          Math.ceil(this.cache.size * 0.2) // Evict at least 20% of items
        );
        
        logger.info('Cache memory limit reached, evicting items', {
          cacheSizeMB,
          heapUsedMB,
          itemsToEvict,
          totalItems: this.cache.size
        });
        
        this.evictLRU(itemsToEvict);
        this.stats.evictions.memory += itemsToEvict;
        
        // Disable fuzzy matching temporarily if memory is critically high
        if (heapUsedMB > 200) {
          const wasEnabled = this.enableFuzzyMatch;
          this.enableFuzzyMatch = false;
          
          // Re-enable after 5 minutes
          if (wasEnabled) {
            setTimeout(() => {
              this.enableFuzzyMatch = true;
              logger.info('Re-enabled fuzzy matching after memory pressure decreased');
            }, 5 * 60 * 1000);
          }
        }
      }
    } catch (error) {
      logger.error('Error checking memory usage', { error: error.message });
    }
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.keyTimestamps.clear();
    this.stats.evictions.manual += size;
    
    logger.info(`Cache cleared: ${size} items removed`);
    
    return size;
  }
  
  /**
   * Stop the cache cleanup and release resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    // Clear all cache data to free memory
    this.cache.clear();
    this.keyTimestamps.clear();
    
    logger.info('Cache destroyed, all resources released');
  }
}

const smartCache = new SmartCache();
export default smartCache;
/**
 * Smart Cache
 * Memory-efficient caching system with automatic cleanup
 */
import logger from './logger.js';

class SmartCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 60 * 60 * 1000; // 1 hour default
    this.cleanInterval = options.cleanInterval || 5 * 60 * 1000; // 5 minutes
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      cleanupRuns: 0
    };
    
    // Start automatic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), this.cleanInterval);
    
    // Use WeakMap for metadata to reduce memory pressure
    this.metadata = new WeakMap();
  }
  
  /**
   * Configure cache settings
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    if (options.maxSize) {
      // If reducing size, trigger cleanup to match new limit
      const needsCleanup = options.maxSize < this.maxSize;
      this.maxSize = options.maxSize;
      if (needsCleanup && this.cache.size > this.maxSize) {
        this.cleanup(true);
      }
    }
    
    if (options.ttl) {
      this.ttl = options.ttl;
    }
    
    if (options.cleanInterval) {
      this.cleanInterval = options.cleanInterval;
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = setInterval(() => this.cleanup(), this.cleanInterval);
    }
    
    logger.info('Smart cache configured', {
      maxSize: this.maxSize,
      ttl: `${this.ttl / 1000}s`,
      cleanInterval: `${this.cleanInterval / 1000}s`,
      currentSize: this.cache.size
    });
    
    return this;
  }
  
  /**
   * Set a cache item
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttl] - Optional TTL override
   */
  set(key, value, ttl = null) {
    // Skip if value is undefined/null to save memory
    if (value === undefined || value === null) {
      return;
    }
    
    const now = Date.now();
    const expiry = now + (ttl || this.ttl);
    
    // Handle max size before adding new items
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    // Store value with metadata
    this.cache.set(key, value);
    this.metadata.set(value, {
      key,
      expiry,
      lastAccessed: now
    });
    
    return value;
  }
  
  /**
   * Get a cache item
   * @param {string} key - Cache key
   * @param {boolean} touch - Update last accessed time
   * @returns {any} Cached value or undefined
   */
  get(key, touch = true) {
    const value = this.cache.get(key);
    
    if (value === undefined) {
      this.stats.misses++;
      return undefined;
    }
    
    const meta = this.metadata.get(value);
    
    // Return undefined if expired
    if (meta && meta.expiry < Date.now()) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return undefined;
    }
    
    // Update last accessed time
    if (touch && meta) {
      meta.lastAccessed = Date.now();
    }
    
    this.stats.hits++;
    return value;
  }
  
  /**
   * Check if cache has valid key
   * @param {string} key - Cache key
   * @returns {boolean} True if exists and not expired
   */
  has(key) {
    const value = this.cache.get(key);
    
    if (value === undefined) {
      return false;
    }
    
    const meta = this.metadata.get(value);
    return meta && meta.expiry >= Date.now();
  }
  
  /**
   * Delete a cache item
   * @param {string} key - Cache key
   * @returns {boolean} True if removed
   */
  delete(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      return true;
    }
    return false;
  }
  
  /**
   * Clear all cache items
   */
  clear() {
    this.cache.clear();
    return true;
  }
  
  /**
   * Evict oldest item by last accessed time
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    // Find oldest item
    for (const [key, value] of this.cache.entries()) {
      const meta = this.metadata.get(value);
      if (meta && meta.lastAccessed < oldestTime) {
        oldestKey = key;
        oldestTime = meta.lastAccessed;
      }
    }
    
    // Remove oldest item
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }
  
  /**
   * Clean expired items
   * @param {boolean} force - Force cleanup even if under max size
   */
  cleanup(force = false) {
    const now = Date.now();
    const startSize = this.cache.size;
    
    // Skip if cache is empty
    if (startSize === 0) return;
    
    // Skip cleanup if under 80% capacity and not forced
    if (!force && startSize < this.maxSize * 0.8) {
      return;
    }
    
    // Find and remove expired items
    const toDelete = [];
    
    for (const [key, value] of this.cache.entries()) {
      const meta = this.metadata.get(value);
      if (meta && meta.expiry < now) {
        toDelete.push(key);
      }
    }
    
    // Delete expired items
    for (const key of toDelete) {
      this.cache.delete(key);
    }
    
    this.stats.evictions += toDelete.length;
    this.stats.cleanupRuns++;
    
    // If we're still over capacity, evict by LRU
    if (force && this.cache.size > this.maxSize) {
      // Sort all items by last accessed time
      const items = [];
      
      for (const [key, value] of this.cache.entries()) {
        const meta = this.metadata.get(value);
        if (meta) {
          items.push([key, meta.lastAccessed]);
        }
      }
      
      // Sort by last accessed (oldest first)
      items.sort((a, b) => a[1] - b[1]);
      
      // Delete oldest items until we're under maxSize
      const toRemove = Math.max(0, this.cache.size - this.maxSize);
      for (let i = 0; i < toRemove && i < items.length; i++) {
        this.cache.delete(items[i][0]);
        this.stats.evictions++;
      }
    }
    
    const removedCount = startSize - this.cache.size;
    
    if (removedCount > 0) {
      logger.debug('Cache cleanup', {
        removed: removedCount,
        newSize: this.cache.size
      });
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1) 
      : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      cleanupRuns: this.stats.cleanupRuns
    };
  }
  
  /**
   * Stop the cache cleanup process
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

const smartCache = new SmartCache();
export default smartCache;
