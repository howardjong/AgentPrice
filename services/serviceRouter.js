/**
 * Service Router
 * 
 * This module intelligently routes requests between different AI services (Claude & Perplexity)
 * based on query needs, service availability, and optimization rules.
 */

import logger from '../utils/logger.js';
import ClaudeService from './claudeService.js';
import PerplexityService from './perplexityService.js';

/**
 * Service Router class for managing AI service selection
 */
class ServiceRouter {
  /**
   * Create a ServiceRouter instance
   * @param {Object} options - Configuration options
   * @param {Object} options.claudeOptions - Options for Claude service
   * @param {Object} options.perplexityOptions - Options for Perplexity service
   * @param {Object} options.cacheProvider - Cache provider
   * @param {Object} options.costTracker - Cost tracking service
   */
  constructor(options = {}) {
    const {
      claudeOptions = {},
      perplexityOptions = {},
      cacheProvider = null,
      costTracker = null
    } = options;

    // Initialize services with common cache provider
    this.claudeService = new ClaudeService({
      ...claudeOptions,
      cacheProvider
    });

    this.perplexityService = new PerplexityService({
      ...perplexityOptions,
      cacheProvider
    });

    this.cacheProvider = cacheProvider;
    this.costTracker = costTracker;
    this.servicesHealth = {
      claude: true,
      perplexity: true
    };

    // Initialize request patterns for routing decisions
    this.internetAccessPatterns = [
      /current events/i,
      /latest news/i,
      /what happened (today|yesterday|this week|this month)/i,
      /recent developments/i,
      /updated information/i,
      /stock (price|market)/i,
      /weather/i,
      /sports (results|scores)/i
    ];

    this.deepResearchPatterns = [
      /in-depth analysis/i,
      /comprehensive research/i,
      /detailed (report|investigation)/i,
      /academic (research|paper|study)/i,
      /scholarly (articles|sources)/i,
      /deep research/i
    ];

    this.imageGenerationPatterns = [
      /generate (an?|the) image/i,
      /create (an?|the) (image|picture|graphic)/i,
      /visualize/i,
      /make (an?|the) (image|picture|graphic)/i
    ];

    this.chartGenerationPatterns = [
      /create (an?|the|a) (chart|graph|plot|visualization)/i,
      /generate (an?|the|a) (chart|graph|plot|visualization)/i,
      /visualize this data/i,
      /(create|make) (an?|the|a) (bar|line|pie|scatter|donut|area) (chart|graph|plot)/i
    ];
  }

  /**
   * Route a query to the appropriate service
   * @param {String} query - The user query
   * @param {Object} options - Routing options
   * @returns {Promise<Object>} - The response from the selected service
   */
  async routeQuery(query, options = {}) {
    const {
      preferredService = null,
      forceDeepResearch = false,
      skipCache = false,
      systemPrompt = null
    } = options;

    try {
      // First check for explicit routing choices
      if (preferredService === 'claude') {
        logger.debug('Using Claude service based on explicit preference');
        return await this.claudeService.query(query, { skipCache, system: systemPrompt });
      }

      if (preferredService === 'perplexity') {
        logger.debug('Using Perplexity service based on explicit preference');
        
        if (forceDeepResearch || this._matchesDeepResearchPattern(query)) {
          logger.debug('Using Perplexity deep research mode');
          return await this.perplexityService.deepResearch(query, { skipCache, systemPrompt });
        }
        
        return await this.perplexityService.query(query, { skipCache, systemPrompt });
      }

      // If no explicit preference, make intelligent routing decision
      const needsInternet = this._needsInternetAccess(query);
      const needsDeepResearch = forceDeepResearch || this._matchesDeepResearchPattern(query);
      const needsChartGeneration = this._needsChartGeneration(query);

      // Track the routing decision for analytics
      if (this.costTracker) {
        this.costTracker.trackDecision(
          needsInternet ? 'internet_access' : 'no_internet',
          needsDeepResearch ? 'deep_research' : 'standard_query',
          needsChartGeneration ? 'chart_generation' : 'text_only'
        );
      }

      // Handle special cases first
      if (needsChartGeneration) {
        logger.debug('Routing to Claude for chart generation');
        return await this.claudeService.generateChart(query, { skipCache });
      }

      // Handle internet-requiring queries
      if (needsInternet) {
        logger.debug('Query requires internet access, routing to Perplexity');
        
        if (needsDeepResearch) {
          logger.debug('Using Perplexity deep research mode');
          return await this.perplexityService.deepResearch(query, { skipCache, systemPrompt });
        }
        
        return await this.perplexityService.query(query, { skipCache, systemPrompt });
      }

      // Default to Claude for standard queries
      logger.debug('Using Claude for standard query');
      return await this.claudeService.query(query, { skipCache, system: systemPrompt });
    } catch (error) {
      logger.error(`Error routing query: ${error.message}`, { stack: error.stack });
      
      // Try to gracefully fall back to an alternative service
      if (error.message.includes('Claude') && this.servicesHealth.perplexity) {
        logger.warn('Falling back to Perplexity service due to Claude error');
        this.servicesHealth.claude = false;
        return await this.perplexityService.query(query, { skipCache, systemPrompt });
      }
      
      if (error.message.includes('Perplexity') && this.servicesHealth.claude) {
        logger.warn('Falling back to Claude service due to Perplexity error');
        this.servicesHealth.perplexity = false;
        return await this.claudeService.query(query, { skipCache, system: systemPrompt });
      }
      
      // If fallback also fails, re-throw with better context
      throw new Error(`Failed to route query to any available service: ${error.message}`);
    }
  }

  /**
   * Generate a chart using Claude
   * @param {String} description - Chart description
   * @param {Object} options - Chart options
   * @returns {Promise<Object>} - The chart generation response
   */
  async generateChart(description, options = {}) {
    return await this.claudeService.generateChart(description, options);
  }

  /**
   * Analyze an image using Claude
   * @param {String} base64Image - Base64 encoded image
   * @param {String} prompt - Analysis prompt
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - The image analysis response
   */
  async analyzeImage(base64Image, prompt, options = {}) {
    return await this.claudeService.analyzeImage(base64Image, prompt, options);
  }

  /**
   * Check if a query needs internet access
   * @param {String} query - The user query
   * @returns {Boolean} - True if query likely needs internet access
   * @private
   */
  _needsInternetAccess(query) {
    // Check against internet access patterns
    return this.internetAccessPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Check if a query matches deep research patterns
   * @param {String} query - The user query
   * @returns {Boolean} - True if query likely needs deep research
   * @private
   */
  _matchesDeepResearchPattern(query) {
    // Check against deep research patterns
    return this.deepResearchPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Check if a query needs chart generation
   * @param {String} query - The user query
   * @returns {Boolean} - True if query likely involves chart generation
   * @private
   */
  _needsChartGeneration(query) {
    // Check against chart generation patterns
    return this.chartGenerationPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Clean up resources when router is no longer needed
   */
  destroy() {
    this.claudeService.destroy();
    this.perplexityService.destroy();
  }
}

export default ServiceRouter;