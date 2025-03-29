/**
 * llmCacheOptimizer.js
 * 
 * This module provides caching functionality for LLM API calls to reduce costs
 * and improve response times for repeated queries.
 * 
 * The cache is based on the query content and parameters, using a hash function
 * to create cache keys. It includes TTL (time-to-live) functionality to ensure
 * that cached responses don't remain indefinitely.
 */

import crypto from 'crypto';
import logger from './logger.js';

// Cache storage - in production, this would use Redis or another persistent store
const responseCache = new Map();

// Default TTL for cached responses in milliseconds (24 hours)
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

// Configuration
const config = {
  // Whether caching is enabled globally
  enabled: true,
  // The default TTL for cached items
  defaultTtl: DEFAULT_CACHE_TTL,
  // Cache hit rate tracking
  stats: {
    hits: 0,
    misses: 0
  }
};

/**
 * Creates a cache key from query parameters
 * @param {Object} queryParams - The query parameters to hash
 * @returns {string} - A hash string to use as the cache key
 */
function createCacheKey(queryParams) {
  // Create a normalized representation of the query parameters
  const normalized = JSON.stringify({
    query: queryParams.query,
    model: queryParams.model,
    // If there are additional parameters that affect the response, add them here
    ...(queryParams.options || {})
  });
  
  // Create a hash from the normalized string
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Checks if a query should use the cached response
 * @param {Object} queryParams - The query parameters 
 * @returns {boolean} - Whether to use the cache for this query
 */
function shouldUseCache(queryParams) {
  // Global check - if caching is disabled, never use cache
  if (!config.enabled) return false;
  
  // If the query explicitly disables caching, respect that
  if (queryParams.useCache === false) return false;
  
  // If the query is part of a complex research workflow, don't cache
  if (queryParams.deepResearch) return false;
  
  // For all other queries, use the cache
  return true;
}

/**
 * Gets a cached response if available
 * @param {Object} queryParams - The query parameters
 * @returns {Object|null} - The cached response or null if not found
 */
function getCachedResponse(queryParams) {
  if (!shouldUseCache(queryParams)) {
    config.stats.misses++;
    return null;
  }
  
  const cacheKey = createCacheKey(queryParams);
  const cachedItem = responseCache.get(cacheKey);
  
  if (!cachedItem) {
    config.stats.misses++;
    return null;
  }
  
  // Check if the item has expired
  if (Date.now() > cachedItem.expiresAt) {
    // Remove the expired item
    responseCache.delete(cacheKey);
    config.stats.misses++;
    return null;
  }
  
  // Update stats and return the cached response
  config.stats.hits++;
  logger.debug(`Cache hit for query: "${queryParams.query.substring(0, 30)}..."`);
  
  return cachedItem.response;
}

/**
 * Caches a response for future use
 * @param {Object} queryParams - The query parameters
 * @param {Object} response - The response to cache
 * @param {number} [ttl] - Optional TTL in milliseconds (defaults to config.defaultTtl)
 */
function cacheResponse(queryParams, response, ttl = config.defaultTtl) {
  if (!shouldUseCache(queryParams)) return;
  
  const cacheKey = createCacheKey(queryParams);
  
  // Store the response with its expiration time
  responseCache.set(cacheKey, {
    response,
    expiresAt: Date.now() + ttl
  });
  
  logger.debug(`Cached response for query: "${queryParams.query.substring(0, 30)}..."`);
}

/**
 * Clears expired items from the cache
 */
function clearExpiredItems() {
  const now = Date.now();
  let clearedCount = 0;
  
  for (const [key, value] of responseCache.entries()) {
    if (now > value.expiresAt) {
      responseCache.delete(key);
      clearedCount++;
    }
  }
  
  if (clearedCount > 0) {
    logger.debug(`Cleared ${clearedCount} expired items from LLM cache`);
  }
}

/**
 * Returns cache statistics
 * @returns {Object} - Cache statistics
 */
function getStats() {
  const total = config.stats.hits + config.stats.misses;
  const hitRate = total > 0 ? (config.stats.hits / total) * 100 : 0;
  
  return {
    ...config.stats,
    total,
    hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    cacheSize: responseCache.size
  };
}

/**
 * Configures the cache optimizer
 * @param {Object} options - Configuration options
 */
function configure(options = {}) {
  Object.assign(config, options);
  logger.info(`LLM cache optimizer configured: enabled=${config.enabled}, ttl=${config.defaultTtl}ms`);
}

// Set up a periodic task to clean expired items every hour
setInterval(clearExpiredItems, 60 * 60 * 1000);

// Export the public API
export default {
  shouldUseCache,
  getCachedResponse,
  cacheResponse,
  getStats,
  configure,
  clearExpiredItems
};