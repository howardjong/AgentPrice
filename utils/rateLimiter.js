/**
 * rateLimiter.js
 * 
 * This utility provides rate limiting functionality to prevent API request limits
 * from being exceeded. It tracks requests for different API providers and enforces
 * appropriate rate limits for each.
 */

import logger from './logger.js';

// Configuration for different API providers
const RATE_LIMIT_CONFIG = {
  // Rate limits for Anthropic/Claude API
  claude: {
    requestsPerMinute: 50,  // Maximum requests per minute
    requestsPerHour: 500,   // Maximum requests per hour
    tokensPerMinute: 100000 // Maximum tokens per minute
  },
  
  // Rate limits for Perplexity API
  perplexity: {
    requestsPerMinute: 20,   // Maximum requests per minute
    requestsPerDay: 1000,    // Maximum requests per day
    deepResearchPerHour: 10  // Maximum deep research requests per hour
  }
};

// Initialize tracking for each provider
const requestTracking = {
  claude: {
    requestTimestamps: [],  // Timestamps of recent requests
    tokenCounts: [],        // Token counts with timestamps
    totalTokensThisMinute: 0
  },
  
  perplexity: {
    requestTimestamps: [],         // Timestamps of recent requests
    deepResearchTimestamps: []     // Timestamps of deep research requests
  }
};

/**
 * Reset all rate limiting data (primarily for testing)
 */
function reset() {
  for (const provider in requestTracking) {
    requestTracking[provider].requestTimestamps = [];
    
    if (provider === 'claude') {
      requestTracking[provider].tokenCounts = [];
      requestTracking[provider].totalTokensThisMinute = 0;
    } else if (provider === 'perplexity') {
      requestTracking[provider].deepResearchTimestamps = [];
    }
  }
  logger.debug('Rate limiter state reset');
}

/**
 * Check if a request would exceed the rate limit for a provider
 * @param {string} provider - The API provider (claude or perplexity)
 * @param {Object} options - Additional options
 * @param {boolean} [options.isDeepResearch=false] - Whether this is a deep research request (for Perplexity)
 * @param {number} [options.estimatedTokens=0] - Estimated token count (for Claude)
 * @returns {boolean} - Whether the rate limit would be exceeded
 */
function wouldExceedRateLimit(provider, options = {}) {
  const { isDeepResearch = false, estimatedTokens = 0 } = options;
  const now = Date.now();
  const tracking = requestTracking[provider];
  const config = RATE_LIMIT_CONFIG[provider];
  
  if (!tracking || !config) {
    logger.error(`Unknown provider: ${provider}`);
    return true;
  }
  
  // Filter out old timestamps
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  // Update request tracking
  tracking.requestTimestamps = tracking.requestTimestamps.filter(
    timestamp => timestamp > oneMinuteAgo
  );
  
  // Provider-specific checks
  if (provider === 'claude') {
    // Update token tracking
    tracking.tokenCounts = tracking.tokenCounts.filter(
      item => item.timestamp > oneMinuteAgo
    );
    tracking.totalTokensThisMinute = tracking.tokenCounts.reduce(
      (sum, item) => sum + item.tokens, 0
    );
    
    // Check requests per minute
    if (tracking.requestTimestamps.length >= config.requestsPerMinute) {
      logger.warn(`Claude rate limit exceeded: ${config.requestsPerMinute} requests per minute`);
      return true;
    }
    
    // Check tokens per minute
    if (tracking.totalTokensThisMinute + estimatedTokens > config.tokensPerMinute) {
      logger.warn(`Claude token limit exceeded: ${config.tokensPerMinute} tokens per minute`);
      return true;
    }
    
    // Check requests per hour
    const requestsLastHour = tracking.requestTimestamps.filter(
      timestamp => timestamp > oneHourAgo
    ).length;
    if (requestsLastHour >= config.requestsPerHour) {
      logger.warn(`Claude rate limit exceeded: ${config.requestsPerHour} requests per hour`);
      return true;
    }
  } 
  else if (provider === 'perplexity') {
    // Check requests per minute
    if (tracking.requestTimestamps.length >= config.requestsPerMinute) {
      logger.warn(`Perplexity rate limit exceeded: ${config.requestsPerMinute} requests per minute`);
      return true;
    }
    
    // Clean up old deep research timestamps
    tracking.deepResearchTimestamps = tracking.deepResearchTimestamps.filter(
      timestamp => timestamp > oneHourAgo
    );
    
    // Check deep research requests per hour
    if (isDeepResearch && 
        tracking.deepResearchTimestamps.length >= config.deepResearchPerHour) {
      logger.warn(`Perplexity deep research limit exceeded: ${config.deepResearchPerHour} per hour`);
      return true;
    }
    
    // Check requests per day
    const requestsLastDay = tracking.requestTimestamps.filter(
      timestamp => timestamp > oneDayAgo
    ).length;
    if (requestsLastDay >= config.requestsPerDay) {
      logger.warn(`Perplexity rate limit exceeded: ${config.requestsPerDay} requests per day`);
      return true;
    }
  }
  
  // If all checks pass, the request is within rate limits
  return false;
}

