/**
 * Perplexity API Service
 * 
 * Provides a robust interface for interacting with the Perplexity API,
 * including both standard and deep research capabilities.
 */

const RobustAPIClient = require('../utils/apiClient');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const PERPLEXITY_API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const RESULTS_DIR = path.join('test-results', 'deep-research');
const COMPLETED_DIR = path.join('test-results', 'deep-research-results');
const POLL_INTERVAL = 30000; // 30 seconds between poll attempts
const MAX_POLL_ATTEMPTS = 60; // Up to 30 minutes of polling

// Circuit breaker for API calls
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000, // 1 minute
  monitorInterval: 10000,
  name: 'perplexity-api'
});

// Create robust API client with retry and timeout capabilities
const apiClient = new RobustAPIClient({
  baseURL: PERPLEXITY_API_ENDPOINT,
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  circuitBreaker,
  logger
});

/**
 * Ensure result directories exist
 */
async function ensureDirectoriesExist() {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await fs.mkdir(COMPLETED_DIR, { recursive: true });
    logger.debug('Created perplexity result directories');
  } catch (error) {
    logger.error(`Error creating perplexity result directories: ${error.message}`);
  }
}
ensureDirectoriesExist();

/**
 * Standard query using the fast online model
 * 
 * @param {string} query - The query to send to Perplexity
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The API response
 */
async function query(query, options = {}) {
  const requestId = options.requestId || uuidv4();
  const model = options.model || 'llama-3.1-sonar-small-128k-online';
  const systemPrompt = options.systemPrompt || 'You are a knowledgeable research assistant with access to up-to-date information.';
  const temperature = options.temperature || 0.7;
  const maxTokens = options.maxTokens || 1000;
  
  logger.debug(`[${requestId}] Sending standard query to Perplexity API using model ${model}`);
  
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature,
    max_tokens: maxTokens
  };
  
  // Add search context if specified
  if (options.searchContext) {
    payload.search_context = options.searchContext;
  }
  
  try {
    const response = await apiClient.post(
      PERPLEXITY_API_ENDPOINT,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        }
      }
    );
    
    logger.debug(`[${requestId}] Received response from Perplexity API (model: ${model})`);
    
    // Save result if requested
    if (options.saveResult) {
      const resultFile = path.join(RESULTS_DIR, `request-${requestId}-${Date.now()}.json`);
      await fs.writeFile(resultFile, JSON.stringify(response.data, null, 2));
      logger.debug(`[${requestId}] Saved result to ${resultFile}`);
    }
    
    return {
      success: true,
      requestId,
      model,
      data: response.data,
      content: extractContent(response.data),
      citations: extractCitations(response.data)
    };
    
  } catch (error) {
    logger.error(`[${requestId}] Error querying Perplexity API (model: ${model}): ${error.message}`);
    
    if (error.response) {
      logger.error(`[${requestId}] API Error Status: ${error.response.status}`);
      logger.error(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      success: false,
      requestId,
      model,
      error: error.message,
      details: error.response ? error.response.data : null
    };
  }
}

/**
 * Initiate a deep research request
 * 
 * @param {string} query - The query to research
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Information about the initiated research
 */
