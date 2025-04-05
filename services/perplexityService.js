import CircuitBreaker from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';
import axios from 'axios';

// Initialize circuit breaker for API calls
const circuitBreaker = new CircuitBreaker('perplexity', {
  failureThreshold: 3,
  resetTimeout: 30000
});

// Set up Perplexity API configuration
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';

const perplexityService = {
  /**
   * Performs deep research using Perplexity API
   * @param {string} query - The research query
   * @param {string} jobId - Unique identifier for the job
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Research results
   */
  async performDeepResearch(query, jobId, options = {}) {
    const modelToUse = options.wantsDeepResearch ? 'sonar-deep-research' : 'sonar';

    try {
      logger.info(`Starting ${modelToUse} research for: "${query}"`, { jobId });

      const requestData = {
        model: modelToUse,
        query: query,
        focus: options.focus || 'internet',
        follow_up_questions: options.followUpQuestions !== false,
        temperature: options.temperature || 0.7
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      };

      const response = await circuitBreaker.execute(async () => {
        const result = await axios.post(`${PERPLEXITY_API_URL}/chat/completions`, requestData, { headers });
        return result.data;
      });

      // Process response data
      const content = response.answer || response.text || '';
      const sources = this.extractSources(response);

      logger.info(`Completed research for "${query}" using ${modelToUse}`, { jobId });

      return {
        content,
        sources,
        modelUsed: modelToUse,
        requestedModel: modelToUse,
        rawResponse: response
      };
    } catch (error) {
      logger.error(`Error during research: ${error.message}`, { jobId });
      throw error;
    }
  },

  /**
   * Processes a web search query using standard search model
   * @param {string} query - The search query
   * @returns {Promise<Object>} - Search results
   */
  async processWebQuery(query) {
    try {
      logger.info(`Processing web query: "${query}"`);

      const requestData = {
        model: 'sonar',
        query: query,
        focus: 'internet',
        follow_up_questions: false
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      };

      const response = await circuitBreaker.execute(async () => {
        const result = await axios.post(`${PERPLEXITY_API_URL}/chat/completions`, requestData, { headers });
        return result.data;
      });

      const content = response.answer || response.text || '';
      const sources = this.extractSources(response);

      return {
        content,
        sources,
        modelUsed: 'sonar'
      };
    } catch (error) {
      logger.error(`Error during web query: ${error.message}`);
      throw error;
    }
  },

  /**
   * Extracts sources from the Perplexity API response
   * @param {Object} response - The API response
   * @returns {Array} - Extracted sources
   */
  extractSources(response) {
    try {
      if (response.citations && Array.isArray(response.citations)) {
        return response.citations.map(citation => citation.url || citation.text || '');
      } else if (response.references && Array.isArray(response.references)) {
        return response.references.map(ref => ref.url || ref.title || '');
      } else if (response.links && Array.isArray(response.links)) {
        return response.links;
      }
      return [];
    } catch (err) {
      logger.warn('Error extracting sources from response:', err);
      return [];
    }
  },

  /**
   * Get the status of the Perplexity service
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      status: circuitBreaker.getState() === 'closed' ? 'connected' : 'disconnected',
      circuitState: circuitBreaker.getState()
    };
  }
};

export default perplexityService;