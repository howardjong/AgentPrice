/**
 * Perplexity API Service
 * 
 * Provides a robust interface for interacting with the Perplexity API,
 * including both standard and deep research capabilities.
 */

import RobustAPIClient from '../utils/apiClient.js';
import CircuitBreaker from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios'; // Added axios for API calls


// Configuration
const PERPLEXITY_API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const API_URL = process.env.PERPLEXITY_API_URL || PERPLEXITY_API_ENDPOINT; // Use environment variable if available
const API_KEY = process.env.PERPLEXITY_API_KEY; // Added API key variable
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


/**
 * Perform deep research using Perplexity API
 * @param {string} query - The query to research
 * @param {Object} options - Options for the deep research request
 * @param {string} options.requestId - Custom request ID
 * @param {string} options.model - Model to use for research
 * @param {string[]} options.fallbackModels - Fallback models if primary fails
 * @param {string} options.systemPrompt - System prompt to use
 * @param {boolean} options.saveResult - Whether to save results to disk
 * @param {Function} options.onThinking - Callback for think process updates
 * @param {boolean} options.debugThinking - Enable additional thinking debug logs
 * @returns {Promise<Object>} - Research result
 */
async function performDeepResearch(query, options = {}) {
  const requestId = options.requestId || `dr-${uuidv4().substring(0, 8)}`;
  const model = options.model || 'sonar-deep-research';
  const fallbackModels = options.fallbackModels || ['sonar-pro', 'sonar'];
  const systemPrompt = options.systemPrompt || '';
  const saveResult = options.saveResult || false;
  const onThinking = options.onThinking || null;
  const debugThinking = options.debugThinking || false;

  logger.info(`Starting deep research with model: ${model} [${requestId}]`);

  // Store original model for tracking fallbacks
  const originalModel = model;
  let modelUsed = model;
  let modelAttempts = [model];
  let lastError = null;

  // First try with the primary model
  try {
    logger.info(`Attempting deep research with primary model: ${model} [${requestId}]`);

    // Add retry logic for the primary model
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await executeDeepResearch(query, {
          ...options,
          model,
          requestId,
          onThinking,
          debugThinking
        });

        logger.info(`Deep research successful with model: ${model} (attempt ${attempt}) [${requestId}]`);

        return {
          ...result,
          originalModel,
          modelUsed: result.modelUsed || model,
          attempt
        };
      } catch (error) {
        if (attempt < 2) {
          logger.warn(`Primary model ${model} failed on attempt ${attempt}: ${error.message}. Retrying... [${requestId}]`);
          // Wait briefly before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Last attempt failed, store the error and continue to fallbacks
          lastError = error;
          throw error;
        }
      }
    }
  } catch (primaryError) {
    logger.warn(`All attempts with primary model ${model} failed: ${primaryError.message} [${requestId}]`);
    lastError = primaryError;

    // Try fallback models in sequence
    if (fallbackModels && fallbackModels.length > 0) {
      for (const fallbackModel of fallbackModels) {
        try {
          logger.info(`Trying fallback model: ${fallbackModel} [${requestId}]`);
          modelAttempts.push(fallbackModel);

          const fallbackResult = await executeDeepResearch(query, {
            ...options,
            model: fallbackModel,
            requestId,
            onThinking,
            debugThinking
          });

          modelUsed = fallbackModel;
          logger.info(`Fallback to model ${fallbackModel} succeeded [${requestId}]`);

          return {
            ...fallbackResult,
            originalModel,
            modelUsed: fallbackResult.modelUsed || fallbackModel,
            fallbackUsed: true,
            modelAttempts,
            fallbackReason: lastError ? lastError.message : 'Primary model failed'
          };
        } catch (fallbackError) {
          logger.warn(`Fallback model ${fallbackModel} failed: ${fallbackError.message} [${requestId}]`);
          lastError = fallbackError;
        }
      }
    }

    // If we've tried all fallbacks and nothing worked, provide a detailed error
    const errorMessage = `All models failed for deep research. Last error: ${lastError?.message || 'Unknown error'}`;
    logger.error(`${errorMessage} [${requestId}]`, { 
      modelAttempts, 
      originalModel,
      lastError: lastError?.stack || lastError?.message
    });

    throw new Error(errorMessage);
  }
}

/**
 * Execute the deep research query with a specific model
 * This is an internal function used by performDeepResearch
 */
