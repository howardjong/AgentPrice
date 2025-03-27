
/**
 * Enhanced Cache with Document Fingerprinting
 * 
 * Extends SmartCache with document fingerprinting capabilities
 * for better similarity matching and chunking support.
 */
import smartCache from './smartCache.js';
import documentFingerprinter from './documentFingerprinter.js';
import logger from './logger.js';

/**
 * Store item with document fingerprinting
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {Object} options - Cache options
 * @returns {boolean} Success status
 */
function setWithFingerprint(key, value, options = {}) {
  try {
    // Extract content for fingerprinting if applicable
    let content = value;
    let fingerprintField = options.fingerprintField || 'content';
    
    // Handle objects with nested content fields
    if (typeof value === 'object' && value !== null) {
      content = value[fingerprintField] || JSON.stringify(value);
    }
    
    // Generate fingerprint
    let fingerprint = null;
    if (typeof content === 'string') {
      fingerprint = documentFingerprinter.generateFingerprint(content);
    }
    
    // Prepare metadata wrapper
    const enhancedValue = {
      originalValue: value,
      metadata: {
        fingerprint,
        createdAt: Date.now(),
        size: smartCache.estimateSize(value),
        tags: options.tags || []
      }
    };
    
    // Store in cache
    return smartCache.set(key, enhancedValue, options.ttl);
  } catch (error) {
    logger.error('Error storing item with fingerprint', { error: error.message });
    // Fall back to regular cache storage
    return smartCache.set(key, value, options.ttl);
  }
}

/**
 * Get item with similar content matching
 * @param {string} key - Cache key
 * @param {Object} options - Retrieval options
 * @returns {any} Cached value or null
 */
function getWithSimilarityMatch(key, options = {}) {
  try {
    // Try exact match first
    const exactMatch = smartCache.get(key);
    if (exactMatch) {
      if (exactMatch.metadata && exactMatch.originalValue) {
        return {
          value: exactMatch.originalValue,
          source: 'exact-match',
          metadata: exactMatch.metadata
        };
      }
      return { value: exactMatch, source: 'exact-match' };
    }
    
    // If not found and similarity matching is enabled, try content-based matching
    if (options.enableSimilarityMatch !== false) {
      const queryContent = options.queryContent || key;
      
      // Skip similarity matching for short queries
      if (typeof queryContent !== 'string' || queryContent.length < 20) {
        return null;
      }
      
      // Generate fingerprint for the query
      const queryFingerprint = documentFingerprinter.generateFingerprint(queryContent);
      
      // Find similar cached items from current cache
      let bestMatch = null;
      let highestSimilarity = options.similarityThreshold || 0.85;
      
      // Check each cached item for similarity
      for (const [cachedKey, cachedItem] of smartCache.cache.entries()) {
        // Skip expired items
        if (cachedItem.expiresAt < Date.now()) {
          continue;
        }
        
        // Skip items without fingerprint metadata
        if (!cachedItem.value || 
            !cachedItem.value.metadata || 
            !cachedItem.value.metadata.fingerprint) {
          continue;
        }
        
        // Calculate similarity with query
        const { similarity, isMatch } = documentFingerprinter.compareDocs(
          queryFingerprint, 
          cachedItem.value.metadata.fingerprint
        );
        
        // Update best match if similarity is higher
        if (isMatch && similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = {
            key: cachedKey,
            value: cachedItem.value.originalValue,
            similarity,
            metadata: cachedItem.value.metadata
          };
        }
      }
      
      // Return best match if found
      if (bestMatch) {
        logger.debug(`Cache similarity match found: ${bestMatch.similarity.toFixed(2)} similarity`, {
          query: queryContent.substring(0, 30),
          matchKey: bestMatch.key.substring(0, 30)
        });
        
        return {
          value: bestMatch.value,
          source: 'similarity-match',
          similarity: bestMatch.similarity,
          metadata: bestMatch.metadata
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error in similarity cache lookup', { error: error.message });
    // Fall back to regular cache get
    return { value: smartCache.get(key), source: 'fallback' };
  }
}

/**
 * Get or create cache item with similarity matching
 * @param {string} key - Cache key
 * @param {Function} valueFactory - Function to create value if not found
 * @param {Object} options - Cache options
 * @returns {Promise<Object>} Cache result
 */
async function getOrCreateWithSimilarity(key, valueFactory, options = {}) {
  try {
    // Try to get with similarity matching
    const result = getWithSimilarityMatch(key, {
      enableSimilarityMatch: options.enableSimilarityMatch !== false,
      similarityThreshold: options.similarityThreshold,
      queryContent: options.queryContent || key
    });
    
    // Return if found
    if (result && result.value) {
      // Update cache access stats
      if (result.source === 'similarity-match') {
        smartCache.stats.fuzzyHits++;
      } else if (result.source === 'exact-match') {
        smartCache.stats.exactHits++;
      }
      
      return {
        value: result.value,
        cached: true,
        source: result.source,
        similarity: result.similarity
      };
    }
    
    // Cache miss - create new value
    const startTime = Date.now();
    const value = await valueFactory();
    const duration = Date.now() - startTime;
    
    // Cache the result with fingerprinting
    setWithFingerprint(key, value, {
      ttl: options.ttl,
      fingerprintField: options.fingerprintField,
      tags: options.tags
    });
    
    smartCache.stats.misses++;
    
    logger.debug(`Enhanced cache miss, created new value in ${duration}ms: ${key.substring(0, 40)}...`);
    
    return {
      value,
      cached: false,
      source: 'created',
      duration
    };
  } catch (error) {
    logger.error(`Error in enhanced cache getOrCreate for ${key}`, { error: error.message });
    throw error;
  }
}

/**
 * Clear cache items by tag
 * @param {string} tag - Tag to clear
 * @returns {number} Number of items cleared
 */
function clearByTag(tag) {
  let cleared = 0;
  
  // Check each cached item for matching tag
  for (const [key, item] of smartCache.cache.entries()) {
    // Skip items without metadata
    if (!item.value || !item.value.metadata || !item.value.metadata.tags) {
      continue;
    }
    
    // Check if item has matching tag
    if (item.value.metadata.tags.includes(tag)) {
      smartCache.cache.delete(key);
      smartCache.keyTimestamps.delete(key);
      cleared++;
    }
  }
  
  if (cleared > 0) {
    logger.info(`Cleared ${cleared} cache items with tag '${tag}'`);
  }
  
  return cleared;
}

// Export enhanced cache functions
export default {
  // Original smartCache methods
  ...smartCache,
  
  // Enhanced methods
  setWithFingerprint,
  getWithSimilarityMatch,
  getOrCreateWithSimilarity,
  clearByTag,
  
  // Access to document fingerprinter
  fingerprinter: documentFingerprinter
};
