/**
 * Cost Tracker
 * 
 * Tracks API usage costs and provides budget management features
 * to avoid unexpected overages and optimize API spending.
 */

import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';

// Rate constants (per 1K tokens)
const COST_RATES = {
  'claude-3-7-sonnet-20250219': {
    input: 0.003,  // $0.003 per 1K input tokens
    output: 0.015  // $0.015 per 1K output tokens
  },
  'claude-3-5-sonnet-20240620': {
    input: 0.0025, // $0.0025 per 1K input tokens
    output: 0.0125 // $0.0125 per 1K output tokens
  },
  'llama-3.1-sonar-small-128k-online': {
    input: 0.0005, // $0.0005 per 1K input tokens
    output: 0.0020 // $0.0020 per 1K output tokens
  },
  'llama-3.1-sonar-large-128k-online': {
    input: 0.0015, // $0.0015 per 1K input tokens
    output: 0.0060 // $0.0060 per 1K output tokens
  }
};

// Default model names for services
const DEFAULT_MODELS = {
  'anthropic': 'claude-3-7-sonnet-20250219',
  'perplexity': 'llama-3.1-sonar-small-128k-online'
};

class CostTracker {
  constructor() {
    // Default properties
    this.totalApiCalls = 0;
    this.dailyBudget = 10.0;
    this.todayUsage = 0.0;
    this.budgetAlertsEnabled = true;
    this.alertThreshold = 0.8;
    this.detailedTracking = true;
    this.dataDir = './data/cost-tracking';
    
    // Detailed tracking data
    this.usageByService = {};
    this.usageByModel = {};
    this.usageByHour = {};
    this.tokensByRequest = {};
    this.dailyStats = {
      date: this.getCurrentDate(),
      costs: 0,
      tokens: {
        input: 0,
        output: 0
      },
      requests: 0
    };
    
    // Initialize storage
    this.initializeStorage();
  }

  /**
   * Configure the cost tracker
   * 
   * @param {Object} options - Configuration options
   * @param {number} options.dailyBudget - Daily budget in USD
   * @param {number} options.alertThreshold - Alert threshold (0-1)
   * @param {boolean} options.detailedTracking - Enable detailed tracking
   * @param {boolean} options.enableHistoricalData - Enable historical data storage
   * @param {boolean} options.budgetAlertsEnabled - Enable budget alerts
   */
  configure(options = {}) {
    const {
      dailyBudget = 10.0,
      alertThreshold = 0.8,
      detailedTracking = true,
      enableHistoricalData = true,
      budgetAlertsEnabled = true
    } = options;

    this.dailyBudget = dailyBudget;
    this.alertThreshold = alertThreshold;
    this.detailedTracking = detailedTracking;
    this.enableHistoricalData = enableHistoricalData;
    this.budgetAlertsEnabled = budgetAlertsEnabled;

    // Ensure we have today's usage
    this.checkDate();

    // Log configuration
    logger.info('Cost tracker configured', {
      alertThreshold: `${alertThreshold * 100}%`,
      budgetAlertsEnabled,
      dailyBudget: `$${dailyBudget.toFixed(2)}`,
      detailedTracking,
      enableHistoricalData
    });
  }

