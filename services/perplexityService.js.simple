/**
 * Perplexity Service for deep internet research
 * 
 * This service provides access to Perplexity's LLMs with internet capabilities
 * to perform comprehensive research on a variety of topics.
 */

import { RobustAPIClient } from '../utils/apiClient.js';
import CircuitBreaker from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';
import promptManager from './promptManager.js';
import { cacheLlmCall } from '../utils/llmCacheOptimizer.js';
import costTracker from '../utils/costTracker.js';

// Create a robust API client with retries and backoff
const apiClient = new RobustAPIClient({
  maxRetries: 3,
  timeout: 120000, // 2 minutes for long-running deep research
  retryDelay: 1000,
  exponentialBackoff: true,
  rateLimitRetryDelay: 5000,
  validateStatus: status => status >= 200 && status < 500 // Consider 429 as retryable
});

// Circuit breaker for preventing cascading failures
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 300000, // 5 minutes
  minRequestThreshold: 5,
  progressiveReset: true,
  healthCheckInterval: 60000 // 1 minute
});

// Default model
const DEFAULT_MODEL = 'llama-3.1-sonar-small-128k-online';

// Track current health status
let serviceStatus = {
  healthy: true,
  lastError: null,
  lastSuccessful: Date.now(),
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  averageLatency: 0,
  rateLimit: {
    limitReached: false,
    resetTime: null,
    queuedRequests: 0
  }
};

/**
 * Perform deep internet research on a query
 * 
 * @param {string} query - The research query
 * @param {string} jobId - Job identifier for tracking the request
 * @param {object} options - Research options
 * @returns {Promise<object>} Research results
 */