async function executeDeepResearch(query, options = {}) {
  const requestId = options.requestId || uuidv4().substring(0, 8);
  const model = options.model || 'sonar-deep-research';
  const context = options.context || '';
  const maxCitations = options.maxCitations || 15;
  const enableChunking = options.enableChunking || false;
  const onThinking = options.onThinking || null; // Add callback for thinking updates
  const debugThinking = options.debugThinking || false;


  logger.info(`Executing deep research with model: ${model} [${requestId}]`);

  // If chunking is enabled and the query is long, use chunked processing
  if (enableChunking && query.length > 2000) {
    logger.info(`Query length ${query.length} exceeds threshold, using chunked processing [${requestId}]`);
    return processChunkedDeepResearch(query, options);
  }

  // Create a system prompt tailored to the specific model
  let systemPrompt = 'You are a research assistant with deep internet search capabilities. Your task is to conduct comprehensive research on the topic provided and synthesize a detailed report with multiple relevant sources. ALWAYS search the web extensively before responding. Include ALL relevant citations.';

  // Add model-specific prompt adjustments
  if (model === 'sonar-deep-research') {
    systemPrompt += ' Utilize your deep research capabilities to provide the most comprehensive answer possible.';
  } else if (model === 'sonar-pro') {
    systemPrompt += ' Provide thorough research using all available online sources.';
  }

  // Create a message array with the user query
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: context 
        ? `${context}\n\nWith that context in mind, please research: ${query}`
        : `Please conduct deep, comprehensive research on the following topic: ${query}\n\nI need detailed information with recent sources. This research should be thorough and include comprehensive citations.`
    }
  ];

  // Create request with specified model and high search context
  const requestPayload = {
    model: model,
    messages,
    max_tokens: options.maxTokens || 4000,
    temperature: options.temperature || 0.1,
    top_p: options.topP || 0.95,
    search_recency_filter: options.recencyFilter || "day",
    stream: false,
    frequency_penalty: options.frequencyPenalty || 0.5,
    search_domain_filter: [], // Allow searching all domains
    top_k: maxCitations,
    search_context_mode: options.searchContextMode || "high"
  };

  // Log detailed request for debugging
  logger.info(`Sending deep research request with model: ${model} [${requestId}]`, {
    modelName: model,
    messageCount: messages.length,
    maxTokens: requestPayload.max_tokens,
    searchContextMode: requestPayload.search_context_mode
  });

  try {
    const response = await axios.post(
      API_URL,
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 180000 // 3 minutes timeout by default
      }
    );

    logger.info(`Deep research response received for model: ${model} [${requestId}]`);

    // Ensure response has the expected structure
    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      logger.error(`Unexpected response structure from Perplexity API [${requestId}]`, { 
        responseData: JSON.stringify(response.data).substring(0, 500) + '...' 
      });
      throw new Error('Unexpected response structure from Perplexity API');
    }

    // Extract citations and content
    const citations = response.data.citations || [];
    const content = response.data.choices[0].message?.content;

    if (!content) {
      logger.error(`No content in response from Perplexity API [${requestId}]`);
      throw new Error('No content in response from Perplexity API');
    }

    // Add model information to the content
    const responseModel = response.data.model || model;
    const modelInfo = `[Using Perplexity AI - Deep Research Model: ${responseModel}]\n\n`;
    const enhancedContent = modelInfo + content;

    // Extract thinking content if available
    let thinkingContent = '';
    if (response.data.choices[0]?.message?.content) {
      const content = response.data.choices[0].message.content;

      // Debug the raw response if debug mode is enabled
      if (debugThinking) {
        logger.debug(`Raw message content structure for thinking extraction [${requestId}]:`, {
          contentLength: content.length,
          contentSnippet: content.substring(0, 100) + '...',
          hasThinkTags: content.includes('<think>')
        });
      }

      // First check for think tags in the standard format
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);

      if (thinkMatch && thinkMatch[1] && onThinking) {
        // We found thinking content
        if (debugThinking) {
          logger.debug(`Found thinking content in standard format [${requestId}]`, {
            thinkingLength: thinkMatch[1].length
          });
        }
        thinkingContent = thinkMatch[1];
        onThinking(thinkingContent);
      } 
      // Alternative format detection - some models use different formats
      else if (content.includes('thinking:') && onThinking) {
        const altThinkMatch = content.match(/thinking:([\s\S]*?)(?:\n\n|$)/);
        if (altThinkMatch && altThinkMatch[1]) {
          if (debugThinking) {
            logger.debug(`Found thinking content in alternative format [${requestId}]`);
          }
          thinkingContent = altThinkMatch[1];
          onThinking(thinkingContent);
        }
      }
      // Extended thinking format detection
      else if (content.includes('<think') && onThinking) {
        // Some variations might use attributes or different closing tags
        const extendedThinkMatch = content.match(/<think[^>]*>([\s\S]*?)<\/think>/);
        if (extendedThinkMatch && extendedThinkMatch[1]) {
          if (debugThinking) {
            logger.debug(`Found thinking content in extended format [${requestId}]`);
          }
          thinkingContent = extendedThinkMatch[1];
          onThinking(thinkingContent);
        }
      }
      // Raw content passage for very long responses
      else if (onThinking && content.length > 1000) {
        // For very long responses without explicit think tags, send the raw content
        // This is a fallback to see what we're getting in the raw response
        if (debugThinking) {
          logger.debug(`No explicit thinking tags found, sending raw content [${requestId}]`);
        }
        thinkingContent = `RAW CONTENT (no explicit thinking tags):\n${content.substring(0, 500)}...`;
        onThinking(thinkingContent);
      }
    }

    // Log successful response details
    logger.info(`Deep research successful with model: ${responseModel} [${requestId}]`, {
      citationsCount: citations.length,
      contentLength: content.length,
      finishReason: response.data.choices[0].finish_reason || 'unknown',
      hasThinking: !!thinkingContent
    });

    // Save successful response for future reference if requested
    if (options.saveResult) {
      const resultFile = path.join(RESULTS_DIR, `request-${requestId}-${Date.now()}-completed.json`);
      await fs.writeFile(resultFile, JSON.stringify({
        query,
        model: responseModel,
        response: response.data,
        enhancedContent,
        citations
      }, null, 2));
      logger.debug(`[${requestId}] Saved successful result to ${resultFile}`);
    }

    return {
      content: enhancedContent,
      citations,
      modelUsed: responseModel,
      requestId,
      usage: response.data.usage || null,
      thinking: thinkingContent || null
    };
  } catch (error) {
    // Enhance error handling with specific error types
    let errorMessage = `Error with model ${model} for deep research: ${error.message}`;
    let errorType = 'unknown';

    if (error.response) {
      // Extract API error details
      const statusCode = error.response.status;
      const errorData = error.response.data;

      // Categorize errors for better handling
      if (statusCode === 400) {
        errorType = 'bad_request';
        errorMessage = `Bad request to Perplexity API: ${JSON.stringify(errorData)}`;
      } else if (statusCode === 401) {
        errorType = 'authentication';
        errorMessage = 'Authentication error: Invalid API key';
      } else if (statusCode === 404) {
        errorType = 'model_not_found';
        errorMessage = `Model not found: ${model}`;
      } else if (statusCode === 429) {
        errorType = 'rate_limit';
        errorMessage = 'Rate limit exceeded for Perplexity API';
      } else if (statusCode >= 500) {
        errorType = 'service_error';
        errorMessage = `Perplexity service error (${statusCode})`;
      }

      logger.error(`${errorType} error with model ${model} [${requestId}]: ${errorMessage}`, {
        statusCode,
        errorData: JSON.stringify(errorData).substring(0, 500)
      });
    } else if (error.code === 'ECONNABORTED') {
      errorType = 'timeout';
      errorMessage = `Request timed out after ${options.timeout || 180000}ms`;
      logger.error(`Timeout error with model ${model} [${requestId}]: ${errorMessage}`);
    } else {
      logger.error(`Error with model ${model} for deep research [${requestId}]: ${error.message}`, {
        stack: error.stack
      });
    }

    // Create enhanced error object
    const enhancedError = new Error(errorMessage);
    enhancedError.type = errorType;
    enhancedError.model = model;
    enhancedError.originalError = error;
    enhancedError.requestId = requestId;

    throw enhancedError;
  }
}

// Placeholder function -  Needs implementation if chunking is used
async function processChunkedDeepResearch(query, options) {
  // Implement logic for handling chunked deep research queries here
  throw new Error("Chunked deep research not yet implemented");
}


// Export the service functions
export default {
  // Main API functions
  query,
  initiateDeepResearch,
  pollForResults,
  conductDeepResearch,
  performDeepResearch, // Added performDeepResearch
  executeDeepResearch, //Added executeDeepResearch

  // Helper functions
  isCompletedResponse,
  extractPollUrl,
  extractContent,
  extractCitations,
  extractModelInfo
};