
/**
 * LLM Cache Optimizer Utility
 * Provides a simple wrapper for caching LLM API calls
 */
import smartCache from './smartCache.js';
import logger from './logger.js';
import { areLlmCallsDisabled } from './disableLlmCalls.js';

/**
 * Wrapper function to cache LLM API calls
 * @param {Function} apiCallFn - The API call function to wrap
 * @param {Object} options - Caching options
 * @returns {Promise<any>} - The cached or fresh result
 */
export async function cacheLlmCall(apiCallFn, options = {}) {
  const {
    cacheKey,
    ttl = 4 * 60 * 60 * 1000, // 4 hours default
    forceRefresh = false,
    estimatedTokens = 1000,
    model = 'default',
    trackCost = true
  } = options;
  
  // Check if LLM calls are disabled
  if (areLlmCallsDisabled()) {
    logger.info('LLM API calls are disabled - returning mock response', {
      service: 'llmCacheOptimizer',
      cacheKey: cacheKey?.substring(0, 30)
    });
    
    return {
      mockResponse: true,
      content: "This is a mock response because LLM API calls are disabled.",
      usage: { total_tokens: 0 }
    };
  }
  
  // If no cache key provided, generate one based on the function and args
  if (!cacheKey && options.args) {
    cacheKey = `llm:${model}:${JSON.stringify(options.args).slice(0, 100)}`;
  }
  
  // If forceRefresh is true, bypass cache
  if (forceRefresh) {
    logger.info('Bypassing cache due to forceRefresh option', {
      service: 'llmCacheOptimizer',
      cacheKey: cacheKey?.substring(0, 30)
    });
    
    return await apiCallFn();
  }
  
  // If no cache key, can't cache, so just call the function
  if (!cacheKey) {
    logger.warn('No cache key provided, unable to cache LLM call', {
      service: 'llmCacheOptimizer'
    });
    
    return await apiCallFn();
  }
  
  try {
    // Get from cache or create
    const cacheResult = await smartCache.getOrCreate(
      cacheKey,
      apiCallFn,
      {
        ttl,
        estimatedTokens,
        model
      }
    );
    
    // Log cache hit/miss
    if (cacheResult.cached) {
      logger.info('LLM cache hit', {
        service: 'llmCacheOptimizer',
        cacheKey: cacheKey.substring(0, 30)
      });
    } else {
      logger.info('LLM cache miss', {
        service: 'llmCacheOptimizer',
        cacheKey: cacheKey.substring(0, 30)
      });
    }
    
    return cacheResult.value;
  } catch (error) {
    logger.error('Error in LLM cache optimizer', {
      service: 'llmCacheOptimizer',
      error: error.message
    });
    
    // Fallback to direct API call
    return await apiCallFn();
  }
}

/**
 * Clear the LLM cache for a specific key or pattern
 * @param {string|RegExp} keyPattern - The key or pattern to match for clearing
 * @returns {number} Number of keys cleared
 */
export function clearLlmCache(keyPattern) {
  // Implementation will depend on how smartCache handles clearing
  // This is a placeholder for now
  return 0;
}

export default {
  cacheLlmCall,
  clearLlmCache
};
