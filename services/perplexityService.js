/**
 * Perplexity Service for web research and information retrieval
 */
import axios from 'axios';
import logger from '../utils/logger.js';
import { RobustAPIClient } from '../utils/apiClient.js';
import { CircuitBreaker } from '../utils/monitoring.js';
import promptManager from './promptManager.js';

class PerplexityService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.models = {
      basic: 'sonar',         // The default model for most queries
      deepResearch: 'sonar-deep-research' // Only used when deep research is explicitly requested
    };
    this.searchModes = {
      basic: 'medium',     // Medium search context for basic queries with sonar
      deepResearch: 'high' // High search context for deep research with sonar-deep-research
    };
    // Maintain backward compatibility
    this.fallbackModels = ['sonar-pro', 'sonar'];
    this.fallbackConfig = {
      'sonar-deep-research': ['sonar-pro'],
      'sonar-pro': ['sonar']
    };
    this.isConnected = false;
    this.lastUsed = null;
    this.apiClient = new RobustAPIClient({
      maxRetries: 3,
      timeout: 180000, // 3 minutes for long-running research
      retryDelay: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 30000) // Exponential backoff capped at 30s
    });
    this.requestCounter = {
      timestamp: Date.now(),
      count: 0
    };
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 300000 // 5 minutes
    });
    this.promptManager = promptManager;

    this.initialize();
  }

  initialize() {
    try {
      if (!this.apiKey) {
        logger.warn('Perplexity API key not found, service will be unavailable');
        return;
      }

      logger.info('Initializing Perplexity service with default model');
      this.isConnected = true;
      logger.info('Perplexity service initialized successfully', { model: this.models.basic });
    } catch (error) {
      logger.error(`Error initializing Perplexity service: ${error.message}`);
    }
  }

  /**
   * Get status of Perplexity service
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      service: 'Perplexity API',
      status: this.isConnected ? 'connected' : 'disconnected',
      lastUsed: this.lastUsed ? this.lastUsed.toISOString() : null,
      version: this.model,
      error: !this.isConnected ? 'API key not configured or service unavailable' : undefined
    };
  }

  /**
   * Perform research using Perplexity
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options for the research request
   * @returns {Promise<Object>} Research results
   */
  async performResearch(messages, options = {}) {
    if (!this.isConnected) {
      throw new Error('Perplexity service is not connected');
    }
    
    // Import the LLM API disable check
    const { isLlmApiDisabled } = await import('../utils/disableLlmCalls.js');
    
    // Check if LLM API calls are disabled
    if (isLlmApiDisabled()) {
      logger.info('LLM API calls are disabled - returning mock response', {
        service: 'perplexity',
        method: 'performResearch'
      });
      return {
        response: "[Using Perplexity AI - Model: sonar (MOCK)]\n\nThis is a mock response because LLM API calls are disabled. Enable API calls to get real results.",
        citations: [],
        modelUsed: 'sonar (MOCK)',
        usage: { total_tokens: 0 }
      };
    }

    try {
      // Get the user query from the last message
      const userQuery = messages.filter(m => m.role === 'user').pop()?.content || '';
      logger.info('Perplexity received query', { queryLength: userQuery.length });

      // Validate and prepare messages for the Perplexity API
      const validatedMessages = this.validateMessages(messages);

      // Add a more explicit system message for internet search
      validatedMessages.unshift({
        role: 'system', 
        content: 'You are a research assistant with real-time internet access. ALWAYS search the web for the most current information. Your primary goal is to provide up-to-date information with citations. Search broadly across different domains to find the most relevant and recent information.'
      });

      // Append current date instruction to the user query
      const lastMsgIndex = validatedMessages.findIndex(m => m.role === 'user' && validatedMessages.slice(validatedMessages.indexOf(m) + 1).every(n => n.role !== 'user'));

      if (lastMsgIndex !== -1) {
        validatedMessages[lastMsgIndex].content = `${validatedMessages[lastMsgIndex].content}\n\nPlease provide the most up-to-date information available as of today, March 24, 2025. I need CURRENT information.`;
      }

      // No special pattern detection - we'll use the basic model by default

      // Enhanced request options
      // Determine which model to use based on query complexity
      const selectedModel = this.determineModelForQuery(userQuery, options);

      const requestOptions = {
        method: 'POST',
        url: 'https://api.perplexity.ai/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: {
          model: selectedModel,
          messages: validatedMessages,
          temperature: options.temperature || 0.1,
          max_tokens: options.maxTokens || 1024,
          top_p: options.topP || 0.9,
          search_domain_filter: options.domainFilter || [],
          search_recency_filter: "day",
          top_k: options.topK || 15,
          return_citations: true,
          frequency_penalty: 0.5,
          search_context_mode: options.searchContextMode || this.getSearchModeForModel(selectedModel)
        }
      };

      // Log the request with detailed model selection info
      logger.info('Sending enhanced request to Perplexity', {
        messageCount: requestOptions.data.messages.length,
        model: selectedModel, 
        recencyFilter: requestOptions.data.search_recency_filter,
        queryLength: userQuery.length,
        searchContextMode: requestOptions.data.search_context_mode
      });

      let response;
      try {
        response = await this.apiClient.request(requestOptions);
      } catch (error) {
        // Handle rate limits and service unavailable errors with fallback models
        if (error.response?.status === 429 || error.response?.status === 503) {
          const currentModel = requestOptions.data.model;
          const fallbacks = this.fallbackConfig[currentModel] || [];

          // Log that we're falling back due to rate limiting
          logger.warn(`Rate limit or service unavailable (${error.response.status}) encountered for ${currentModel}. Attempting fallbacks.`);

          for (const fallbackModel of fallbacks) {
            logger.info(`Attempting fallback to model ${fallbackModel}`, { originalModel: currentModel });
            requestOptions.data.model = fallbackModel;
            try {
              response = await this.apiClient.request(requestOptions);
              logger.info(`Successfully fell back to ${fallbackModel} due to rate limits`);
              break;
            } catch (fallbackError) {
              logger.error(`Fallback to ${fallbackModel} failed`, { 
                error: fallbackError.message 
              });
            }
          }

          if (!response) {
            throw error; // If all fallbacks failed, throw original error
          }
        } else {
          throw error;
        }
      }

      this.lastUsed = new Date();

      // Log detailed information about the response
      const actualModel = response.data.model || selectedModel;
      logger.info('Perplexity API response received', { 
        citationsCount: (response.data.citations || []).length,
        contentLength: response.data.choices[0].message.content.length,
        promptTokens: response.data.usage?.prompt_tokens,
        completionTokens: response.data.usage?.completion_tokens,
        requestedModel: selectedModel,
        actualModel: actualModel,
        modelMatch: actualModel === selectedModel ? 'match' : 'mismatch'
      });

      // If there are no citations, log a warning
      if (!response.data.citations || response.data.citations.length === 0) {
        logger.warn('No citations returned from Perplexity - response may not include current information');
      } else {
        logger.info('Citations included in response', { 
          count: response.data.citations.length,
          sources: response.data.citations.slice(0, 3) // Log first few citations
        });
      }

      // Add explicit model information to the beginning of the response
      const originalResponse = response.data.choices[0].message.content;
      // Use the actual model from the response payload rather than the requested model
      const responseModel = response.data.model || requestOptions.data.model;
      const modelInfo = `[Using Perplexity AI - Model: ${responseModel}]\n\n`;
      const enhancedResponse = modelInfo + originalResponse;

      return {
        response: enhancedResponse,
        citations: response.data.citations || [],
        modelUsed: responseModel,
        usage: response.data.usage || { total_tokens: 0 }
      };
    } catch (error) {
      logger.error('Error in Perplexity research', { error: error.message });
      throw new Error(`Perplexity API error: ${error.message}`);
    }
  }

  /**
   * Perform deep research using Perplexity
   * @param {string} query - Research query
   * @param {string} jobId - Unique job identifier
   * @returns {Promise<Object>} Research results with sources
   */
  async performDeepResearch(query, options = {}) {
    const { context = '', maxCitations = 15, sessionId = 'default', circuitBreaker = true } = options;

    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }
    
    // Import the LLM API disable check
    const { isLlmApiDisabled } = await import('../utils/disableLlmCalls.js');
    
    // Check if LLM API calls are disabled
    if (isLlmApiDisabled()) {
      logger.info('LLM API calls are disabled - returning mock response for deep research', {
        service: 'perplexity',
        method: 'performDeepResearch'
      });
      return {
        query,
        timestamp: new Date().toISOString(),
        content: "[Using Perplexity AI - Model: sonar-deep-research (MOCK)]\n\nThis is a mock response because LLM API calls are disabled. Enable API calls to get real results.",
        sources: [],
        modelUsed: 'sonar-deep-research (MOCK)',
        requestedModel: this.models.deepResearch,
        usage: { total_tokens: 0 }
      };
    }

    // Import the rate limiter
    const perplexityRateLimiter = (await import('../utils/rateLimiter.js')).default;

    // Use the main circuit breaker by default, or allow passing a custom one
    const breaker = circuitBreaker === true ? this.circuitBreaker : circuitBreaker;

    // Log the status of the rate limiter
    const rateLimiterStatus = perplexityRateLimiter.getStatus();
    logger.info(`Perplexity rate limiter status before request`, {
      service: 'multi-llm-research',
      activeRequests: rateLimiterStatus.activeRequests,
      queuedRequests: rateLimiterStatus.queuedRequests,
      isRateLimited: rateLimiterStatus.isRateLimited,
      nextAvailableSlot: rateLimiterStatus.nextAvailableSlot
    });

    // Schedule the request through the rate limiter
    return perplexityRateLimiter.schedule(async () => {
      try {
        logger.info(`Starting deep research with Perplexity for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`, {
          service: 'multi-llm-research',
          modelRequested: 'sonar-deep-research'
        });

        // Use a default prompt if promptManager fails
        let formattedPrompt;
        try {
          const promptTemplate = await this.promptManager.getPrompt('perplexity', 'deep_research');
          formattedPrompt = this.promptManager.formatPrompt(promptTemplate, { query, context });
        } catch (error) {
          logger.warn(`Failed to get prompt template, using default: ${error.message}`);
          // Create a default research prompt
          formattedPrompt = `Please conduct in-depth research on the following topic and provide a comprehensive, well-structured response with citations.
          
Research query: ${query}
${context ? `Additional context: ${context}` : ''}

Please include the most up-to-date information available, with particular attention to recent developments and reliable sources. Format your response in a clear, organized manner with appropriate headings and citation references where applicable.`;
        }

        // Use circuit breaker pattern for the API call
        return await breaker.executeRequest('perplexity-deep', async () => {
          // Enhanced request settings for better search capabilities
          const requestOptions = {
            method: 'POST',
            url: 'https://api.perplexity.ai/chat/completions',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            data: {
              model: this.models.deepResearch,
              messages: [
                { 
                  role: 'system', 
                  content: 'You are a research assistant with real-time internet access. Always search for and use the most recent information available. Your research should be comprehensive, up-to-date, and well-sourced with citations.'
                },
                { 
                  role: 'user', 
                  content: formattedPrompt
                }
              ],
              temperature: 0.1, // Lower temperature for more factual responses
              max_tokens: 1500, // Allow for longer, more detailed responses
              top_p: 0.95,
              top_k: 15,
              search_recency_filter: "day", // Most recent information
              search_domain_filter: [], // No domain restrictions
              return_citations: true,
              frequency_penalty: 0.5, // Keeping only frequency_penalty, removing presence_penalty
              stream: false, // We want the complete response at once
              search_context_mode: "high" // High search context mode for more comprehensive search
            }
          };

          logger.info('Deep research request configuration', {
            sessionId,
            requestedModel: requestOptions.data.model,
            actualModel: requestOptions.data.model,
            recencyFilter: requestOptions.data.search_recency_filter
          });

          let response;
          try {
            response = await this.apiClient.request(requestOptions);
          } catch (error) {
            if (error.response?.status === 429 || error.response?.status === 503) {
              const currentModel = requestOptions.data.model;
              const fallbacks = this.fallbackConfig[currentModel] || [];

              for (const fallbackModel of fallbacks) {
                logger.info(`Attempting fallback to model ${fallbackModel}`, { sessionId, originalModel: currentModel });
                requestOptions.data.model = fallbackModel;
                try {
                  response = await this.apiClient.request(requestOptions);
                  logger.info(`Successfully fell back to ${fallbackModel}`, { sessionId });
                  break;
                } catch (fallbackError) {
                  logger.error(`Fallback to ${fallbackModel} failed`, { 
                    sessionId,
                    error: fallbackError.message 
                  });
                }
              }

              if (!response) {
                throw error; // If all fallbacks failed, throw original error
              }
            } else {
              throw error;
            }
          }

          const duration = Date.now() - response.config.timestamp;

          const actualModel = response.data.model || requestOptions.data.model;
          logger.info('Perplexity API response received', {
            duration: `${duration}ms`,
            citationsCount: (response.data.citations || []).length,
            sessionId,
            requestedModel: requestOptions.data.model,
            actualModel: actualModel,
            modelMatch: actualModel === requestOptions.data.model ? 'match' : 'mismatch'
          });

          if (!response.data?.choices?.[0]?.message) {
            throw new Error('Invalid response format from Perplexity API');
          }

          const responseData = response.data.choices[0].message;
          const extractedCitations = response.data.citations || [];
          const processedResponse = responseData.content;

          // Log full citations for debugging
          if (response.data.citations && response.data.citations.length > 0) {
            logger.info('Citations from deep research', {
              sessionId,
              citations: response.data.citations.slice(0, 5) // Log first 5 citations
            });
          } else {
            logger.warn('No citations returned from deep research', { sessionId });
          }

          logger.info('Deep research completed successfully', {
            sessionId,
            contentLength: processedResponse.length
          });

          // Add explicit model information to the beginning of the deep research response
          // Use the actual model from the response payload rather than the requested model
          const responseModel = response.data.model || requestOptions.data.model;

          // Verify model matches what we requested (could be deepResearch or fallback)
          if (responseModel !== requestOptions.data.model) {
            logger.warn('Model mismatch in deep research', {
              requestedModel: requestOptions.data.model,
              actualModel: responseModel,
              sessionId
            });
          }

          const modelInfo = `[Using Perplexity AI - Model: ${responseModel}]\n\n`;
          const enhancedContent = modelInfo + processedResponse;

          return {
            query,
            timestamp: new Date().toISOString(),
            content: enhancedContent,
            sources: extractedCitations,
            modelUsed: responseModel,
            requestedModel: this.models.deepResearch,
            usage: response.data.usage || { total_tokens: 0 }
          };
        });
      } catch (error) {
        logger.error('Error performing deep research', {
          service: 'multi-llm-research',
          error: error.message
        });
        throw error;
      }
    });
  }

  /**
   * Analyzes a query and determines which model should be used based on complexity
   * @param {string} query - The user query to analyze
   * @param {Object} options - Additional options that may override the default selection
   * @returns {string} The model name to use
   */
  determineModelForQuery(query, options = {}) {
    // If there's an explicit model override in options, use that
    if (options.model) {
      logger.info(`Using explicitly requested model: ${options.model}`);
      return options.model;
    }

    // If deep research is specifically requested, use the deep research model
    if (options.deepResearch === true) {
      logger.info('Using deep research model (sonar-deep-research) - explicitly requested', {
        queryLength: query.length
      });
      return this.models.deepResearch;
    }

    // Always default to the basic model (sonar) unless explicitly requested otherwise
    logger.info('Using default basic model (sonar)', {
      queryLength: query.length
    });
    return this.models.basic;
  }

  /**
   * Get the appropriate search mode for a given model
   * @param {string} model - The Perplexity model name
   * @returns {string} The search context mode to use
   */
  getSearchModeForModel(model) {
    // For sonar (basic model)
    if (model === this.models.basic) {
      return this.searchModes.basic;
    }

    // For sonar-deep-research (deep research model)
    if (model === this.models.deepResearch) {
      return this.searchModes.deepResearch;
    }

    // If it's a fallback model (sonar-pro), use high search mode
    if (model === 'sonar-pro') {
      return 'high';
    }

    // Default to medium mode if model isn't recognized
    return 'medium';
  }

  /**
   * Validate messages format for Perplexity API
   * Must alternate between user and assistant, ending with user
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Array} Validated and possibly fixed messages array
   */
  validateMessages(messages) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return [{ role: 'user', content: 'Provide information on this topic.' }];
    }

    const validMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add a system message at the beginning if not present
    if (validMessages[0].role !== 'system') {
      validMessages.unshift({
        role: 'system',
        content: 'You are a helpful research assistant. Provide factual, well-sourced information.'
      });
    }

    // Ensure the sequence alternates properly and ends with a user message
    const fixedMessages = [];
    let lastRole = null;

    for (const msg of validMessages) {
      // Skip consecutive messages with the same role (except system messages)
      if (msg.role === lastRole && msg.role !== 'system') {
        continue;
      }

      fixedMessages.push(msg);
      lastRole = msg.role;
    }

    // If the last message is not from the user, add a user message
    if (fixedMessages[fixedMessages.length - 1].role !== 'user') {
      fixedMessages.push({
        role: 'user',
        content: 'Please provide information on this topic based on our conversation.'
      });
    }

    return fixedMessages;
  }
}

const perplexityService = new PerplexityService();
export default perplexityService;