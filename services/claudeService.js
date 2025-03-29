/**
 * Claude (Anthropic) API Service
 * 
 * This service handles interactions with Anthropic's Claude API, providing support for:
 * - Text analysis and chat completion
 * - Chart generation through text prompts
 * - Image analysis capabilities
 * - Circuit breaker pattern for API stability
 * - Response caching for efficiency
 */

import Anthropic from '@anthropic-ai/sdk';
import { CircuitBreaker } from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';

/**
 * Constants for Claude API configuration
 */
// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

/**
 * Class representing the Claude API service
 */
class ClaudeService {
  /**
   * Create a ClaudeService instance
   * @param {Object} options - Configuration options
   * @param {String} options.apiKey - Anthropic API key
   * @param {Object} options.circuitBreakerOptions - Options for the circuit breaker
   * @param {Function} options.cacheProvider - Optional function to handle caching
   */
  constructor(options = {}) {
    const {
      apiKey = process.env.ANTHROPIC_API_KEY,
      circuitBreakerOptions = {},
      cacheProvider = null
    } = options;

    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // Initialize the Anthropic client
    this.client = new Anthropic({
      apiKey
    });

    this.apiKey = apiKey;
    this.cacheProvider = cacheProvider;

    // Configure circuit breaker pattern for resilience
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
      onOpen: () => logger.warn('Claude API circuit breaker opened'),
      onClose: () => logger.info('Claude API circuit breaker closed'),
      ...circuitBreakerOptions
    });
  }

  /**
   * Send a text query to Claude
   * @param {String} prompt - The user prompt
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - The API response
   */
  async query(prompt, options = {}) {
    const {
      model = DEFAULT_MODEL,
      temperature = 0.7,
      maxTokens = 1024,
      system = null,
      skipCache = false
    } = options;

    // Use helper method to handle LLM API call with caching
    return this._cacheLlmCall({
      callFn: async () => this._makeTextRequest(prompt, model, temperature, maxTokens, system),
      model,
      prompt,
      temperature,
      system,
      skipCache
    });
  }

  /**
   * Generate a chart based on a description
   * @param {String} description - The chart description
   * @param {Object} options - Chart generation options
   * @returns {Promise<Object>} - The API response with chart data
   */
  async generateChart(description, options = {}) {
    const {
      chartType = null,
      data = null,
      model = DEFAULT_MODEL,
      skipCache = false
    } = options;

    // Build a specialized prompt for chart generation
    let chartPrompt = `Generate a ${chartType || 'appropriate'} chart for the following data and requirements:\n\n`;
    chartPrompt += description;

    if (data) {
      chartPrompt += `\n\nData: ${typeof data === 'object' ? JSON.stringify(data) : data}`;
    }

    const system = `You are a data visualization expert. Create precise chart configurations in Plotly.js format.
    Provide ONLY the JavaScript code to create the chart - no explanations.
    The response must be valid JavaScript that creates a Plotly chart and should be ready to use with minimal modifications.
    Include all necessary data, layout, and configuration options.`;

    // Use helper method to handle LLM API call with caching
    return this._cacheLlmCall({
      callFn: async () => this._makeTextRequest(chartPrompt, model, 0.2, 2048, system),
      model,
      prompt: chartPrompt,
      temperature: 0.2,
      system,
      skipCache,
      cachePrefix: 'chart'
    });
  }

  /**
   * Analyze an image
   * @param {String} base64Image - Base64 encoded image data
   * @param {String} prompt - Analysis prompt
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - The API response
   */
  async analyzeImage(base64Image, prompt, options = {}) {
    const {
      model = DEFAULT_MODEL,
      maxTokens = 1024,
      skipCache = false
    } = options;

    if (!base64Image) {
      throw new Error('Base64 image data is required');
    }

    // Generate a cache key for multimodal content
    const cacheKey = !skipCache && this.cacheProvider 
      ? this._generateCacheKey('image', model, prompt, base64Image.slice(0, 100))
      : null;

    // Check cache first if available
    if (cacheKey && this.cacheProvider) {
      const cachedResponse = await this.cacheProvider.get(cacheKey);
      if (cachedResponse) {
        logger.debug('Returning cached Claude image analysis');
        return cachedResponse;
      }
    }

    // Use circuit breaker to handle request
    try {
      const response = await this.circuitBreaker.execute(async () => {
        const startTime = performance.now();
        logger.debug(`Making Claude image analysis request with model: ${model}`);
        
        const result = await this.client.messages.create({
          model: model,
          max_tokens: maxTokens,
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: prompt || "Analyze this image in detail and describe its key elements."
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }]
        });
        
        const duration = performance.now() - startTime;
        logger.debug(`Claude image analysis completed in ${duration.toFixed(2)}ms`);
        
        return result;
      });

      // Cache the successful response if caching is enabled
      if (cacheKey && this.cacheProvider) {
        await this.cacheProvider.set(cacheKey, response);
        logger.debug('Cached Claude image analysis');
      }

      return response;
    } catch (error) {
      logger.error(`Claude image analysis error: ${error.message}`, {
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Internal method to make text requests to Claude
   * @param {String} prompt - The user prompt
   * @param {String} model - The model to use
   * @param {Number} temperature - The temperature setting
   * @param {Number} maxTokens - The maximum tokens to generate
   * @param {String} system - Optional system prompt
   * @returns {Promise<Object>} - The API response
   * @private
   */
  async _makeTextRequest(prompt, model, temperature, maxTokens, system) {
    try {
      const startTime = performance.now();
      logger.debug(`Making Claude API request with model: ${model}`);

      const messages = [{ role: 'user', content: prompt }];
      
      const result = await this.client.messages.create({
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: messages,
        ...(system ? { system } : {})
      });

      const duration = performance.now() - startTime;
      logger.debug(`Claude API request completed in ${duration.toFixed(2)}ms`);

      return result;
    } catch (error) {
      logger.error(`Claude API request error: ${error.message}`, {
        modelName: model,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Helper method to handle LLM API calls with caching
   * @param {Object} params - Parameters for the call
   * @returns {Promise<Object>} - The API response
   * @private
   */
  async _cacheLlmCall(params) {
    const {
      callFn,
      model,
      prompt,
      temperature,
      system,
      skipCache,
      cachePrefix = 'claude'
    } = params;

    // Generate a cache key if caching is enabled
    const cacheKey = !skipCache && this.cacheProvider 
      ? this._generateCacheKey(cachePrefix, model, prompt, temperature, system)
      : null;

    // Check cache first if available
    if (cacheKey && this.cacheProvider) {
      const cachedResponse = await this.cacheProvider.get(cacheKey);
      if (cachedResponse) {
        logger.debug(`Returning cached ${cachePrefix} response`);
        return cachedResponse;
      }
    }

    // Use circuit breaker to handle request
    try {
      const response = await this.circuitBreaker.execute(callFn);

      // Cache the successful response if caching is enabled
      if (cacheKey && this.cacheProvider) {
        await this.cacheProvider.set(cacheKey, response);
        logger.debug(`Cached ${cachePrefix} response`);
      }

      return response;
    } catch (error) {
      logger.error(`Claude API error: ${error.message}`, {
        modelName: model,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate a cache key for the request
   * @param {String} prefix - Cache key prefix
   * @param {String} model - The model name
   * @param {String} prompt - The prompt text
   * @param {Number|String} param1 - Additional parameter (temperature or base64 prefix)
   * @param {String} param2 - Additional parameter (system prompt)
   * @returns {String} - The cache key
   * @private
   */
  _generateCacheKey(prefix, model, prompt, param1, param2 = null) {
    const key = {
      type: prefix,
      model,
      prompt,
      param1,
      ...(param2 ? { param2 } : {})
    };
    
    return `${prefix}:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  /**
   * Clean up resources when service is no longer needed
   */
  destroy() {
    this.circuitBreaker.reset();
  }
}

export default ClaudeService;