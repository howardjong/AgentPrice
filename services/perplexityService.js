
import RobustAPIClient from '../utils/apiClient.js';
import CircuitBreaker from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';

dotenv.config();

const API_KEY = process.env.PERPLEXITY_API_KEY;
const BASE_URL = 'https://api.perplexity.ai';
const DEFAULT_MODEL = 'sonar';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const MAX_POLLING_ATTEMPTS = 30;
const POLLING_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes

// Initialize circuit breaker for Perplexity API
const perplexityBreaker = new CircuitBreaker({
  name: BASE_URL,
  failureThreshold: 3,
  resetTimeout: 30000,
  maxRequestTimeout: DEFAULT_TIMEOUT_MS
});

class PerplexityService {
  constructor() {
    this.apiClient = new RobustAPIClient({
      baseURL: BASE_URL,
      timeout: DEFAULT_TIMEOUT_MS,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      circuitBreaker: perplexityBreaker
    });
    this.logger = logger;
    this.isInitialized = !!API_KEY;
  }

  getStatus() {
    return {
      status: this.isInitialized ? 'connected' : 'disconnected',
      apiKey: !!API_KEY,
      breakerStatus: perplexityBreaker.getState()
    };
  }

  /**
   * Process a standard web query using Perplexity API
   * @param {string} query - The query to process
   * @param {Object} options - Options for the query
   * @returns {Promise<Object>} The query result with content and sources
   */
  async processWebQuery(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Perplexity service not initialized: API key missing');
    }

    const model = options.model || DEFAULT_MODEL;
    
    try {
      this.logger.info(`Processing web query with model ${model}`, { 
        component: 'perplexityService', 
        model,
        queryLength: query.length
      });

      const response = await this.apiClient.post('/query', {
        model: model,
        query: query,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7
      });

      return {
        content: response.data.text || response.data.answer || '',
        sources: this._extractSources(response.data),
        modelUsed: response.data.model || model,
        requestedModel: model
      };
    } catch (error) {
      this.logger.error(`Error in processWebQuery: ${error.message}`, { 
        component: 'perplexityService',
        error: error.message,
        model
      });
      throw error;
    }
  }

  /**
   * Performs deep research using Perplexity API's async task-based approach
   * @param {string} query - The research query
   * @param {string} jobId - Unique ID for this research job
   * @param {Object} options - Options for the deep research
   * @returns {Promise<Object>} The deep research results
   */
  async performDeepResearch(query, jobId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Perplexity service not initialized: API key missing');
    }

    const useDeepResearch = options.enableChunking !== false;
    const model = useDeepResearch ? DEEP_RESEARCH_MODEL : DEFAULT_MODEL;
    
    this.logger.info(`Starting ${useDeepResearch ? 'deep' : 'standard'} research`, {
      component: 'perplexityService',
      jobId,
      model,
      queryLength: query.length
    });

    try {
      // For non-deep research, use the standard query endpoint
      if (!useDeepResearch) {
        return this.processWebQuery(query, { model: DEFAULT_MODEL, ...options });
      }

      // Create the deep research task
      const createTaskResponse = await this.apiClient.post('/tasks', {
        model: model,
        query: query,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.2
      });

      const taskId = createTaskResponse.data.id;
      this.logger.info(`Deep research task created: ${taskId}`, {
        component: 'perplexityService',
        taskId,
        jobId
      });

      // Poll for task completion
      const result = await this._pollForTaskCompletion(taskId, jobId);
      
      return {
        content: result.answer || result.text || '',
        sources: this._extractSources(result),
        modelUsed: result.model || model,
        requestedModel: model,
        taskId: taskId
      };
    } catch (error) {
      this.logger.error(`Error in performDeepResearch: ${error.message}`, {
        component: 'perplexityService',
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Poll for task completion with a backoff strategy
   * @private
   * @param {string} taskId - The task ID to poll
   * @param {string} jobId - Job identifier for logging
   * @returns {Promise<Object>} The completed task result
   */
  async _pollForTaskCompletion(taskId, jobId) {
    let attempts = 0;
    let interval = POLLING_INTERVAL_MS;

    while (attempts < MAX_POLLING_ATTEMPTS) {
      attempts++;
      
      try {
        const taskResponse = await this.apiClient.get(`/tasks/${taskId}`);
        const { status, answer, text, model } = taskResponse.data;
        
        if (status === 'completed') {
          this.logger.info(`Task completed successfully after ${attempts} polls`, {
            component: 'perplexityService',
            taskId,
            jobId,
            attempts
          });
          return taskResponse.data;
        }
        
        if (status === 'failed') {
          throw new Error(`Task failed: ${taskResponse.data.error || 'Unknown error'}`);
        }

        // Implement exponential backoff with a maximum interval
        interval = Math.min(interval * 1.5, 10000); // Max 10s between polls
        this.logger.info(`Task in progress, polling again in ${interval}ms (attempt ${attempts}/${MAX_POLLING_ATTEMPTS})`, {
          component: 'perplexityService',
          taskId,
          jobId,
          status
        });
        
        await setTimeout(interval);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          throw new Error(`Task ${taskId} not found`);
        }
        
        // For other errors, retry a few times then give up
        if (attempts > 3) {
          throw error;
        }
        
        this.logger.warn(`Error polling task (attempt ${attempts}), will retry: ${error.message}`, {
          component: 'perplexityService',
          taskId,
          error: error.message
        });
        
        await setTimeout(interval);
      }
    }
    
    throw new Error(`Task polling timed out after ${attempts} attempts`);
  }

  /**
   * Extract sources from the API response
   * @private
   * @param {Object} data - API response data
   * @returns {Array<string>} Array of source URLs
   */
  _extractSources(data) {
    try {
      if (data.sources && Array.isArray(data.sources)) {
        return data.sources.map(source => 
          source.url || source.title || source.name || 'Unknown source'
        ).filter(Boolean);
      }
      
      if (data.web_search_results && Array.isArray(data.web_search_results)) {
        return data.web_search_results.map(result => 
          result.url || result.title || 'Unknown source'
        ).filter(Boolean);
      }
      
      if (data.references && Array.isArray(data.references)) {
        return data.references.map(ref => 
          ref.url || ref.title || ref.text || 'Unknown reference'
        ).filter(Boolean);
      }
      
      return [];
    } catch (error) {
      this.logger.warn(`Error extracting sources: ${error.message}`, {
        component: 'perplexityService'
      });
      return [];
    }
  }
}

const perplexityService = new PerplexityService();
export default perplexityService;
