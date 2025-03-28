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
    // Default properties
    this.defaultTier = 'standard';
    this.autoDowngrade = true;
    this.downgradeTrigger = 0.8; // 80% of daily budget
    this.requestsProcessed = 0;
    this.downgrades = 0;
    this.costSaved = 0.0;
    this.currentTier = 'standard';
    this.costMultipliers = {
      minimal: 0.5,
      standard: 1.0,
      premium: 2.0
    };
  }

  /**
   * Configure the tiered response strategy
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.defaultTier - Default tier (minimal, standard, premium)
   * @param {Object} options.costMultipliers - Cost multipliers by tier
   * @param {boolean} options.autoDowngrade - Auto-downgrade based on budget
   * @param {number} options.downgradeTrigger - Downgrade trigger point (0-1)
   */
  configure(options = {}) {
    const {
      defaultTier = 'standard',
      costMultipliers = {
        minimal: 0.5,
        standard: 1.0,
        premium: 2.0
      },
      autoDowngrade = true,
      downgradeTrigger = 0.8
    } = options;

    // Validate defaultTier
    if (!TIER_CONFIG[defaultTier]) {
      logger.warn(`Invalid default tier: ${defaultTier}, using 'standard'`);
      this.defaultTier = 'standard';
    } else {
      this.defaultTier = defaultTier;
    }

    this.costMultipliers = costMultipliers;
    this.autoDowngrade = autoDowngrade;
    this.downgradeTrigger = downgradeTrigger;
    this.currentTier = this.defaultTier;

    logger.info('Tiered response strategy configured', {
      autoDowngrade,
      defaultTier,
      downgradeTrigger: `${downgradeTrigger * 100}%`
    });
  }

  /**
   * Get the appropriate tier for a request
   * 
   * @param {Object} requestContext - Request context
   * @param {string} requestContext.requestType - Type of request (conversation, research, visualization)
   * @param {number} requestContext.priority - Priority level (0-10)
   * @param {string} requestContext.explicitTier - Explicitly requested tier
   * @param {boolean} requestContext.budgetSensitive - Whether request is budget sensitive
   * @returns {string} Appropriate tier
   */
  getTierForRequest(requestContext = {}) {
    const {
      requestType = 'conversation',
      priority = 5,
      explicitTier = null,
      budgetSensitive = true
    } = requestContext;

    // Always respect explicitly requested tiers
    if (explicitTier && TIER_CONFIG[explicitTier]) {
      logger.debug(`Using explicitly requested tier: ${explicitTier}`);
      return explicitTier;
    }

    // Check budget status if auto-downgrade is enabled and request is budget sensitive
    if (this.autoDowngrade && budgetSensitive) {
      const budgetStatus = this.checkBudgetStatus();

      // If budget is near exhaustion, use minimal tier
      if (budgetStatus.nearExhaustion) {
        logger.info('Downgrading to minimal tier due to budget constraints', {
          budgetUsage: `${budgetStatus.percentUsed}%`,
          threshold: `${this.downgradeTrigger * 100}%`
        });
        this.downgrades++;
        return 'minimal';
      }
    }

    // Determine tier based on request type and priority
    let recommendedTier = this.defaultTier;

    // High-priority requests get premium treatment
    if (priority >= 8) {
      recommendedTier = 'premium';
    }
    // Low-priority requests get minimal treatment
    else if (priority <= 3) {
      recommendedTier = 'minimal';
    }
    // Visualizations usually need more detail
    else if (requestType === 'visualization') {
      recommendedTier = 'premium';
    }
    // Research can be standard
    else if (requestType === 'research') {
      recommendedTier = 'standard';
    }

    this.currentTier = recommendedTier;
    return recommendedTier;
  }

  /**
   * Check the current budget status
   * 
   * @returns {Object} Budget status information
   */
  checkBudgetStatus() {
    // Get the latest budget usage from cost tracker
    const dailyBudget = costTracker.dailyBudget || 10.0;
    const todayUsage = costTracker.todayUsage || 0.0;
    
    const percentUsed = (todayUsage / dailyBudget) * 100;
    const nearExhaustion = (todayUsage / dailyBudget) >= this.downgradeTrigger;
    const exhausted = todayUsage >= dailyBudget;
    
    return {
      dailyBudget,
      todayUsage,
      percentUsed,
      nearExhaustion,
      exhausted,
      downgradeTrigger: this.downgradeTrigger
    };
  }

  /**
   * Apply tier settings to a request configuration
   * 
   * @param {Object} requestConfig - Original request configuration
   * @param {string} tier - Tier to apply (minimal, standard, premium)
   * @returns {Object} Modified request configuration
   */
  applyTierToRequest(requestConfig, tier = null) {
    // Use the specified tier or determine the appropriate one
    const effectiveTier = tier || this.getTierForRequest(requestConfig.context);
    const tierSettings = TIER_CONFIG[effectiveTier];
    
    if (!tierSettings) {
      logger.warn(`Unknown tier: ${effectiveTier}, using default tier`);
      return requestConfig;
    }
    
    // Track the request
    this.requestsProcessed++;
    
    // Clone the config to avoid modifying the original
    const modifiedConfig = { ...requestConfig };
    
    // Apply tier-specific settings
    if (modifiedConfig.max_tokens === undefined || modifiedConfig.max_tokens > tierSettings.maxTokens) {
      modifiedConfig.max_tokens = tierSettings.maxTokens;
    }
    
    if (modifiedConfig.temperature === undefined) {
      modifiedConfig.temperature = tierSettings.temperature;
    }
    
    // Modify system prompt if needed
    if (tierSettings.systemPromptAppend && modifiedConfig.messages) {
      // Find the system message if it exists
      const systemMessageIndex = modifiedConfig.messages.findIndex(
        msg => msg.role === 'system'
      );
      
      if (systemMessageIndex >= 0) {
        // Append to existing system message
        modifiedConfig.messages[systemMessageIndex].content += ' ' + tierSettings.systemPromptAppend;
      } else if (modifiedConfig.messages.length > 0) {
        // Add a new system message at the beginning
        modifiedConfig.messages.unshift({
          role: 'system',
          content: tierSettings.systemPromptAppend
        });
      }
    }
    
    // If this was a downgrade, estimate and track the savings
    if (effectiveTier === 'minimal' && this.defaultTier !== 'minimal') {
      // Estimate the cost savings from downgrade
      const standardCost = this.estimateTierCost('standard', modifiedConfig);
      const minimalCost = this.estimateTierCost('minimal', modifiedConfig);
      const savings = standardCost - minimalCost;
      
      this.costSaved += savings;
      
      logger.info('Cost savings from tier downgrade', {
        savings: `$${savings.toFixed(4)}`,
        tier: effectiveTier
      });
    }
    
    // Add metadata about the tier
    modifiedConfig.tierInfo = {
      tier: effectiveTier,
      description: tierSettings.description,
      maxTokens: tierSettings.maxTokens,
      costMultiplier: tierSettings.costMultiplier
    };
    
    return modifiedConfig;
  }

  /**
   * Estimate the cost of a request at a specific tier
   * 
   * @param {string} tier - Tier to estimate for
   * @param {Object} requestConfig - Request configuration
   * @returns {number} Estimated cost
   */
  estimateTierCost(tier, requestConfig) {
    // Get the tier multiplier
    const multiplier = this.costMultipliers[tier] || 1.0;
    
    // Rough estimation based on token count
    let baseTokens = 0;
    
    // Calculate tokens from messages
    if (requestConfig.messages) {
      baseTokens = requestConfig.messages.reduce((sum, msg) => {
        // Rough estimate: 4 chars ≈ 1 token
        return sum + (msg.content.length / 4);
      }, 0);
    }
    
    // Add expected output tokens based on tier
    const outputTokens = TIER_CONFIG[tier]?.maxTokens || 1000;
    
    // Calculate approximate cost (using Claude Sonnet rates as approximation)
    const inputCost = (baseTokens / 1000) * 0.003; // $0.003 per 1K input tokens
    const outputCost = (outputTokens / 1000) * 0.015; // $0.015 per 1K output tokens
    
    return (inputCost + outputCost) * multiplier;
  }

  /**
   * Get current tiered response strategy status
   * 
   * @returns {Object} Current status
   */
  getStatus() {
    const budgetStatus = this.checkBudgetStatus();
    
    return {
      enabled: true,
      currentTier: this.currentTier,
      defaultTier: this.defaultTier,
      settings: {
        autoDowngrade: this.autoDowngrade,
        downgradeTrigger: this.downgradeTrigger,
        costMultipliers: this.costMultipliers
      },
      stats: {
        requestsProcessed: this.requestsProcessed,
        downgrades: this.downgrades,
        costSaved: this.costSaved
      },
      budget: {
        percentUsed: budgetStatus.percentUsed,
        nearExhaustion: budgetStatus.nearExhaustion,
        exhausted: budgetStatus.exhausted
      },
      availableTiers: Object.keys(TIER_CONFIG)
    };
  }
}

// Create and export a singleton instance
const tieredResponseStrategy = new TieredResponseStrategy();
export default tieredResponseStrategy;