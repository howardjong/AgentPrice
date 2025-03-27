
/**
 * Cost Tracker Utility
 * Tracks and reports LLM API usage costs
 */
import logger from './logger.js';
import fs from 'fs/promises';
import path from 'path';

class CostTracker {
  constructor() {
    this.costs = {
      totalCost: 0,
      services: {
        perplexity: {
          calls: 0,
          tokens: {
            input: 0,
            output: 0,
            total: 0
          },
          cost: 0
        },
        claude: {
          calls: 0,
          tokens: {
            input: 0,
            output: 0,
            total: 0
          },
          cost: 0
        },
        other: {
          calls: 0,
          tokens: {
            input: 0,
            output: 0,
            total: 0
          },
          cost: 0
        }
      },
      models: {},
      hourly: {},
      daily: {},
      monthly: {}
    };
    
    // Rate card for different models (cost per 1000 tokens)
    this.rateCard = {
      // Perplexity models
      'sonar': { input: 0.4, output: 0.4 },  // $0.4 per million tokens
      'sonar-pro': { input: 0.8, output: 0.8 }, // $0.8 per million tokens 
      'sonar-deep-research': { input: 1.0, output: 1.0 }, // $1.0 per million tokens
      
      // Claude models
      'claude-3-haiku': { input: 8.0, output: 8.0 }, // $8 per million tokens
      'claude-3-sonnet': { input: 15.0, output: 15.0 }, // $15 per million tokens
      'claude-3-opus': { input: 30.0, output: 30.0 }, // $30 per million tokens
      
      // Default fallback rate
      'default': { input: 10.0, output: 10.0 } // $10 per million tokens
    };
    
    // Initialize timestamps for periodic saving
    this.lastSaveTime = Date.now();
    this.autoSaveInterval = 15 * 60 * 1000; // 15 minutes
    
    // Cost saving features activation status
    this.costSavingFeatures = {
      caching: { enabled: true, savings: 0 },
      tokenOptimization: { enabled: true, savings: 0 },
      modelDowngrading: { enabled: false, savings: 0 },
      batchProcessing: { enabled: false, savings: 0 },
      apiDisabling: { enabled: false, savings: 0 }
    };
  }
  