/**
 * Record a successful request to track rate limits
 * @param {string} provider - The API provider (claude or perplexity)
 * @param {Object} options - Additional options
 * @param {boolean} [options.isDeepResearch=false] - Whether this is a deep research request (for Perplexity)
 * @param {number} [options.tokensUsed=0] - Tokens used in the request (for Claude)
 */
function recordRequest(provider, options = {}) {
  const { isDeepResearch = false, tokensUsed = 0 } = options;
  const now = Date.now();
  const tracking = requestTracking[provider];
  
  if (!tracking) {
    logger.error(`Unknown provider: ${provider}`);
    return;
  }
  
  // Record timestamp for this request
  tracking.requestTimestamps.push(now);
  
  // Provider-specific recording
  if (provider === 'claude' && tokensUsed > 0) {
    tracking.tokenCounts.push({
      timestamp: now,
      tokens: tokensUsed
    });
    tracking.totalTokensThisMinute += tokensUsed;
  } 
  else if (provider === 'perplexity' && isDeepResearch) {
    tracking.deepResearchTimestamps.push(now);
  }
  
  logger.debug(`Recorded ${provider} request${isDeepResearch ? ' (deep research)' : ''}${tokensUsed > 0 ? ` with ${tokensUsed} tokens` : ''}`);
}

/**
 * Get stats about current rate limit usage
 * @param {string} provider - The API provider (claude or perplexity)
 * @returns {Object} - Statistics about rate limit usage
 */
function getRateLimitStats(provider) {
  const tracking = requestTracking[provider];
  const config = RATE_LIMIT_CONFIG[provider];
  
  if (!tracking || !config) {
    return { error: `Unknown provider: ${provider}` };
  }
  
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  // Filter to get recent requests
  const requestsLastMinute = tracking.requestTimestamps.filter(
    timestamp => timestamp > oneMinuteAgo
  ).length;
  
  const requestsLastHour = tracking.requestTimestamps.filter(
    timestamp => timestamp > oneHourAgo
  ).length;
  
  const requestsLastDay = tracking.requestTimestamps.filter(
    timestamp => timestamp > oneDayAgo
  ).length;
  
  // Basic stats for all providers
  const stats = {
    requestsLastMinute,
    requestsLastHour,
    requestsLastDay,
    minuteUsagePercent: (requestsLastMinute / config.requestsPerMinute) * 100
  };
  
  // Provider-specific stats
  if (provider === 'claude') {
    const tokenCounts = tracking.tokenCounts.filter(
      item => item.timestamp > oneMinuteAgo
    );
    const tokensLastMinute = tokenCounts.reduce((sum, item) => sum + item.tokens, 0);
    
    stats.tokensLastMinute = tokensLastMinute;
    stats.tokensUsagePercent = (tokensLastMinute / config.tokensPerMinute) * 100;
    stats.hourlyUsagePercent = (requestsLastHour / config.requestsPerHour) * 100;
  } 
  else if (provider === 'perplexity') {
    const deepResearchLastHour = tracking.deepResearchTimestamps.filter(
      timestamp => timestamp > oneHourAgo
    ).length;
    
    // Add deepResearchLastMinute for the test
    const deepResearchLastMinute = tracking.deepResearchTimestamps.filter(
      timestamp => timestamp > oneMinuteAgo
    ).length;
    
    stats.deepResearchLastHour = deepResearchLastHour;
    stats.deepResearchLastMinute = deepResearchLastMinute;
    stats.deepResearchUsagePercent = (deepResearchLastHour / config.deepResearchPerHour) * 100;
    stats.dailyUsagePercent = (requestsLastDay / config.requestsPerDay) * 100;
  }
  
  return stats;
}

