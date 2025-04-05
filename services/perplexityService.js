// Perplexity Service
// Handles interactions with the Perplexity API for research operations

import { default as RobustAPIClient } from '../utils/apiClient.js';
import CircuitBreaker from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 30;
const DEFAULT_MODEL = 'sonar';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';

// Initialize circuit breaker
const perplexityCircuitBreaker = new CircuitBreaker('perplexity', {
  failureThreshold: 3,
  resetTimeout: 30000
});

// Initialize API client with circuit breaker
const apiClient = new RobustAPIClient({
  baseURL: PERPLEXITY_API_URL,
  timeout: 60000,
  headers: {
    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  circuitBreaker: perplexityCircuitBreaker
});

/**
 * Extract model info from Perplexity API response
 * @param {Object} response - API response object
 * @returns {Object} - Model usage information
 */
function extractModelInfo(response) {
  try {
    if (!response || !response.data) {
      return { modelUsed: 'unknown' };
    }

    const modelUsed = response.data.model || 'unknown';
    return { modelUsed };
  } catch (error) {
    logger.error('Error extracting model info:', error);
    return { modelUsed: 'unknown' };
  }
}

/**
 * Polls the Perplexity API for deep research results
 * @param {string} taskId - Task ID from initial request
 * @param {number} attempts - Number of attempts made (for recursion)
 * @returns {Promise<Object>} Research results
 */
async function pollForResults(taskId, attempts = 0) {
  if (attempts >= MAX_POLLING_ATTEMPTS) {
    throw new Error(`Exceeded maximum polling attempts (${MAX_POLLING_ATTEMPTS})`);
  }

  try {
    const response = await apiClient.get(`/api/tasks/status/${taskId}`);

    if (response.data.status === 'completed') {
      logger.info(`Research completed after ${attempts} polling attempts`);
      return response.data;
    } else if (response.data.status === 'failed') {
      throw new Error(`Task failed: ${response.data.message || 'Unknown error'}`);
    } else {
      // Task still in progress, wait and poll again
      logger.debug(`Task in progress, polling attempt ${attempts + 1}/${MAX_POLLING_ATTEMPTS}`);
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
      return pollForResults(taskId, attempts + 1);
    }
  } catch (error) {
    // Handle rate limiting and server errors with exponential backoff
    if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
      const backoffTime = Math.min(POLLING_INTERVAL_MS * Math.pow(1.5, attempts), 30000);
      logger.warn(`Rate limited or server error (${error.response.status}), backing off for ${backoffTime}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return pollForResults(taskId, attempts + 1);
    }

    throw error;
  }
}

/**
 * Performs deep research using Perplexity API
 * @param {string} query - The research query
 * @param {string} jobId - Optional job ID for tracking
 * @returns {Promise<Object>} Research results
 */
async function performDeepResearch(query, jobId = uuidv4()) {
  logger.info(`Starting deep research for job ${jobId}: "${query}"`);

  // Select the model based on the depth of research required
  const model = DEEP_RESEARCH_MODEL;
  logger.info(`Using research model: ${model}`);

  try {
    // Step 1: Create the task
    const createTaskResponse = await apiClient.post('/api/tasks', {
      query,
      model
    });

    const taskId = createTaskResponse.data.task_id;
    logger.info(`Task created with ID: ${taskId}`);

    // Step 2: Poll for results
    const taskResult = await pollForResults(taskId);

    // Extract model info
    const modelInfo = extractModelInfo({ data: taskResult });

    // Step 3: Process and format the response
    const sources = taskResult.references || [];

    // Create the final response object
    const response = {
      jobId,
      taskId,
      content: taskResult.response || '',
      sources: sources.map(source => source.url || source.title || 'Unknown source'),
      modelUsed: modelInfo.modelUsed,
      requestedModel: model,
      timestamp: new Date().toISOString()
    };

    logger.info(`Deep research completed for job ${jobId}, sources: ${response.sources.length}`);
    return response;

  } catch (error) {
    logger.error(`Deep research failed for job ${jobId}:`, error);
    throw error;
  }
}

// Export functions
export { performDeepResearch };
export default { performDeepResearch };