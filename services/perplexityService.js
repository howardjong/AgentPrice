/**
 * Perplexity AI Service
 * 
 * This service provides an interface to Perplexity's Internet-connected models
 * and handles research capabilities with online search and analysis.
 */

const logger = require('../utils/logger');
const CircuitBreaker = require('../utils/circuitBreaker');
const RobustAPIClient = require('../utils/apiClient');
const axios = require('axios');

// Default timeout configuration
const DEFAULT_TIMEOUT = 120000; // 2 minutes
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 60; // Up to 5 minutes of polling
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const STANDARD_MODEL = 'sonar';

class PerplexityService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.circuitBreaker = new CircuitBreaker('perplexity', {
      failureThreshold: 3,
      resetTimeout: 30000
    });
    this.apiClient = new RobustAPIClient({
      baseURL: 'https://api.perplexity.ai',
      timeout: DEFAULT_TIMEOUT,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      circuitBreaker: this.circuitBreaker
    });

    this.status = {
      status: this.apiKey ? 'connected' : 'disconnected',
      lastCheck: new Date().toISOString(),
      model: STANDARD_MODEL,
      error: this.apiKey ? null : 'API key not configured'
    };

    logger.info('PerplexityService initialized');
  }

  getStatus() {
    return this.status;
  }

  async performResearch(query, options = {}) {
    try {
      logger.info(`Performing research for query: "${query.substring(0, 50)}..."`);

      const model = options.wantsDeepResearch ? DEEP_RESEARCH_MODEL : STANDARD_MODEL;
      logger.info(`Using model: ${model}`);

      const result = await this.circuitBreaker.execute(async () => {
        const response = await this.apiClient.post('/chat/completions', {
          model: model,
          messages: [{ role: 'user', content: query }],
          temperature: 0.2,
          max_tokens: 4000,
        });

        return response.data;
      });

      if (!result || !result.choices || !result.choices[0]) {
        throw new Error('Invalid response from Perplexity API');
      }

      const content = result.choices[0].message.content;
      let sources = [];

      // Check for sources/citations in the content
      try {
        // Extract sources if they exist in a common format
        const sourcesMatch = content.match(/Sources:[\s\n]+((?:.+[\n]?)+)/i);
        if (sourcesMatch && sourcesMatch[1]) {
          sources = sourcesMatch[1]
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => line.trim());
        }
      } catch (error) {
        logger.warn('Failed to extract sources from content', error);
      }

      // Update status after successful call
      this.status.status = 'connected';
      this.status.lastCheck = new Date().toISOString();
      this.status.model = model;
      this.status.error = null;

      return {
        content,
        sources,
        modelUsed: model,
        requestedModel: model
      };
    } catch (error) {
      logger.error('Error in PerplexityService.performResearch:', error);

      // Update status on error
      this.status.status = 'error';
      this.status.lastCheck = new Date().toISOString();
      this.status.error = error.message;

      throw error;
    }
  }

  async performDeepResearch(query, jobId = null, options = {}) {
    const wantsDeepResearch = options?.enableDeepResearch !== false;
    const model = wantsDeepResearch ? DEEP_RESEARCH_MODEL : STANDARD_MODEL;

    try {
      logger.info(`Performing ${wantsDeepResearch ? 'deep' : 'standard'} research for query: "${query.substring(0, 50)}..."`);
      logger.info(`Using model: ${model}, Job ID: ${jobId || 'auto-generated'}`);

      if (model === DEEP_RESEARCH_MODEL) {
        // Deep research mode uses async polling pattern
        return await this.performAsyncDeepResearch(query, jobId);
      } else {
        // Standard mode uses direct API call
        return await this.performResearch(query, { wantsDeepResearch: false });
      }
    } catch (error) {
      logger.error(`Error in PerplexityService.performDeepResearch (${model}):`, error);

      // Update status on error
      this.status.status = 'error';
      this.status.lastCheck = new Date().toISOString();
      this.status.error = error.message;

      throw error;
    }
  }

  async performAsyncDeepResearch(query, jobId = null) {
    try {
      logger.info(`Starting deep research with polling for query: "${query.substring(0, 50)}..."`);

      // Step 1: Start the deep research task
      const taskId = await this.startDeepResearchTask(query);
      logger.info(`Deep research task started with ID: ${taskId}`);

      // Step 2: Poll for results until complete or max attempts reached
      const result = await this.pollForDeepResearchResults(taskId);

      // Step 3: Process and return the results
      const content = result.choices[0].message.content;
      let sources = [];

      // Check for sources/citations in the content
      try {
        // Extract sources if they exist in a common format
        const sourcesMatch = content.match(/Sources:[\s\n]+((?:.+[\n]?)+)/i);
        if (sourcesMatch && sourcesMatch[1]) {
          sources = sourcesMatch[1]
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => line.trim());
        }
      } catch (error) {
        logger.warn('Failed to extract sources from content', error);
      }

      // Update status after successful call
      this.status.status = 'connected';
      this.status.lastCheck = new Date().toISOString();
      this.status.model = DEEP_RESEARCH_MODEL;
      this.status.error = null;

      return {
        content,
        sources,
        modelUsed: DEEP_RESEARCH_MODEL,
        requestedModel: DEEP_RESEARCH_MODEL
      };
    } catch (error) {
      logger.error('Error in PerplexityService.performAsyncDeepResearch:', error);

      // Update status on error
      this.status.status = 'error';
      this.status.lastCheck = new Date().toISOString();
      this.status.error = error.message;

      throw error;
    }
  }

  async startDeepResearchTask(query) {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        const response = await this.apiClient.post('/chat/completions', {
          model: DEEP_RESEARCH_MODEL,
          messages: [{ role: 'user', content: query }],
          temperature: 0.2,
          max_tokens: 4000,
        });

        return response.data;
      });

      if (!result || !result.id) {
        throw new Error('Invalid response from Perplexity API when starting deep research task');
      }

      return result.id;
    } catch (error) {
      logger.error('Error starting deep research task:', error);
      throw error;
    }
  }

  async pollForDeepResearchResults(taskId) {
    let attempts = 0;

    while (attempts < MAX_POLLING_ATTEMPTS) {
      try {
        logger.info(`Polling for deep research results (attempt ${attempts + 1}/${MAX_POLLING_ATTEMPTS})...`);

        const result = await this.circuitBreaker.execute(async () => {
          const response = await this.apiClient.get(`/chat/completions/${taskId}`);
          return response.data;
        });

        if (result.status === 'completed') {
          logger.info('Deep research task completed successfully');
          return result;
        }

        if (result.status === 'failed') {
          throw new Error(`Deep research task failed: ${result.error || 'Unknown error'}`);
        }

        // If still in progress, wait before polling again
        logger.info(`Deep research task still in progress (status: ${result.status}), waiting ${POLLING_INTERVAL/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        attempts++;
      } catch (error) {
        if (error.response && error.response.status === 429) {
          // Rate limit hit, wait longer before retrying
          logger.warn('Rate limit hit while polling for deep research results, waiting longer...');
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * 2));
          attempts++;
        } else {
          logger.error('Error polling for deep research results:', error);
          throw error;
        }
      }
    }

    throw new Error(`Deep research task timed out after ${MAX_POLLING_ATTEMPTS * POLLING_INTERVAL / 1000} seconds`);
  }
}

module.exports = new PerplexityService();