  /**
   * Initialize storage
   */
  async initializeStorage() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Error initializing cost tracker storage', { error: error.message });
    }
  }

  /**
   * Record API usage
   * 
   * @param {Object} usage - API usage details
   * @param {string} usage.service - Service name (anthropic, perplexity)
   * @param {string} usage.model - Model name
   * @param {number} usage.inputTokens - Number of input tokens
   * @param {number} usage.outputTokens - Number of output tokens
   * @param {string} usage.operation - Operation type (conversation, research, visualization)
   * @param {string} usage.requestId - Unique request ID
   */
  recordUsage(usage) {
    const {
      service,
      model = DEFAULT_MODELS[service] || 'unknown',
      inputTokens = 0,
      outputTokens = 0,
      operation = 'api_call',
      requestId = `req-${Date.now()}`
    } = usage;

    // Get current date/time
    const now = new Date();
    const hour = now.getHours();
    const date = this.getCurrentDate();

    // Check if we need to reset daily usage
    this.checkDate();

    // Calculate costs
    const modelRates = COST_RATES[model] || {
      input: 0.003,
      output: 0.015
    };

    const inputCost = (inputTokens / 1000) * modelRates.input;
    const outputCost = (outputTokens / 1000) * modelRates.output;
    const totalCost = inputCost + outputCost;

    // Update totals
    this.totalApiCalls++;
    this.todayUsage += totalCost;
    this.dailyStats.costs += totalCost;
    this.dailyStats.tokens.input += inputTokens;
    this.dailyStats.tokens.output += outputTokens;
    this.dailyStats.requests++;

    // Store token usage by request
    this.tokensByRequest[requestId] = {
      timestamp: now.toISOString(),
      service,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCost,
      outputCost,
      totalCost,
      operation
    };

    // Track by service
    if (!this.usageByService[service]) {
      this.usageByService[service] = {
        requests: 0,
        totalCost: 0,
        tokens: { input: 0, output: 0 }
      };
    }
    this.usageByService[service].requests++;
    this.usageByService[service].totalCost += totalCost;
    this.usageByService[service].tokens.input += inputTokens;
    this.usageByService[service].tokens.output += outputTokens;

    // Track by model
    if (!this.usageByModel[model]) {
      this.usageByModel[model] = {
        requests: 0,
        totalCost: 0,
        tokens: { input: 0, output: 0 }
      };
    }
    this.usageByModel[model].requests++;
    this.usageByModel[model].totalCost += totalCost;
    this.usageByModel[model].tokens.input += inputTokens;
    this.usageByModel[model].tokens.output += outputTokens;

    // Track by hour
    const hourKey = `${date}-${hour}`;
    if (!this.usageByHour[hourKey]) {
      this.usageByHour[hourKey] = {
        requests: 0,
        totalCost: 0,
        tokens: { input: 0, output: 0 }
      };
    }
    this.usageByHour[hourKey].requests++;
    this.usageByHour[hourKey].totalCost += totalCost;
    this.usageByHour[hourKey].tokens.input += inputTokens;
    this.usageByHour[hourKey].tokens.output += outputTokens;

    // Log the usage
    logger.info('API usage recorded', {
      cost: `$${totalCost.toFixed(4)}`,
      inputTokens,
      model,
      outputTokens,
      service,
      todayTotal: `$${this.todayUsage.toFixed(2)}`
    });

    // Check budget alerts
    this.checkBudgetAlerts();

    // Save statistics if historical data is enabled
    if (this.enableHistoricalData) {
      this.saveUsageData().catch(error => {
        logger.error('Error saving usage data', { error: error.message });
      });
    }

    return {
      cost: totalCost,
      inputCost,
      outputCost,
      todayTotal: this.todayUsage
    };
  }

  /**
   * Check budget alerts
   */
  checkBudgetAlerts() {
    if (!this.budgetAlertsEnabled) return;

    const budgetRatio = this.todayUsage / this.dailyBudget;

    if (budgetRatio >= this.alertThreshold) {
      const percentUsed = Math.round(budgetRatio * 100);
      
      logger.warn('Daily budget threshold exceeded', {
        dailyBudget: `$${this.dailyBudget.toFixed(2)}`,
        percentUsed: `${percentUsed}%`,
        threshold: `${Math.round(this.alertThreshold * 100)}%`,
        todayUsage: `$${this.todayUsage.toFixed(2)}`
      });
    }

    if (budgetRatio >= 1.0) {
      logger.error('Daily budget exhausted', {
        dailyBudget: `$${this.dailyBudget.toFixed(2)}`,
        todayUsage: `$${this.todayUsage.toFixed(2)}`
      });
    }
  }

  /**
   * Get current date string (YYYY-MM-DD)
   * 
   * @returns {string} Current date
   */
  getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Check if date has changed and reset daily tracking if needed
   */
  checkDate() {
    const today = this.getCurrentDate();
    
    if (this.dailyStats.date !== today) {
      // Save previous day's data before resetting
      if (this.enableHistoricalData && this.dailyStats.requests > 0) {
        this.saveDailyUsage(this.dailyStats).catch(error => {
          logger.error('Error saving daily usage', { error: error.message });
        });
      }
      
      // Reset daily usage
      this.resetDailyUsage();
    }
  }

  /**
   * Reset daily usage statistics
   */
  resetDailyUsage() {
    const today = this.getCurrentDate();
    
    logger.info('Resetting daily usage statistics', {
      previousDate: this.dailyStats.date,
      previousRequests: this.dailyStats.requests,
      previousUsage: `$${this.dailyStats.costs.toFixed(2)}`
    });
    
    this.todayUsage = 0.0;
    this.dailyStats = {
      date: today,
      costs: 0,
      tokens: {
        input: 0,
        output: 0
      },
      requests: 0
    };
  }

  /**
   * Save daily usage data
   * 
   * @param {Object} dailyData - Daily usage data
   */
  async saveDailyUsage(dailyData) {
    if (!this.enableHistoricalData) return;
    
    try {
      const filePath = path.join(this.dataDir, `daily-${dailyData.date}.json`);
      
      // Compile complete daily data
      const completeData = {
        ...dailyData,
        byService: this.usageByService,
        byModel: this.usageByModel,
        byHour: Object.entries(this.usageByHour)
          .filter(([key]) => key.startsWith(dailyData.date))
          .reduce((obj, [key, value]) => {
            const hour = key.split('-')[2];
            obj[hour] = value;
            return obj;
          }, {})
      };
      
      await fs.writeFile(filePath, JSON.stringify(completeData, null, 2));
      
      logger.debug('Daily usage data saved', {
        date: dailyData.date,
        path: filePath
      });
    } catch (error) {
      logger.error('Error saving daily usage data', { error: error.message });
    }
  }

  /**
   * Save current usage data
   */
  async saveUsageData() {
    if (!this.enableHistoricalData) return;
    
    try {
      // Save summary data
      const summaryPath = path.join(this.dataDir, 'usage-summary.json');
      
      const summary = {
        lastUpdated: new Date().toISOString(),
        totalApiCalls: this.totalApiCalls,
        todayUsage: this.todayUsage,
        dailyBudget: this.dailyBudget,
        todayStats: this.dailyStats,
        byService: this.usageByService,
        byModel: this.usageByModel
      };
      
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      
      logger.debug('Usage summary data saved');
    } catch (error) {
      logger.error('Error saving usage data', { error: error.message });
    }
  }

  /**
   * Get cost estimates for a hypothetical API request
   * 
   * @param {Object} params - Request parameters
   * @param {string} params.service - Service name
   * @param {string} params.model - Model name
   * @param {number} params.inputTokens - Input tokens
   * @param {number} params.outputTokens - Output tokens
   * @returns {Object} Cost estimates
   */
  estimateRequestCost(params) {
    const {
      service,
      model = DEFAULT_MODELS[service] || 'unknown',
      inputTokens = 0,
      outputTokens = 0
    } = params;

    // Get cost rates
    const modelRates = COST_RATES[model] || {
      input: 0.003,
      output: 0.015
    };

    // Calculate costs
    const inputCost = (inputTokens / 1000) * modelRates.input;
    const outputCost = (outputTokens / 1000) * modelRates.output;
    const totalCost = inputCost + outputCost;

    return {
      model,
      rates: {
        inputPer1K: modelRates.input,
        outputPer1K: modelRates.output
      },
      costs: {
        input: inputCost,
        output: outputCost,
        total: totalCost
      },
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      formattedCost: `$${totalCost.toFixed(4)}`
    };
  }

  /**
   * Get current cost tracking status
   * 
   * @returns {Object} Current status
   */
  getStatus() {
    // Calculate savings stats
    const costSavings = this.calculateSavings();
    
    return {
      enabled: true,
      todayUsage: this.todayUsage,
      dailyBudget: this.dailyBudget,
      budgetUtilization: (this.todayUsage / this.dailyBudget) * 100,
      totalApiCalls: this.totalApiCalls,
      settings: {
        alertThreshold: this.alertThreshold,
        budgetAlertsEnabled: this.budgetAlertsEnabled,
        detailedTracking: this.detailedTracking,
        enableHistoricalData: this.enableHistoricalData
      },
      today: this.dailyStats,
      costByModel: Object.entries(this.usageByModel).reduce((obj, [model, data]) => {
        obj[model] = data.totalCost;
        return obj;
      }, {}),
      costByService: Object.entries(this.usageByService).reduce((obj, [service, data]) => {
        obj[service] = data.totalCost;
        return obj;
      }, {}),
      savings: costSavings
    };
  }

  /**
   * Calculate cost savings from optimizations
   * 
   * @returns {Object} Savings statistics
   */
  calculateSavings() {
    // In a real implementation, this would calculate actual savings
    // from token optimizer, tiered strategy, etc.
    // This is a placeholder implementation
    
    return {
      tokenOptimization: 0.0,
      tieredStrategy: 0.0,
      caching: 0.0,
      total: 0.0
    };
  }
}

// Create and export a singleton instance
const costTracker = new CostTracker();
export default costTracker;