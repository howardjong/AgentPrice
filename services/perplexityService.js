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
      default: 'sonar',
      deepResearch: 'sonar-deep-research'
    };
    this.searchModes = {
      default: 'medium',
      deepResearch: 'high'
    };
    this.fallbackModels = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];
    this.fallbackConfig = {
      'sonar-deep-research': ['sonar-pro'],
      'sonar': ['llama-3.1-sonar-small-128k-online']
    };
    this.isConnected = false;
    this.lastUsed = null;
    this.apiClient = new RobustAPIClient({
      maxRetries: 2,
      timeout: 120000 // 2 minutes for long-running research
    });
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 300000 // 5 minutes
    });

    this.initialize();
  }

  initialize() {
    try {
      if (!this.apiKey) {
        logger.warn('Perplexity API key not found in environment variables');
        this.isConnected = false;

        // Log clear instructions for adding the API key
        logger.info('To enable Perplexity research functionality, add a PERPLEXITY_API_KEY to your environment or Replit secrets');
        return;
      }

      // Check if the API key appears to be valid (basic validation)
      if (this.apiKey.length < 20 || !this.apiKey.startsWith('pplx-')) {
        logger.warn('Perplexity API key appears to be invalid - should start with "pplx-" and be at least 20 characters');
        this.isConnected = false;
        return;
      }

      this.isConnected = true;
      logger.info('Perplexity service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Perplexity service', { error: error.message });
      this.isConnected = false;
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
        validatedMessages[lastMsgIndex].content = `${validatedMessages[lastMsgIndex].content}\n\nPlease provide the most up-to-date information available as of today, March 23, 2025. I need CURRENT information.`;
      }

      // Enhanced request options
      const requestOptions = {
        method: 'POST',
        url: 'https://api.perplexity.ai/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: {
          model: this.models.default,
          messages: validatedMessages,
          temperature: options.temperature || 0.1, // Lower temperature for more factual responses
          max_tokens: options.maxTokens || 1024,
          top_p: options.topP || 0.9,
          search_domain_filter: options.domainFilter || [], // Empty array allows searching all domains
          search_recency_filter: "day", // Get the most recent information
          top_k: options.topK || 15, // Increase number of search results to consider
          return_citations: true,
          frequency_penalty: 0.5, // Discourage repetitive text
          search_context_mode: "high" // High search context mode for more comprehensive search
        }
      };

      // Log the request
      logger.info('Sending enhanced request to Perplexity', {
        messageCount: requestOptions.data.messages.length,
        model: this.model, 
        recencyFilter: requestOptions.data.search_recency_filter
      });

      const response = await this.apiClient.request(requestOptions);
      this.lastUsed = new Date();

      // Log detailed information about the response
      logger.info('Perplexity API response received', { 
        citationsCount: (response.data.citations || []).length,
        contentLength: response.data.choices[0].message.content.length,
        promptTokens: response.data.usage?.prompt_tokens,
        completionTokens: response.data.usage?.completion_tokens
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
      const responseModel = response.data.model || this.model;
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
  async performDeepResearch(query, jobId) {
    if (!this.isConnected) {
      throw new Error('Perplexity service is not connected');
    }

    try {
      logger.info(`Initiating deep research`, { jobId, queryLength: query.length });

      // Get and format the prompt
      const promptTemplate = await promptManager.getPrompt('perplexity', 'deep_research');
      let formattedQuery = promptManager.formatPrompt(promptTemplate, { query });

      // Add an explicit instruction for current information
      formattedQuery += `\n\nMake sure to include only the most current information available as of today, March 23, 2025. This research must be based on the latest available data.`;

      // Use circuit breaker pattern for the API call
      return await this.circuitBreaker.executeRequest('perplexity-deep', async () => {
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
                content: formattedQuery 
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
          jobId,
          model: this.model,
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
              logger.info(`Attempting fallback to model ${fallbackModel}`, { jobId, originalModel: currentModel });
              requestOptions.data.model = fallbackModel;
              try {
                response = await this.apiClient.request(requestOptions);
                logger.info(`Successfully fell back to ${fallbackModel}`, { jobId });
                break;
              } catch (fallbackError) {
                logger.error(`Fallback to ${fallbackModel} failed`, { 
                  jobId,
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

        logger.info('Perplexity API response received', {
          duration: `${duration}ms`,
          citationsCount: (response.data.citations || []).length,
          jobId
        });

        if (!response.data?.choices?.[0]?.message) {
          throw new Error('Invalid response format from Perplexity API');
        }

        const responseData = response.data.choices[0].message;

        // Log full citations for debugging
        if (response.data.citations && response.data.citations.length > 0) {
          logger.info('Citations from deep research', {
            jobId,
            citations: response.data.citations.slice(0, 5) // Log first 5 citations
          });
        } else {
          logger.warn('No citations returned from deep research', { jobId });
        }

        logger.info('Deep research completed successfully', {
          jobId,
          contentLength: responseData.content.length
        });

        // Add explicit model information to the beginning of the deep research response
        // Use the actual model from the response payload rather than the requested model
        const responseModel = response.data.model || this.model;

        // Verify model matches what we requested
        if (responseModel !== this.models.deepResearch) {
          logger.warn('Model mismatch in deep research', {
            requestedModel: this.models.deepResearch,
            actualModel: responseModel,
            jobId
          });
        }

        const modelInfo = `[Using Perplexity AI - Model: ${responseModel}]\n\n`;
        const enhancedContent = modelInfo + responseData.content;

        return {
          query: formattedQuery,
          timestamp: new Date().toISOString(),
          content: enhancedContent,
          sources: response.data.citations || [],
          modelUsed: responseModel,
          requestedModel: this.models.deepResearch,
          usage: response.data.usage || { total_tokens: 0 }
        };
      });
    } catch (error) {
      logger.error('Error performing deep research', {
        jobId,
        error: error.message
      });

      if (error.response?.data) {
        logger.error('Perplexity API error details', {
          jobId,
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
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