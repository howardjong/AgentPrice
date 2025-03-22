/**
 * Perplexity Service for web research and information retrieval
 */
import axios from 'axios';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class PerplexityService {
  constructor() {
    this.apiKey = config.apis.perplexity.apiKey;
    this.model = config.apis.perplexity.model;
    this.isConnected = !!this.apiKey;
    this.baseUrl = 'https://api.perplexity.ai/chat/completions';
    
    if (!this.apiKey) {
      logger.warn('PERPLEXITY_API_KEY is not set. Perplexity service will not work properly.');
    } else {
      logger.info('Perplexity service initialized successfully');
    }
  }

  /**
   * Get status of Perplexity service
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      service: "Perplexity API",
      status: this.isConnected ? 'connected' : 'disconnected',
      lastUsed: this.lastUsed || null,
      version: this.model,
      error: this.isConnected ? undefined : 'API key not configured'
    };
  }

  /**
   * Perform research using Perplexity
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options for the research request
   * @returns {Promise<Object>} Research results
   */
  async performResearch(messages, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error("Perplexity service is not properly configured");
      }

      logger.info(`Performing research with Perplexity using model: ${this.model}`);
      this.lastUsed = new Date().toISOString();

      // Ensure we have proper message structure
      const validatedMessages = this.validateMessages(messages);
      
      // Prepare the request payload
      const payload = {
        model: this.model,
        messages: validatedMessages,
        max_tokens: options.max_tokens || config.apis.perplexity.maxTokens,
        temperature: options.temperature || 0.2,
        top_p: options.top_p || 0.9,
        search_domain_filter: options.search_domain_filter,
        stream: false,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: options.search_recency_filter || "month",
        frequency_penalty: options.frequency_penalty || 1
      };

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('Perplexity research completed successfully');
      
      return {
        status: 'success',
        message: response.data.choices[0].message.content,
        citations: response.data.citations || [],
        usage: {
          prompt_tokens: response.data.usage.prompt_tokens,
          completion_tokens: response.data.usage.completion_tokens,
          total_tokens: response.data.usage.total_tokens
        }
      };
    } catch (error) {
      logger.error(`Perplexity research error: ${error.message}`);
      
      // Extract more detailed error information if available
      const errorDetails = error.response?.data?.error || error.message;
      
      return {
        status: 'error',
        message: `Error performing research: ${errorDetails}`,
        error: errorDetails
      };
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
      // Default to a simple message if none provided
      return [{ role: 'user', content: 'Please research this topic' }];
    }

    // Ensure first message is system or user
    const validatedMessages = [...messages];
    
    if (validatedMessages[0].role !== 'system' && validatedMessages[0].role !== 'user') {
      validatedMessages[0].role = 'user';
    }
    
    // If first message is system, ensure second message is user
    if (validatedMessages[0].role === 'system' && validatedMessages.length > 1) {
      if (validatedMessages[1].role !== 'user') {
        validatedMessages[1].role = 'user';
      }
    }

    // Ensure messages alternate properly and end with user
    for (let i = 1; i < validatedMessages.length; i++) {
      if (validatedMessages[i-1].role === validatedMessages[i].role) {
        // If same role appears twice, change the role of the current message
        validatedMessages[i].role = validatedMessages[i-1].role === 'user' ? 'assistant' : 'user';
      }
    }

    // Ensure last message is from user
    if (validatedMessages[validatedMessages.length - 1].role !== 'user') {
      // Either change the last message or add a new user message
      if (validatedMessages.length > 1 && 
          validatedMessages[validatedMessages.length - 2].role === 'user') {
        // Last two messages are user and non-user, combine them
        const lastMsg = validatedMessages.pop();
        validatedMessages[validatedMessages.length - 1].content += `\n\nAdditional information:\n${lastMsg.content}`;
      } else {
        // Change the last message to user
        validatedMessages[validatedMessages.length - 1].role = 'user';
      }
    }

    return validatedMessages;
  }
}

// Create and export a singleton instance
const perplexityService = new PerplexityService();
export default perplexityService;