async function performDeepResearch(query, jobId, options = {}) {
  const requestId = jobId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  try {
    logger.info(`Initiating deep research`, { 
      requestId, 
      queryLength: query.length,
      options
    });
    
    // Determine the model to use based on options or default
    const model = options.model || DEFAULT_MODEL;
    
    // Load prompt template
    const promptTemplate = await promptManager.getPrompt('perplexity', 'deep_research');
    
    // Format prompt with variables
    const formattedQuery = promptManager.formatPrompt(promptTemplate, { 
      query,
      depth: options.depth || 'comprehensive',
      sourcesRequired: options.sourcesRequired !== false
    });
    
    // Try to get from cache first if caching is enabled
    if (!options.skipCache) {
      try {
        const cacheKey = `perplexity:${model}:${query}`;
        return await cacheLlmCall(
          cacheKey,
          () => executePerplexityQuery(formattedQuery, model, requestId, options),
          {
            ttl: options.cacheTtl || 86400, // 24 hours default for research
            similarityThreshold: 0.8, // Research queries can be similar
            contentType: 'text'
          }
        );
      } catch (cacheError) {
        logger.warn('LLM caching failed for Perplexity, falling back to direct API call', {
          error: cacheError.message,
          requestId
        });
        // Fall back to direct API call
      }
    }
    
    // Execute the query directly if cache is disabled or cache lookup failed
    return await executePerplexityQuery(formattedQuery, model, requestId, options);
  } catch (error) {
    // Update service health
    serviceStatus.totalCalls++;
    serviceStatus.failedCalls++;
    serviceStatus.lastError = {
      message: error.message,
      timestamp: Date.now()
    };
    
    // Reset health for non-rate-limit errors
    if (!error.message.includes('RATE_LIMIT_EXCEEDED')) {
      serviceStatus.healthy = false;
    }
    
    logger.error('Error performing deep research', { 
      requestId, 
      error: error.message,
      stack: error.stack
    });
    
    // Handle specific error types
    if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
      // Special handling for rate limits
      serviceStatus.rateLimit.limitReached = true;
      serviceStatus.rateLimit.resetTime = Date.now() + (10 * 60 * 1000); // 10 minutes
      
      throw new Error('Research service temporarily unavailable due to rate limiting. Please try again later.');
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Execute a query to the Perplexity API with circuit breaker and error handling
 * 
 * @param {string} formattedQuery - The formatted query to send
 * @param {string} model - The model to use
 * @param {string} requestId - Request ID for tracking
 * @param {object} options - Additional API options
 * @returns {Promise<object>} Research results
 */
async function executePerplexityQuery(formattedQuery, model, requestId, options = {}) {
  // Check if we're currently rate limited
  if (serviceStatus.rateLimit.limitReached) {
    if (Date.now() < serviceStatus.rateLimit.resetTime) {
      const waitTimeMinutes = Math.ceil((serviceStatus.rateLimit.resetTime - Date.now()) / 60000);
      logger.warn(`Rate limit still in effect, waiting ${waitTimeMinutes} minutes`, { requestId });
      
      // Increment queued requests counter
      serviceStatus.rateLimit.queuedRequests++;
      
      // Throw rate limit error
      throw new Error(`RATE_LIMIT_EXCEEDED: Service is rate limited. Try again in ${waitTimeMinutes} minutes.`);
    } else {
      // Reset rate limit if time has passed
      serviceStatus.rateLimit.limitReached = false;
      serviceStatus.rateLimit.queuedRequests = 0;
      logger.info('Rate limit period expired, resuming normal operation', { requestId });
    }
  }
  
  // Execute with circuit breaker
  return await circuitBreaker.executeRequest('perplexity', async () => {
    const start = Date.now();
    
    // Configure API request
    const apiRequest = {
      method: 'POST',
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ResearchAssistant/1.0'
      },
      data: {
        model: model,
        messages: [{ role: 'user', content: formattedQuery }],
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.2,
        top_p: options.topP || 0.9,
        return_images: false,
        return_related_questions: false,
        search_domain_filter: options.domainFilter || [],
        search_recency_filter: options.recencyFilter || 'month',
        frequency_penalty: 1,
        presence_penalty: 0,
        top_k: 0,
        stream: false
      }
    };
    
    // If deep research is requested, add the search_domain_filter
    if (options.depth === 'deep') {
      apiRequest.data.search_recency_filter = 'day'; // More recent results
      apiRequest.data.top_k = 15; // Increase number of search results to consider
    }
    
    // If system prompt is provided, add it
    if (options.systemPrompt) {
      apiRequest.data.messages.unshift({
        role: 'system',
        content: options.systemPrompt
      });
    }
    
    try {
      // Send request to Perplexity API
      const response = await apiClient.request(apiRequest);
      
      const duration = Date.now() - start;
      
      // Update service status metrics
      serviceStatus.totalCalls++;
      serviceStatus.successfulCalls++;
      serviceStatus.lastSuccessful = Date.now();
      serviceStatus.averageLatency = (serviceStatus.averageLatency * (serviceStatus.successfulCalls - 1) + duration) / serviceStatus.successfulCalls;
      serviceStatus.healthy = true;
      
      // Track cost
      const outputTokenCount = response.data.usage?.completion_tokens || 
                             estimateTokens(response.data.choices[0].message.content);
      const inputTokenCount = response.data.usage?.prompt_tokens || 
                            estimateTokens(formattedQuery);
      
      costTracker.trackApiCall({
        service: 'perplexity',
        model: model,
        inputTokens: inputTokenCount,
        outputTokens: outputTokenCount,
        duration
      });
      
      logger.info('Perplexity API response received', {
        duration: `${duration}ms`,
        requestId,
        model,
        inputTokens: inputTokenCount,
        outputTokens: outputTokenCount
      });
      
      // Process and return the response
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const responseData = response.data.choices[0].message;
        
        // Extract sources from response if available
        const sources = response.data.citations || [];
        
        logger.info('Deep research completed successfully', { 
          requestId, 
          contentLength: responseData.content.length,
          sourceCount: sources.length
        });
        
        return {
          query: formattedQuery,
          timestamp: new Date().toISOString(),
          content: responseData.content,
          sources: sources,
          model: model,
          metadata: {
            duration,
            inputTokens: inputTokenCount,
            outputTokens: outputTokenCount
          }
        };
      } else {
        throw new Error('Invalid response format from Perplexity API');
      }
    } catch (error) {
      // Handle rate limit errors (HTTP 429)
      if (error.response && error.response.status === 429) {
        logger.warn('Perplexity rate limit exceeded', {
          requestId,
          headers: error.response.headers
        });
        
        // Update rate limit status
        serviceStatus.rateLimit.limitReached = true;
        
        // Get reset time from headers or default to 10 minutes
        let resetTime = 10 * 60 * 1000; // 10 minutes default
        if (error.response.headers['x-ratelimit-reset']) {
          const resetTimestamp = parseInt(error.response.headers['x-ratelimit-reset'], 10) * 1000;
          resetTime = resetTimestamp - Date.now();
        }
        
        serviceStatus.rateLimit.resetTime = Date.now() + resetTime;
        
        throw new Error('RATE_LIMIT_EXCEEDED: Perplexity API rate limit exceeded');
      }
      
      // Log detailed error information
      logger.error('Perplexity API error', {
        requestId,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Re-throw with additional context
      throw new Error(`Perplexity API error: ${error.message}`);
    }
  });
}

/**
 * Perform basic internet query (simplified interface for non-deep research)
 * 
 * @param {string} query - The query to research
 * @param {object} options - Query options
 * @returns {Promise<object>} Query results
 */
async function performQuery(query, options = {}) {
  // Reuse the deep research function with modified options
  return performDeepResearch(query, options.jobId, {
    ...options,
    depth: options.depth || 'basic', // Basic by default
    model: options.model || 'llama-3.1-sonar-small-128k-online', // Smaller model by default
    systemPrompt: options.systemPrompt || 'Be concise and factual. Support your answers with evidence and sources when possible.'
  });
}

/**
 * Get current service status
 * 
 * @returns {Object} Service status information
 */
function getStatus() {
  return {
    service: "Perplexity Research",
    healthy: serviceStatus.healthy,
    totalCalls: serviceStatus.totalCalls,
    successRate: serviceStatus.totalCalls > 0 
      ? (serviceStatus.successfulCalls / serviceStatus.totalCalls * 100).toFixed(2) + '%' 
      : 'N/A',
    averageLatency: serviceStatus.successfulCalls > 0 
      ? Math.round(serviceStatus.averageLatency) + 'ms'
      : 'N/A',
    lastSuccessful: serviceStatus.lastSuccessful,
    lastError: serviceStatus.lastError,
    circuitBreakerOpen: !circuitBreaker.isClosed('perplexity'),
    rateLimit: {
      active: serviceStatus.rateLimit.limitReached,
      resetIn: serviceStatus.rateLimit.limitReached 
        ? `${Math.ceil((serviceStatus.rateLimit.resetTime - Date.now()) / 60000)} minutes` 
        : 'N/A',
      queuedRequests: serviceStatus.rateLimit.queuedRequests
    }
  };
}

/**
 * Reset rate limit status (for admin use)
 */
function resetRateLimitStatus() {
  serviceStatus.rateLimit.limitReached = false;
  serviceStatus.rateLimit.resetTime = null;
  serviceStatus.rateLimit.queuedRequests = 0;
  logger.info('Perplexity rate limit status manually reset');
}

/**
 * Estimate token count from text (rough approximation)
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

export default {
  performDeepResearch,
  performQuery,
  getStatus,
  resetRateLimitStatus
};