/**
 * Wait for rate limit to reset if necessary
 * @param {string} provider - The API provider (claude or perplexity)
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Resolves to true when ready to proceed, or false if timeout
 */
async function waitForRateLimit(provider, options = {}) {
  const maxWaitTime = options.maxWaitTime || 60000; // Default 1 minute max wait
  const startTime = Date.now();
  
  while (wouldExceedRateLimit(provider, options)) {
    const currentWaitTime = Date.now() - startTime;
    
    if (currentWaitTime > maxWaitTime) {
      logger.warn(`Rate limit wait timeout exceeded for ${provider}`);
      return false;
    }
    
    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.debug(`Waiting for ${provider} rate limit to reset (${currentWaitTime}ms elapsed)`);
  }
  
  return true;
}

/**
 * Update the rate limit configuration
 * @param {string} provider - The API provider (claude or perplexity)
 * @param {Object} newConfig - New rate limit configuration
 */
function updateRateLimitConfig(provider, newConfig) {
  if (!RATE_LIMIT_CONFIG[provider]) {
    logger.error(`Unknown provider for rate limit config update: ${provider}`);
    return;
  }
  
  RATE_LIMIT_CONFIG[provider] = {
    ...RATE_LIMIT_CONFIG[provider],
    ...newConfig
  };
  
  logger.info(`Updated rate limit configuration for ${provider}`, {
    component: 'rateLimiter'
  });
}

/**
 * Schedule a function to run while respecting rate limits
 * @param {Function} fn - The function to execute
 * @param {string} provider - The API provider (claude or perplexity)
 * @param {boolean} isDeepResearch - Whether this is a deep research request (for Perplexity)
 * @returns {Promise<any>} - The result of the function
 */
async function schedule(fn, provider, isDeepResearch = false) {
  // Check if we would exceed rate limits
  const options = { isDeepResearch };
  
  // Wait until we're under the rate limit
  await waitForRateLimit(provider, options);
  
  // For perplexity, ensure requests are spaced out by at least 1 second
  const now = Date.now();
  const tracking = requestTracking[provider] || { requestTimestamps: [] };
  const lastRequestTime = tracking.requestTimestamps.length > 0 ? 
    Math.max(...tracking.requestTimestamps) : 0;
  
  // If this is a perplexity request, ensure at least 1 second spacing between requests
  if (provider === 'perplexity' && lastRequestTime > 0) {
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < 1000) {
      const waitTime = 1000 - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  try {
    // Execute the function
    const result = await fn();
    
    // Record the request
    recordRequest(provider, { isDeepResearch });
    
    return result;
  } catch (error) {
    logger.error(`Error in rate-limited function for ${provider}: ${error.message}`);
    throw error;
  }
}

export default {
  wouldExceedRateLimit,
  recordRequest,
  getRateLimitStats,
  waitForRateLimit,
  updateRateLimitConfig,
  schedule,
  reset
};