async function initiateDeepResearch(query, options = {}) {
  const requestId = options.requestId || uuidv4();
  const systemPrompt = options.systemPrompt || 
    'You are a research assistant with expertise in business strategy and pricing models. Provide detailed, well-structured answers with specific examples and data points.';
  const temperature = options.temperature || 0.7;
  const maxTokens = options.maxTokens || 4000;
  
  logger.info(`[${requestId}] Initiating deep research: "${query.substring(0, 50)}..."`);
  
  const payload = {
    model: 'sonar-deep-research',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature,
    max_tokens: maxTokens,
    search_context: 'high'
  };
  
  try {
    const response = await apiClient.post(
      PERPLEXITY_API_ENDPOINT,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        }
      }
    );
    
    const responseData = response.data;
    logger.info(`[${requestId}] Successfully initiated deep research`);
    
    // Save intermediate result
    const resultFile = path.join(RESULTS_DIR, `request-${requestId}-${Date.now()}-intermediate.json`);
    await fs.writeFile(resultFile, JSON.stringify(responseData, null, 2));
    logger.debug(`[${requestId}] Saved intermediate result to ${resultFile}`);
    
    // Check if this is a polling response or a direct completion
    const pollUrl = extractPollUrl(responseData);
    
    if (pollUrl) {
      logger.info(`[${requestId}] Deep research requires polling. Poll URL: ${pollUrl}`);
      
      return {
        success: true,
        requestId,
        status: 'in_progress',
        pollUrl,
        data: responseData,
        requiresPolling: true
      };
    } else if (isCompletedResponse(responseData)) {
      logger.info(`[${requestId}] Deep research completed immediately (no polling required)`);
      
      // Save to completed directory
      const completedFile = path.join(COMPLETED_DIR, `request-${requestId}-${Date.now()}-completed.json`);
      await fs.writeFile(completedFile, JSON.stringify(responseData, null, 2));
      logger.debug(`[${requestId}] Saved completed result to ${completedFile}`);
      
      return {
        success: true,
        requestId,
        status: 'completed',
        data: responseData,
        requiresPolling: false,
        content: extractContent(responseData),
        citations: extractCitations(responseData)
      };
    } else {
      logger.warn(`[${requestId}] Unclear response status. No poll URL found and response doesn't appear to be complete.`);
      
      return {
        success: true,
        requestId,
        status: 'unclear',
        data: responseData,
        requiresPolling: false
      };
    }
    
  } catch (error) {
    logger.error(`[${requestId}] Error initiating deep research: ${error.message}`);
    
    if (error.response) {
      logger.error(`[${requestId}] API Error Status: ${error.response.status}`);
      logger.error(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
      
      // Save error information
      const errorFile = path.join(RESULTS_DIR, `request-${requestId}-error-${Date.now()}.json`);
      await fs.writeFile(errorFile, JSON.stringify({
        error: error.message,
        status: error.response.status,
        data: error.response.data
      }, null, 2));
      logger.debug(`[${requestId}] Saved error details to ${errorFile}`);
    }
    
    return {
      success: false,
      requestId,
      status: 'failed',
      error: error.message,
      details: error.response ? error.response.data : null
    };
  }
}

/**
 * Poll for deep research results
 * 
 * @param {string} pollUrl - The URL to poll for results
 * @param {string} requestId - The request ID
 * @param {number} maxAttempts - Maximum number of polling attempts
 * @returns {Promise<Object>} - The completed research results or error information
 */
