/**
 * Perplexity AI Service
 * 
 * This service provides an interface to Perplexity's Internet-connected models
 * and handles research capabilities with online search and analysis.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import CircuitBreaker from '../utils/circuitBreaker.js';
import RobustAPIClient from '../utils/apiClient.js';
import costTracker from '../utils/costTracker.js';
import * as fs from 'fs/promises';
import path from 'path';

// Default model configuration
const DEFAULT_MODEL = 'sonar'; // Use generic 'sonar' as default
const SONAR_MODELS = {
  default: 'sonar', // Standard model for regular searches
  pro: 'sonar-pro', // Pro model with enhanced capabilities
  large: 'sonar-large', // Fallback for large context
  deepResearch: 'sonar-deep-research' // Specialized for deep research
};
const API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';

// API key validation
if (!process.env.PERPLEXITY_API_KEY) {
  logger.warn('PERPLEXITY_API_KEY is not set - Perplexity service will not function properly');
}

// Create robust API client
const robustPerplexityClient = new RobustAPIClient({
  name: 'perplexity',
  apiKeyEnvVar: 'PERPLEXITY_API_KEY',
  onRetry: (error, attempt) => {
    logger.warn(`Retrying Perplexity API call (attempt ${attempt}): ${error.message}`);
    
    // Special handling for rate limit errors
    if (error.response && error.response.status === 429) {
      logger.warn('Rate limit reached with Perplexity API, using exponential backoff');
      return Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff up to 30 seconds
    }
  }
});

// Circuit breaker for API calls
const circuitBreaker = new CircuitBreaker({
  name: 'perplexity-api',
  failureThreshold: 3,
  resetTimeout: 30000,
  onOpen: () => {
    logger.error('Perplexity API circuit breaker opened due to failures');
  },
  onClose: () => {
    logger.info('Perplexity API circuit breaker closed, service recovered');
  }
});

/**
 * Process a web-connected query with Perplexity
 * @param {string} query - The user's query
 * @param {Object} options - Configuration options
 * @param {string} options.model - The Perplexity model to use
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @param {string} options.recencyFilter - Time filter for search results (day, week, month, year)
 * @param {number} options.timeout - Request timeout in milliseconds
 * @returns {Promise<Object>} - Perplexity's response
 */
