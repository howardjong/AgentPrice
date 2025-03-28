/**
 * Tiered Response Strategy
 * 
 * Implements multiple tiers of API response quality to optimize costs
 * based on budget usage and request importance.
 */

import logger from './logger.js';
import costTracker from './costTracker.js';

// Define the tiers and their characteristics
const TIER_CONFIG = {
  minimal: {
    description: 'Minimal responses optimized for lowest cost',
    maxTokens: 500,
    temperature: 0.3,
    systemPromptAppend: 'Provide very brief, concise responses using simple language. Limit explanations and examples.',
    costMultiplier: 0.5
  },
  standard: {
    description: 'Standard balanced responses',
    maxTokens: 1000,
    temperature: 0.7,
    systemPromptAppend: '',
    costMultiplier: 1.0
  },
  premium: {
    description: 'High-quality detailed responses',
    maxTokens: 2000,
    temperature: 0.8,
    systemPromptAppend: 'Provide comprehensive, detailed responses with examples and thorough explanations.',
    costMultiplier: 2.0
  }
};

class TieredResponseStrategy {
  constructor() {
    this.logger = require('./logger.js').default;
    this.responseCache = {};
    this.timeouts = {
      basic: 5000,      // 5 seconds
      standard: 15000,  // 15 seconds
      enhanced: 30000   // 30 seconds
    };
  }

  /**
   * Generate a response based on the desired tier
   * @param {string} queryId - Unique ID for the query
   * @param {string} tier - Response tier (basic, standard, enhanced)
   * @param {Object} context - Query context information
   */
  async getResponse(queryId, tier = 'standard', context = {}) {
    // Check if we have any cached responses for this query
    if (!this.responseCache[queryId]) {
      this.responseCache[queryId] = {};
    }

    // If the requested tier is already cached, return it
    if (this.responseCache[queryId][tier]) {
      this.logger.info(`Using cached ${tier} tier response for query ${queryId}`);
      return this.responseCache[queryId][tier];
    }

    // If we need to generate a new response
    let response;

    try {
      // Generate appropriate response based on tier with timeout protection
      response = await this._generateResponseWithTimeout(tier, context);

      // Cache the response
      this.responseCache[queryId][tier] = response;

      return response;
    } catch (error) {
      this.logger.error(`Error generating ${tier} tier response: ${error.message}`);

      // Fallback to lower tier if available
      if (tier === 'enhanced') {
        this.logger.info('Falling back to standard tier response');
        return this.getResponse(queryId, 'standard', context);
      } else if (tier === 'standard') {
        this.logger.info('Falling back to basic tier response');
        return this.getResponse(queryId, 'basic', context);
      }

      // Return a minimal response if all else fails
      return {
        content: `Could not generate response: ${error.message}`,
        tier: 'minimal',
        error: true,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Process with timeout protection
  async _generateResponseWithTimeout(tier, context) {
    const timeout = this.timeouts[tier] || 15000;

    return new Promise(async (resolve, reject) => {
      // Set timeout handler
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);

      try {
        let response;

        // Generate appropriate response based on tier
        switch(tier) {
          case 'basic':
            response = await this._generateBasicResponse(context);
            break;
          case 'standard':
            response = await this._generateStandardResponse(context);
            break;
          case 'enhanced':
            response = await this._generateEnhancedResponse(context);
            break;
          default:
            response = await this._generateStandardResponse(context);
        }

        clearTimeout(timeoutId);
        resolve(response);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  // Private methods to generate different response tiers
  async _generateBasicResponse(context) {
    // Implementation would use a basic model or template
    return {
      content: `Basic response for: ${context.query || 'unknown query'}`,
      tier: 'basic',
      timestamp: new Date().toISOString()
    };
  }

  async _generateStandardResponse(context) {
    // Implementation would use a standard model or more detailed template
    return {
      content: `Standard response for: ${context.query || 'unknown query'}`,
      tier: 'standard',
      timestamp: new Date().toISOString()
    };
  }

  async _generateEnhancedResponse(context) {
    // Implementation would use the most advanced model
    return {
      content: `Enhanced response for: ${context.query || 'unknown query'}`,
      tier: 'enhanced',
      timestamp: new Date().toISOString()
    };
  }
}

const tieredResponseStrategy = new TieredResponseStrategy();

// Add tier configuration properties for monitoring and metrics
tieredResponseStrategy.defaultTier = 'standard';
tieredResponseStrategy.currentTier = 'standard';
tieredResponseStrategy.autoDowngrade = true;
tieredResponseStrategy.downgradeTrigger = 0.9; // 90% of budget
tieredResponseStrategy.costMultipliers = TIER_CONFIG;
tieredResponseStrategy.requestsProcessed = 0;
tieredResponseStrategy.downgrades = 0;

// Add status method for monitoring
tieredResponseStrategy.getStatus = function() {
  return {
    enabled: true,
    defaultTier: this.defaultTier,
    currentTier: this.currentTier,
    autoDowngrade: this.autoDowngrade
  };
};

// Add method to get request options based on tier
tieredResponseStrategy.getRequestOptions = function(requestParams) {
  const tier = requestParams.forceTier || this.currentTier;
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.standard;
  
  return {
    model: requestParams.service === 'perplexity' ? 'sonar' : 'claude-3-7-sonnet-20250219',
    tokenLimit: tierConfig.maxTokens,
    cacheSettings: {
      ttl: tier === 'premium' ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 2 hours for premium, 24 hours otherwise
    }
  };
};

module.exports = tieredResponseStrategy;