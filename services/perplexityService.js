/**
 * Perplexity API Service
 * 
 * This service handles interactions with the Perplexity API, providing support for:
 * - Standard queries using sonar model
 * - Deep research queries requiring more extensive internet access
 * - Circuit breaker pattern for API stability
 * - Response caching for efficiency
 */

import { CircuitBreaker } from '../utils/circuitBreaker.js';
import { RobustAPIClient } from '../utils/apiClient.js';
import logger from '../utils/logger.js';

/**
 * Constants for Perplexity API configuration
 */
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-sonar-small-128k-online';
const DEEP_RESEARCH_MODEL = 'llama-3.1-sonar-small-128k-online';

/**
 * Class representing the Perplexity API service
 */
class PerplexityService {
  /**
   * Create a PerplexityService instance
   * @param {Object} options - Configuration options
   * @param {String} options.apiKey - Perplexity API key
   * @param {Object} options.circuitBreakerOptions - Options for the circuit breaker
   * @param {Object} options.apiClientOptions - Options for the API client
   * @param {Function} options.cacheProvider - Optional function to handle caching
   */
  constructor(options = {}) {
    const {
      apiKey = process.env.PERPLEXITY_API_KEY,
      circuitBreakerOptions = {},
      apiClientOptions = {},
      cacheProvider = null
    } = options;

    if (!apiKey) {
      throw new Error('Perplexity API key is required');
    }

    this.apiKey = apiKey;
    this.cacheProvider = cacheProvider;

    // Configure the API client with standard options
    this.apiClient = new RobustAPIClient({
      baseURL: PERPLEXITY_API_URL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000, // 60 seconds default timeout
      ...apiClientOptions
    });

    // Configure circuit breaker pattern for resilience
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
      onOpen: () => logger.warn('Perplexity API circuit breaker opened'),
      onClose: () => logger.info('Perplexity API circuit breaker closed'),
      ...circuitBreakerOptions
    });
  }

  /**
   * Send a query to the Perplexity API with standard settings
   * @param {String} query - The user query
   * @param {Object} options - Query options
   * @param {Boolean} options.skipCache - Whether to skip cache lookup
   * @returns {Promise<Object>} - The API response
   */
  async query(query, options = {}) {
    const { skipCache = false, systemPrompt = null } = options;
    
    // Standard model for regular queries
    return this._makeRequest({
      query,
      model: DEFAULT_MODEL,
      systemPrompt,
      skipCache
    });
  }

  /**
   * Send a query to the Perplexity API with deep research mode
   * @param {String} query - The user query
   * @param {Object} options - Query options
   * @param {Boolean} options.skipCache - Whether to skip cache lookup
   * @returns {Promise<Object>} - The API response
   */
  async deepResearch(query, options = {}) {
    const { 
      skipCache = false, 
      systemPrompt = 'You are a research assistant with access to search. Provide comprehensive and detailed answers with citations.' 
    } = options;
    
    // Deep research model with specific settings
    return this._makeRequest({
      query,
      model: DEEP_RESEARCH_MODEL,
      systemPrompt,
      temperature: 0.2,
      search_domain_filter: [],
      return_related_questions: true,
      search_recency_filter: 'month',
      skipCache
    });
  }

  /**
   * Internal method to make requests to the Perplexity API
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} - The API response
   * @private
   */
  async _makeRequest(params) {
    const {
      query,
      model,
      systemPrompt,
      temperature = 0.7,
      max_tokens = 2000,
      top_p = 0.9,
      search_domain_filter = [],
      return_related_questions = false,
      search_recency_filter = 'auto',
      skipCache = false
    } = params;

    // Construct messages array
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: query }
    ];

    // Generate a cache key if caching is enabled
    const cacheKey = !skipCache && this.cacheProvider 
      ? this._generateCacheKey(model, messages, temperature)
      : null;

    // Check cache first if available
    if (cacheKey && this.cacheProvider) {
      const cachedResponse = await this.cacheProvider.get(cacheKey);
      if (cachedResponse) {
        logger.debug('Returning cached Perplexity response');
        return cachedResponse;
      }
    }

    // Prepare request payload
    const payload = {
      model,
      messages,
      max_tokens,
      temperature,
      top_p,
      search_domain_filter,
      return_images: false,
      return_related_questions,
      search_recency_filter,
      stream: false
    };

    // Use circuit breaker to handle request
    try {
      const response = await this.circuitBreaker.execute(async () => {
        const startTime = performance.now();
        logger.debug(`Making Perplexity API request to model: ${model}`);
        
        const result = await this.apiClient.post('', payload);
        
        const duration = performance.now() - startTime;
        logger.debug(`Perplexity API request completed in ${duration.toFixed(2)}ms`);
        
        return result.data;
      });

      // Cache the successful response if caching is enabled
      if (cacheKey && this.cacheProvider) {
        await this.cacheProvider.set(cacheKey, response);
        logger.debug('Cached Perplexity response');
      }

      return response;
    } catch (error) {
      logger.error(`Perplexity API error: ${error.message}`, {
        modelName: model,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate a cache key for the request
   * @param {String} model - The model name
   * @param {Array} messages - The messages array
   * @param {Number} temperature - The temperature setting
   * @returns {String} - The cache key
   * @private
   */
  _generateCacheKey(model, messages, temperature) {
    const key = {
      type: 'perplexity',
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature
    };
    
    return `perplexity:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  /**
   * Clean up resources when service is no longer needed
   */
  destroy() {
    this.apiClient.destroy();
    this.circuitBreaker.reset();
  }
}

export default PerplexityService;