async function pollForResults(pollUrl, requestId, maxAttempts = MAX_POLL_ATTEMPTS) {
  if (!pollUrl) {
    logger.error(`[${requestId}] No poll URL provided for polling`);
    return {
      success: false,
      requestId,
      status: 'failed',
      error: 'No poll URL provided'
    };
  }
  
  logger.info(`[${requestId}] Starting to poll for results: ${pollUrl}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.debug(`[${requestId}] Poll attempt ${attempt}/${maxAttempts}`);
    
    try {
      const response = await apiClient.get(pollUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        }
      });
      
      const responseData = response.data;
      
      // Save intermediate polling result
      const resultFile = path.join(RESULTS_DIR, `request-${requestId}-poll-${attempt}-${Date.now()}.json`);
      await fs.writeFile(resultFile, JSON.stringify(responseData, null, 2));
      logger.debug(`[${requestId}] Saved poll result ${attempt} to ${resultFile}`);
      
      // Check if research is completed
      if (isCompletedResponse(responseData)) {
        logger.info(`[${requestId}] ✅ Deep research completed after ${attempt} poll attempts`);
        
        // Save completed result
        const completedFile = path.join(COMPLETED_DIR, `request-${requestId}-completed-${Date.now()}.json`);
        await fs.writeFile(completedFile, JSON.stringify(responseData, null, 2));
        logger.info(`[${requestId}] Saved completed result to ${completedFile}`);
        
        return {
          success: true,
          requestId,
          status: 'completed',
          data: responseData,
          content: extractContent(responseData),
          citations: extractCitations(responseData),
          pollAttempts: attempt
        };
      }
      
      logger.debug(`[${requestId}] Research still in progress, waiting ${POLL_INTERVAL/1000} seconds before next poll`);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      
    } catch (error) {
      logger.error(`[${requestId}] Error during poll attempt ${attempt}: ${error.message}`);
      
      if (error.response) {
        logger.error(`[${requestId}] Poll Error Status: ${error.response.status}`);
        logger.error(`[${requestId}] Poll Error Data: ${JSON.stringify(error.response.data)}`);
      }
      
      // If this is not the last attempt, wait and continue
      if (attempt < maxAttempts) {
        const backoffTime = Math.min(POLL_INTERVAL * Math.pow(1.5, attempt - 1), 5 * 60 * 1000); // Max 5 minutes
        logger.debug(`[${requestId}] Backing off for ${backoffTime/1000} seconds before retry`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        logger.error(`[${requestId}] Exceeded maximum poll attempts (${maxAttempts}), giving up`);
        return {
          success: false,
          requestId,
          status: 'failed',
          error: `Exceeded maximum poll attempts: ${error.message}`,
          pollAttempts: attempt
        };
      }
    }
  }
  
  logger.error(`[${requestId}] Polling timed out without completion`);
  return {
    success: false,
    requestId,
    status: 'timed_out',
    error: 'Polling timed out without completion'
  };
}

/**
 * Conduct a complete deep research operation
 * This handles both the initial request and polling phase
 * 
 * @param {string} query - The query to research
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The completed research or error information
 */
async function conductDeepResearch(query, options = {}) {
  const requestId = options.requestId || uuidv4();
  
  logger.info(`[${requestId}] Starting complete deep research process for query: "${query.substring(0, 50)}..."`);
  
  // Initiate the research
  const initiateResult = await initiateDeepResearch(query, {
    ...options,
    requestId
  });
  
  if (!initiateResult.success) {
    logger.error(`[${requestId}] Failed to initiate deep research: ${initiateResult.error}`);
    return initiateResult;
  }
  
  // Check if we need to poll for results
  if (initiateResult.requiresPolling && initiateResult.pollUrl) {
    logger.info(`[${requestId}] Initiating polling phase for deep research`);
    
    return await pollForResults(
      initiateResult.pollUrl, 
      requestId,
      options.maxPollAttempts || MAX_POLL_ATTEMPTS
    );
  } else if (initiateResult.status === 'completed') {
    logger.info(`[${requestId}] Deep research completed immediately (no polling needed)`);
    return initiateResult;
  } else {
    logger.warn(`[${requestId}] Unclear status after initiating deep research`);
    return initiateResult;
  }
}

/**
 * Check if a response is a final completion
 * 
 * @param {Object} response - The API response to check
 * @returns {boolean} - Whether the response indicates completion
 */
function isCompletedResponse(response) {
  if (!response) return false;
  
  // Check if response has citations (usually indicates completion)
  if (response.citations && response.citations.length > 0) return true;
  
  // Check if choices exist and have content
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.content) {
    return true;
  }
  
  // Check for specific status field
  if (response.status === 'completed') return true;
  
  return false;
}

/**
 * Extract poll URL from response
 * 
 * @param {Object} response - The API response
 * @returns {string|null} - The extracted poll URL or null
 */
function extractPollUrl(response) {
  if (!response) return null;
  
  // Check common formats for poll URLs
  if (response.poll_url) return response.poll_url;
  if (response.poll) return response.poll;
  
  // Check inside choices array
  if (response.choices && response.choices[0]) {
    const choice = response.choices[0];
    if (choice.poll_url) return choice.poll_url;
    if (choice.message && choice.message.poll_url) return choice.message.poll_url;
  }
  
  // Check metadata
  if (response.metadata && response.metadata.poll_url) {
    return response.metadata.poll_url;
  }
  
  return null;
}

/**
 * Extract content from response
 * 
 * @param {Object} response - The API response
 * @returns {string|null} - The extracted content or null
 */
function extractContent(response) {
  if (!response) return null;
  
  // Try to find content in different response formats
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.content) {
    return response.choices[0].message.content;
  }
  
  if (response.content) return response.content;
  
  return null;
}

/**
 * Extract citations from response
 * 
 * @param {Object} response - The API response
 * @returns {Array} - The extracted citations or empty array
 */
function extractCitations(response) {
  if (!response) return [];
  
  // Try to find citations in different response formats
  if (response.citations) return response.citations;
  
  // Some responses include citations in the message
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.citations) {
    return response.choices[0].message.citations;
  }
  
  return [];
}

/**
 * Extract model information from response
 * 
 * @param {Object} response - The API response
 * @param {string} defaultModel - Default model name if not found
 * @returns {string} - The model name
 */
function extractModelInfo(response, defaultModel = 'unknown') {
  if (!response) return defaultModel;
  
  // Try various paths where model info might be found
  if (response.model) return response.model;
  
  return defaultModel;
}

// Export the service functions
module.exports = {
  // Main API functions
  query,
  initiateDeepResearch,
  pollForResults,
  conductDeepResearch,
  
  // Helper functions
  isCompletedResponse,
  extractPollUrl,
  extractContent,
  extractCitations,
  extractModelInfo
};