async function processWebQuery(query, options = {}) {
  const requestId = uuidv4();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.2; // Lower temperature for factual answers
  const recencyFilter = options.recencyFilter || 'month';
  const timeout = options.timeout || 30000; // Default to 30 seconds
  
  logger.info(`Processing web query with Perplexity [${requestId}]`, { 
    model, 
    queryLength: query.length,
    maxTokens,
    recencyFilter
  });
  
  const requestData = {
    model: model,
    messages: [
      {
        role: 'system',
        content: options.systemPrompt || 'Be precise and concise. Cite your sources.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
    search_domain_filter: options.domainFilter || [],
    return_images: false,
    return_related_questions: false,
    search_recency_filter: recencyFilter,
    top_k: 0,
    stream: false,
    presence_penalty: 0,
    frequency_penalty: 1
  };
  
  const startTime = Date.now();
  
  try {
    // Use the circuit breaker to protect against API failures
    const response = await circuitBreaker.execute(() => {
      return robustPerplexityClient.execute(async () => {
        return axios.post(API_ENDPOINT, requestData, {
          headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout // Add timeout parameter
        });
      });
    });
    
    const duration = Date.now() - startTime;
    const result = response.data;
    
    // Track costs for the API call
    costTracker.recordUsage({
      service: 'perplexity',
      model,
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
      operation: 'web_query',
      requestId
    });
    
    // Save response for debugging/analysis if enabled
    if (process.env.SAVE_PERPLEXITY_RESPONSES === 'true') {
      try {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `perplexity-response-${timestamp}.txt`;
        await fs.writeFile(
          path.join(process.cwd(), filename), 
          JSON.stringify(result, null, 2)
        );
      } catch (error) {
        logger.warn('Failed to save Perplexity response', { error: error.message });
      }
    }
    
    logger.info(`Perplexity web query completed [${requestId}]`, {
      duration,
      tokens: result.usage?.total_tokens || 'unknown',
      citationsCount: result.citations?.length || 0
    });
    
    return {
      content: result.choices[0]?.message?.content || '',
      citations: result.citations || [],
      usage: result.usage,
      model: result.model,
      requestId
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const statusCode = error.response?.status || 'unknown';
    const errorDetails = error.response?.data || {};
    
    logger.error(`Error processing web query with Perplexity [${requestId}]`, {
      error: error.message,
      statusCode,
      errorDetails,
      duration
    });
    
    // Specific error handling for common issues
    if (statusCode === 429) {
      throw new Error('Perplexity API rate limit exceeded. Please try again later.');
    }
    
    throw new Error(`Perplexity web query failed: ${error.message}`);
  }
}

/**
 * Process a conversational exchange with Perplexity
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Configuration options
 * @param {string} options.model - The Perplexity model to use
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @param {boolean} options.webSearch - Whether to enable web search
 * @param {number} options.timeout - Request timeout in milliseconds
 * @returns {Promise<Object>} - Perplexity's response
 */
async function processConversation(messages, options = {}) {
  const requestId = uuidv4();
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.5;
  const systemPrompt = options.systemPrompt || '';
  const enableWebSearch = options.webSearch !== false; // Enable by default for Perplexity
  const timeout = options.timeout || 30000; // Default to 30 seconds
  
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array of message objects');
  }
  
  // Check that messages alternate properly
  let lastUserIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      if (i - lastUserIndex === 1) {
        throw new Error('Messages must alternate between user and assistant roles');
      }
      lastUserIndex = i;
    }
  }
  
  // Ensure last message is from user
  if (messages.length > 0 && messages[messages.length - 1].role !== 'user') {
    throw new Error('Last message must be from user');
  }
  
  // Add system message if provided
  const conversationMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;
    
  const requestData = {
    model: model,
    messages: conversationMessages,
    max_tokens: maxTokens,
    temperature: temperature,
    search_domain_filter: options.domainFilter || [],
    return_images: false,
    return_related_questions: false,
    search_recency_filter: options.recencyFilter || 'month',
    top_k: 0,
    stream: false,
    presence_penalty: 0,
    frequency_penalty: 1
  };
  
  logger.info(`Processing conversation with Perplexity [${requestId}]`, { 
    model, 
    messagesCount: messages.length,
    maxTokens,
    webSearch: enableWebSearch
  });
  
  const startTime = Date.now();
  
  try {
    // Use the circuit breaker to protect against API failures
    const response = await circuitBreaker.execute(() => {
      return robustPerplexityClient.execute(async () => {
        return axios.post(API_ENDPOINT, requestData, {
          headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout // Add timeout parameter
        });
      });
    });
    
    const duration = Date.now() - startTime;
    const result = response.data;
    
    // Track costs for the API call
    costTracker.recordUsage({
      service: 'perplexity',
      model,
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
      operation: 'conversation',
      requestId
    });
    
    logger.info(`Perplexity conversation completed [${requestId}]`, {
      duration,
      tokens: result.usage?.total_tokens || 'unknown',
      citationsCount: result.citations?.length || 0
    });
    
    return {
      content: result.choices[0]?.message?.content || '',
      citations: result.citations || [],
      usage: result.usage,
      model: result.model,
      requestId
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error processing conversation with Perplexity [${requestId}]`, {
      error: error.message,
      duration
    });
    throw new Error(`Perplexity conversation failed: ${error.message}`);
  }
}

/**
 * Conduct deep research on a topic with Perplexity
 * @param {string} query - The research query
 * @param {Object} options - Research configuration options
 * @param {string} options.model - The Perplexity model to use
 * @param {Array} options.domainFilter - List of domains to filter search results
 * @param {string} options.recencyFilter - Time filter for search results
 * @param {number} options.timeout - Request timeout in milliseconds
 * @returns {Promise<Object>} - Research results
 */
async function conductDeepResearch(query, options = {}) {
  const requestId = uuidv4();
  // For deep research, we use the specialized deep research model
  const model = options.model || SONAR_MODELS.deepResearch;
  const maxTokens = options.maxTokens || 4096; // Larger token limit for deep research
  const timeout = options.timeout || 60000; // Longer timeout for deep research
  
  // Create a more detailed system prompt for deep research
  const systemPrompt = options.systemPrompt || 
    'You are an expert research assistant. Conduct a comprehensive analysis of this topic. ' +
    'Include key insights, varied perspectives, and cite your sources. Organize your findings ' +
    'clearly with section headings. Focus on providing substantive, detailed, and accurate information.';
    
  logger.info(`Starting deep research with Perplexity [${requestId}]`, { 
    model, 
    query,
    domainFilter: options.domainFilter || 'none', 
    recencyFilter: options.recencyFilter || 'month'
  });
  
  try {
    // For deep research, we'll make multiple API calls to get more comprehensive results
    
    // Log research options for debugging
    logger.info(`Deep research options [${requestId}]`, {
      model,
      maxTokens,
      timeout,
      fullResponseMode: options.fullResponse === true
    });
    
    // Initial broad query
    const initialResults = await processWebQuery(query, {
      model,
      maxTokens,
      temperature: 0.2,
      systemPrompt,
      domainFilter: options.domainFilter || [],
      recencyFilter: options.recencyFilter || 'month',
      timeout // Pass timeout to processWebQuery
    });
    
    // Generate follow-up questions based on initial results
    const followUpResponse = await processWebQuery(
      `Based on the following research, what are 3-5 important follow-up questions that would help expand and deepen the research?\n\n${initialResults.content}`,
      {
        model: SONAR_MODELS.default, // Use default model for this intermediate step
        maxTokens: 1024,
        temperature: 0.7, // Higher temperature for more diverse questions
        systemPrompt: 'Generate specific, targeted follow-up research questions. Be concise and focus on gaps in the initial research.',
        timeout // Pass timeout
      }
    );
    
    // Extract follow-up questions (simple extraction, could be improved with better parsing)
    const followUpContent = followUpResponse.content;
    let followUpQuestions = [];
    
    // Basic extraction of numbered items
    const questionMatches = followUpContent.match(/\d+\.\s+(.*?)(?=\d+\.|$)/gs);
    if (questionMatches && questionMatches.length > 0) {
      followUpQuestions = questionMatches.map(q => q.replace(/^\d+\.\s+/, '').trim());
    } else {
      // Fallback to line-by-line
      followUpQuestions = followUpContent.split('\n')
        .filter(line => line.trim().length > 10 && line.trim().includes('?'))
        .map(line => line.trim())
        .slice(0, 3); // Limit to 3 questions
    }
    
    logger.info(`Generated ${followUpQuestions.length} follow-up questions for deep research [${requestId}]`);
    
    // Research follow-up questions (limited to 2 for cost/time efficiency)
    const followUpLimit = Math.min(2, followUpQuestions.length);
    const followUpResearch = await Promise.all(
      followUpQuestions.slice(0, followUpLimit).map(async (question) => {
        try {
          const result = await processWebQuery(question, {
            model,
            maxTokens: Math.floor(maxTokens / 2), // Shorter responses for follow-ups
            temperature: 0.2,
            systemPrompt: 'Focus specifically on this aspect of the research topic. Be concise but thorough.',
            domainFilter: options.domainFilter || [],
            recencyFilter: options.recencyFilter || 'month',
            timeout // Pass timeout
          });
          return { question, result };
        } catch (error) {
          logger.error(`Error processing follow-up question [${requestId}]`, {
            error: error.message,
            question
          });
          return { question, error: error.message };
        }
      })
    );
    
    // Synthesize all findings into a cohesive report
    const researchMaterial = [
      `Initial research on "${query}":\n${initialResults.content}`,
      ...followUpResearch
        .filter(item => !item.error)
        .map(item => `Follow-up on "${item.question}":\n${item.result.content}`)
    ].join('\n\n');
    
    const synthesisPrompt = `Synthesize the following research materials into a comprehensive report. 
Organize with clear section headings, maintain factual accuracy, and cite sources appropriately.
    
${researchMaterial}`;
    
    const synthesisResponse = await processWebQuery(synthesisPrompt, {
      model,
      maxTokens: maxTokens,
      temperature: 0.2,
      systemPrompt: 'You are creating a final comprehensive research report. Organize the information logically, eliminate redundancy, and ensure all key insights are preserved with proper citation.',
      timeout // Pass timeout
    });
    
    // Combine all citations from each step
    const allCitations = [
      ...initialResults.citations || [],
      ...followUpResearch
        .filter(item => !item.error && item.result.citations)
        .flatMap(item => item.result.citations),
      ...synthesisResponse.citations || []
    ];
    
    // Remove duplicate citations
    const uniqueCitations = allCitations.filter((citation, index, self) => 
      index === self.findIndex(c => c === citation)
    );
    
    logger.info(`Deep research completed successfully [${requestId}]`, {
      citationsCount: uniqueCitations.length,
      followUpQuestionsCount: followUpQuestions.length,
      processedFollowUpCount: followUpResearch.length
    });
    
    // Check if we should return the full raw API response (for debugging)
    const shouldIncludeRawResponse = options.fullResponse === true;
    
    // Create the response object
    const response = {
      content: synthesisResponse.content,
      citations: uniqueCitations,
      followUpQuestions,
      model,
      modelUsed: synthesisResponse.model || model, // Use the actual model from the response if available
      requestId
    };
    
    // Include raw API response if requested (for debugging/testing)
    if (shouldIncludeRawResponse) {
      // Format sources in a more detailed way for API response debugging
      const formattedSources = uniqueCitations.map((citation, index) => {
        // Extract basic URL and title from citation strings
        const urlMatch = citation.match(/https?:\/\/[^\s)]+/);
        const titleMatch = citation.match(/"([^"]+)"/);
        
        return {
          id: `source-${index + 1}`,
          title: titleMatch ? titleMatch[1] : `Source ${index + 1}`,
          url: urlMatch ? urlMatch[0] : null,
          text: citation
        };
      });
      
      response.apiResponse = {
        model: synthesisResponse.model,
        id: synthesisResponse.requestId || `perplexity-${requestId}`,
        usage: synthesisResponse.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        choices: [{ message: { content: synthesisResponse.content }}],
        sources: formattedSources
      };
      
      // Also include the parsed sources in the main response
      response.sources = formattedSources;
    }
    
    return response;
  } catch (error) {
    logger.error(`Error conducting deep research [${requestId}]`, {
      error: error.message
    });
    throw new Error(`Deep research failed: ${error.message}`);
  }
}

/**
 * Get health status of the Perplexity service
 * @returns {Object} - Health status information
 */
function getHealthStatus() {
  return {
    service: 'perplexity',
    status: process.env.PERPLEXITY_API_KEY ? 'available' : 'unavailable',
    circuitBreakerStatus: circuitBreaker.getState(),
    defaultModel: DEFAULT_MODEL,
    availableModels: SONAR_MODELS
  };
}

// Create a default export object
const perplexityService = {
  processWebQuery,
  processConversation,
  performDeepResearch: conductDeepResearch, // Alias to match the name used in tests
  conductDeepResearch,
  getHealthStatus,
};

export default perplexityService;

// Also export individual functions
export {
  processWebQuery,
  processConversation,
  conductDeepResearch,
  getHealthStatus,
  SONAR_MODELS
};
