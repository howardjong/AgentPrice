/**
 * Claude AI Service
 * 
 * This service provides an interface to Anthropic's Claude AI models
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import CircuitBreaker from '../utils/circuitBreaker.js';
import RobustAPIClient from '../utils/apiClient.js';
import * as costTracker from '../utils/costTracker.js';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

// API key validation
if (!process.env.ANTHROPIC_API_KEY) {
  logger.warn('ANTHROPIC_API_KEY is not set - Claude service will not function properly');
}

// Initialize Anthropic client with circuit breaker protection
const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create robust API client
const robustAnthropicClient = new RobustAPIClient({
  name: 'anthropic',
  apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  onRetry: (error, attempt) => {
    logger.warn(`Retrying Anthropic API call (attempt ${attempt}): ${error.message}`);
  }
});

// Circuit breaker for API calls
const circuitBreaker = new CircuitBreaker({
  name: 'anthropic-api',
  failureThreshold: 3,
  resetTimeout: 30000,
  onOpen: () => {
    logger.error('Anthropic API circuit breaker opened due to failures');
  },
  onClose: () => {
    logger.info('Anthropic API circuit breaker closed, service recovered');
  }
});

/**
 * Process text with Claude AI
 * @param {string} prompt - The prompt to send to Claude
 * @param {Object} options - Configuration options
 * @param {string} options.model - The Claude model to use
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @returns {Promise<Object>} - Claude's response
 */
async function processText(prompt, options = {}) {
  const requestId = uuidv4();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.7;
  
  logger.info(`Processing text with Claude [${requestId}]`, { 
    model, 
    promptLength: prompt.length,
    maxTokens
  });
  
  const startTime = Date.now();
  
  try {
    // Use the circuit breaker to protect against API failures
    const response = await circuitBreaker.execute(() => {
      return robustAnthropicClient.execute(async () => {
        return anthropicClient.messages.create({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
          temperature
        });
      });
    });
    
    const duration = Date.now() - startTime;
    
    // Track costs for the API call
    costTracker.trackAPIUsage({
      service: 'anthropic',
      model,
      tokensUsed: response.usage?.total_tokens || 0,
      duration
    });
    
    logger.info(`Claude processing completed [${requestId}]`, {
      duration,
      tokens: response.usage?.total_tokens || 'unknown'
    });
    
    return {
      content: response.content[0]?.text || '',
      usage: response.usage,
      model: response.model,
      requestId
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error processing text with Claude [${requestId}]`, {
      error: error.message,
      duration
    });
    throw new Error(`Claude processing failed: ${error.message}`);
  }
}

/**
 * Process multimodal content with Claude AI
 * @param {Array} content - Array of content objects with type and data
 * @param {Object} options - Configuration options
 * @param {string} options.model - The Claude model to use
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @returns {Promise<Object>} - Claude's response
 */
async function processMultimodal(content, options = {}) {
  const requestId = uuidv4();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.7;
  
  if (!Array.isArray(content)) {
    throw new Error('Content must be an array of content objects');
  }
  
  // Convert content array to Claude's format
  const messages = [{
    role: 'user',
    content
  }];
  
  logger.info(`Processing multimodal content with Claude [${requestId}]`, { 
    model, 
    contentTypes: content.map(item => item.type).join(','),
    maxTokens
  });
  
  const startTime = Date.now();
  
  try {
    // Use the circuit breaker to protect against API failures
    const response = await circuitBreaker.execute(() => {
      return robustAnthropicClient.execute(async () => {
        return anthropicClient.messages.create({
          model,
          max_tokens: maxTokens,
          messages,
          temperature
        });
      });
    });
    
    const duration = Date.now() - startTime;
    
    // Track costs for the API call
    costTracker.trackAPIUsage({
      service: 'anthropic',
      model,
      tokensUsed: response.usage?.total_tokens || 0,
      duration,
      isMultimodal: true
    });
    
    logger.info(`Claude multimodal processing completed [${requestId}]`, {
      duration,
      tokens: response.usage?.total_tokens || 'unknown'
    });
    
    return {
      content: response.content[0]?.text || '',
      usage: response.usage,
      model: response.model,
      requestId
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error processing multimodal content with Claude [${requestId}]`, {
      error: error.message,
      duration
    });
    throw new Error(`Claude multimodal processing failed: ${error.message}`);
  }
}

/**
 * Create a conversation with Claude AI
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Configuration options
 * @param {string} options.model - The Claude model to use
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @returns {Promise<Object>} - Claude's response
 */
async function processConversation(messages, options = {}) {
  const requestId = uuidv4();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.7;
  const systemPrompt = options.systemPrompt || '';
  
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array of message objects');
  }
  
  // Create the request object
  const requestObject = {
    model,
    max_tokens: maxTokens,
    messages,
    temperature
  };
  
  // Add system prompt if provided
  if (systemPrompt) {
    requestObject.system = systemPrompt;
  }
  
  logger.info(`Processing conversation with Claude [${requestId}]`, { 
    model, 
    messagesCount: messages.length,
    maxTokens
  });
  
  const startTime = Date.now();
  
  try {
    // Use the circuit breaker to protect against API failures
    const response = await circuitBreaker.execute(() => {
      return robustAnthropicClient.execute(async () => {
        return anthropicClient.messages.create(requestObject);
      });
    });
    
    const duration = Date.now() - startTime;
    
    // Track costs for the API call
    costTracker.trackAPIUsage({
      service: 'anthropic',
      model,
      tokensUsed: response.usage?.total_tokens || 0,
      duration
    });
    
    logger.info(`Claude conversation processing completed [${requestId}]`, {
      duration,
      tokens: response.usage?.total_tokens || 'unknown'
    });
    
    return {
      content: response.content[0]?.text || '',
      usage: response.usage,
      model: response.model,
      requestId
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error processing conversation with Claude [${requestId}]`, {
      error: error.message,
      duration
    });
    throw new Error(`Claude conversation processing failed: ${error.message}`);
  }
}

/**
 * Get health status of the Claude service
 * @returns {Object} - Health status information
 */
function getHealthStatus() {
  return {
    service: 'claude',
    status: process.env.ANTHROPIC_API_KEY ? 'available' : 'unavailable',
    circuitBreakerStatus: circuitBreaker.getState(),
    defaultModel: DEFAULT_MODEL
  };
}

export {
  processText,
  processMultimodal,
  processConversation,
  getHealthStatus
};