  /**
   * Track cost for an API call
   * @param {Object} params - Parameters for cost tracking
   * @returns {Object} Cost information
   */
  trackCost(params) {
    const {
      service = 'other',
      model = 'default',
      inputTokens = 0,
      outputTokens = 0,
      totalTokens = inputTokens + outputTokens,
      cached = false,
      tokensOptimized = 0
    } = params;
    
    // Get the current time
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const hourKey = `${now.getFullYear()}-${month}-${day}-${hour}`;
    const dayKey = `${now.getFullYear()}-${month}-${day}`;
    const monthKey = `${now.getFullYear()}-${month}`;
    
    // Initialize periods if they don't exist
    if (!this.costs.hourly[hourKey]) {
      this.costs.hourly[hourKey] = { cost: 0, calls: 0, tokens: 0 };
    }
    
    if (!this.costs.daily[dayKey]) {
      this.costs.daily[dayKey] = { cost: 0, calls: 0, tokens: 0 };
    }
    
    if (!this.costs.monthly[monthKey]) {
      this.costs.monthly[monthKey] = { cost: 0, calls: 0, tokens: 0 };
    }
    
    // Initialize model if it doesn't exist
    if (!this.costs.models[model]) {
      this.costs.models[model] = {
        calls: 0,
        tokens: {
          input: 0,
          output: 0,
          total: 0
        },
        cost: 0
      };
    }
    
    // Get rate for the model
    const modelRate = this.rateCard[model] || this.rateCard.default;
    
    // Calculate cost (convert to dollars from cost per million tokens)
    const inputCost = (inputTokens / 1000000) * modelRate.input;
    const outputCost = (outputTokens / 1000000) * modelRate.output;
    const totalCost = inputCost + outputCost;
    
    // Track costs if not cached
    if (!cached) {
      // Update service stats
      this.costs.services[service].calls += 1;
      this.costs.services[service].tokens.input += inputTokens;
      this.costs.services[service].tokens.output += outputTokens;
      this.costs.services[service].tokens.total += totalTokens;
      this.costs.services[service].cost += totalCost;
      
      // Update model stats
      this.costs.models[model].calls += 1;
      this.costs.models[model].tokens.input += inputTokens;
      this.costs.models[model].tokens.output += outputTokens;
      this.costs.models[model].tokens.total += totalTokens;
      this.costs.models[model].cost += totalCost;
      
      // Update period stats
      this.costs.hourly[hourKey].calls += 1;
      this.costs.hourly[hourKey].tokens += totalTokens;
      this.costs.hourly[hourKey].cost += totalCost;
      
      this.costs.daily[dayKey].calls += 1;
      this.costs.daily[dayKey].tokens += totalTokens;
      this.costs.daily[dayKey].cost += totalCost;
      
      this.costs.monthly[monthKey].calls += 1;
      this.costs.monthly[monthKey].tokens += totalTokens;
      this.costs.monthly[monthKey].cost += totalCost;
      
      // Update total cost
      this.costs.totalCost += totalCost;
    } else {
      // If cached, track savings
      this.costSavingFeatures.caching.savings += totalCost;
    }
    
    // If tokens were optimized, track savings
    if (tokensOptimized > 0) {
      const optimizedCost = (tokensOptimized / 1000000) * modelRate.input;
      this.costSavingFeatures.tokenOptimization.savings += optimizedCost;
    }
    
    // Auto-save costs periodically
    if (Date.now() - this.lastSaveTime > this.autoSaveInterval) {
      this.saveCosts()
        .then(() => {
          this.lastSaveTime = Date.now();
        })
        .catch(err => {
          logger.error('Failed to auto-save costs', { error: err.message });
        });
    }
    
    return {
      service,
      model,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      },
      cost: totalCost,
      cached,
      savings: cached ? totalCost : 0
    };
  }
  
  /**
   * Get cost statistics
   * @param {Object} options - Options for filtering statistics
   * @returns {Object} Cost statistics
   */
  getStats(options = {}) {
    const {
      period = 'all', // 'all', 'daily', 'monthly', 'hourly'
      service,
      model,
      detailed = false
    } = options;
    
    let stats = {
      totalCost: this.costs.totalCost.toFixed(4),
      calls: 0,
      tokens: 0,
      savings: this.getTotalSavings()
    };
    
    // Calculate total calls and tokens
    Object.values(this.costs.services).forEach(svc => {
      stats.calls += svc.calls;
      stats.tokens += svc.tokens.total;
    });
    
    // Add period-specific data
    if (period === 'daily') {
      stats.dailyCosts = this.costs.daily;
    } else if (period === 'monthly') {
      stats.monthlyCosts = this.costs.monthly;
    } else if (period === 'hourly') {
      stats.hourlyCosts = this.costs.hourly;
    }
    
    // Add service-specific data if requested
    if (service && this.costs.services[service]) {
      stats.serviceStats = this.costs.services[service];
    } else if (detailed) {
      stats.services = this.costs.services;
    }
    
    // Add model-specific data if requested
    if (model && this.costs.models[model]) {
      stats.modelStats = this.costs.models[model];
    } else if (detailed) {
      stats.models = this.costs.models;
    }
    
    // Add savings breakdown
    stats.savingsBreakdown = this.costSavingFeatures;
    
    return stats;
  }
  
  /**
   * Get savings from cost optimization features
   * @returns {number} Total savings from all features
   */
  getTotalSavings() {
    let total = 0;
    Object.values(this.costSavingFeatures).forEach(feature => {
      total += feature.savings;
    });
    return total;
  }
  
  /**
   * Configure cost tracking features
   * @param {Object} config - Configuration options
   * @returns {CostTracker} This instance for chaining
   */
  configure(config = {}) {
    // Update rate card if provided
    if (config.rateCard) {
      this.rateCard = { ...this.rateCard, ...config.rateCard };
    }
    
    // Update auto-save interval if provided
    if (config.autoSaveInterval) {
      this.autoSaveInterval = config.autoSaveInterval;
    }
    
    // Update cost saving features if provided
    if (config.costSavingFeatures) {
      Object.keys(config.costSavingFeatures).forEach(feature => {
        if (this.costSavingFeatures[feature]) {
          this.costSavingFeatures[feature].enabled = 
            config.costSavingFeatures[feature];
        }
      });
    }
    
    return this;
  }
  
  /**
   * Reset cost statistics
   * @param {boolean} saveBefore - Whether to save costs before resetting
   * @returns {Promise<void>}
   */
  async resetStats(saveBefore = true) {
    if (saveBefore) {
      await this.saveCosts();
    }
    
    // Keep the rate card and configuration, but reset all stats
    const rateCard = this.rateCard;
    const autoSaveInterval = this.autoSaveInterval;
    const costSavingFeatures = { ...this.costSavingFeatures };
    
    // Reset all cost saving feature savings
    Object.keys(costSavingFeatures).forEach(feature => {
      costSavingFeatures[feature] = {
        enabled: costSavingFeatures[feature].enabled,
        savings: 0
      };
    });
    
    // Reset all costs
    this.costs = {
      totalCost: 0,
      services: {
        perplexity: {
          calls: 0,
          tokens: { input: 0, output: 0, total: 0 },
          cost: 0
        },
        claude: {
          calls: 0,
          tokens: { input: 0, output: 0, total: 0 },
          cost: 0
        },
        other: {
          calls: 0,
          tokens: { input: 0, output: 0, total: 0 },
          cost: 0
        }
      },
      models: {},
      hourly: {},
      daily: {},
      monthly: {}
    };
    
    // Restore configuration
    this.rateCard = rateCard;
    this.autoSaveInterval = autoSaveInterval;
    this.costSavingFeatures = costSavingFeatures;
    this.lastSaveTime = Date.now();
    
    logger.info('Cost statistics reset');
  }
  
  /**
   * Load costs from a file
   * @returns {Promise<boolean>} Success status
   */
  async loadCosts() {
    try {
      const costsDir = path.join(process.cwd(), 'data');
      const filePath = path.join(costsDir, 'llm-costs.json');
      
      // Create directory if it doesn't exist
      try {
        await fs.mkdir(costsDir, { recursive: true });
      } catch (err) {
        // Ignore directory already exists error
      }
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (err) {
        // File doesn't exist, nothing to load
        return false;
      }
      
      // Read and parse the file
      const data = await fs.readFile(filePath, 'utf8');
      const loadedCosts = JSON.parse(data);
      
      // Merge loaded costs with current costs
      this.costs = loadedCosts;
      
      logger.info('Costs loaded from file', {
        totalCost: this.costs.totalCost.toFixed(4)
      });
      
      return true;
    } catch (err) {
      logger.error('Failed to load costs from file', {
        error: err.message
      });
      
      return false;
    }
  }
  
  /**
   * Save costs to a file
   * @returns {Promise<boolean>} Success status
   */
  async saveCosts() {
    try {
      const costsDir = path.join(process.cwd(), 'data');
      const filePath = path.join(costsDir, 'llm-costs.json');
      
      // Create directory if it doesn't exist
      try {
        await fs.mkdir(costsDir, { recursive: true });
      } catch (err) {
        // Ignore directory already exists error
      }
      
      // Save costs to file
      await fs.writeFile(
        filePath,
        JSON.stringify(this.costs, null, 2),
        'utf8'
      );
      
      logger.info('Costs saved to file', {
        totalCost: this.costs.totalCost.toFixed(4)
      });
      
      return true;
    } catch (err) {
      logger.error('Failed to save costs to file', {
        error: err.message
      });
      
      return false;
    }
  }
}

// Create and export singleton instance
const costTracker = new CostTracker();

// Try to load existing costs on startup
costTracker.loadCosts().catch(err => {
  logger.error('Error loading costs on startup', { error: err.message });
});

export default costTracker;
