/**
 * Perplexity Service for web research and information retrieval
 */
import axios from 'axios';
import logger from '../utils/logger.js';
import { RobustAPIClient } from '../utils/apiClient.js';

class PerplexityService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.model = 'llama-3.1-sonar-small-128k-online';
    this.isConnected = false;
    this.lastUsed = null;
    this.apiClient = new RobustAPIClient();
    
    this.initialize();
  }
  
  initialize() {
    try {
      if (!this.apiKey) {
        logger.warn('Perplexity API key not found in environment variables');
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
      service: 'perplexity',
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
      // Validate and prepare messages for the Perplexity API
      const validatedMessages = this.validateMessages(messages);
      
      const requestOptions = {
        method: 'POST',
        url: 'https://api.perplexity.ai/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: {
          model: this.model,
          messages: validatedMessages,
          temperature: options.temperature || 0.2,
          max_tokens: options.maxTokens || 1024,
          top_p: options.topP || 0.9,
          search_domain_filter: options.domainFilter || [],
          search_recency_filter: options.recencyFilter || "month",
          return_citations: true
        }
      };
      
      const response = await this.apiClient.request(requestOptions);
      this.lastUsed = new Date();
      
      return {
        response: response.data.choices[0].message.content,
        citations: response.data.citations || [],
        modelUsed: this.model,
        usage: response.data.usage || { total_tokens: 0 }
      };
    } catch (error) {
      logger.error('Error in Perplexity research', { error: error.message });
      throw new Error(`Perplexity API error: ${error.message}`);
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