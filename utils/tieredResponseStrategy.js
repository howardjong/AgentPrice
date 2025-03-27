
/**
 * Tiered Response Strategy Utility
 * Implements a strategy for optimizing API usage based on query complexity
 */
import logger from './logger.js';
import { areLlmCallsDisabled } from './disableLlmCalls.js';

class TieredResponseStrategy {
  constructor() {
    // Define different tiers of response strategies
    this.tiers = {
      minimal: {
        name: 'minimal',
        description: 'Minimal API usage - use caching and lowest-cost models',
        tokenLimit: 500,
        modelStrategy: 'lowest-cost', // Always use the cheapest model
        cacheStrategy: 'aggressive', // Aggressively use cache with higher similarity threshold
        cacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
        features: {
          citations: false,
          deepResearch: false,
          streaming: false
        }
      },
      
      standard: {
        name: 'standard',
        description: 'Balanced API usage - use appropriate models based on complexity',
        tokenLimit: 1000,
        modelStrategy: 'adaptive', // Choose model based on query complexity
        cacheStrategy: 'normal', // Normal cache usage
        cacheTTL: 4 * 24 * 60 * 60 * 1000, // 4 days
        features: {
          citations: true,
          deepResearch: false,
          streaming: false
        }
      },
      
      premium: {
        name: 'premium',
        description: 'Full API usage - use best models for complex queries',
        tokenLimit: 2000,
        modelStrategy: 'best-quality', // Use higher-quality models
        cacheStrategy: 'minimal', // Minimal caching with lower TTL
        cacheTTL: 1 * 24 * 60 * 60 * 1000, // 1 day
        features: {
          citations: true,
          deepResearch: true,
          streaming: true
        }
      }
    };
    
    // Default to standard tier
    this.defaultTier = 'standard';
    this.currentTier = this.defaultTier;
    
    // Cost budget tracking
    this.budget = {
      daily: null, // No daily budget by default
      monthly: null, // No monthly budget by default
      currentDailyCost: 0,
      currentMonthlyCost: 0,
      lastUpdated: Date.now()
    };
    
    // Define model mappings for each strategy
    this.modelMappings = {
      'lowest-cost': {
        default: 'perplexity-sonar',
        perplexity: 'sonar',
        claude: 'claude-3-haiku'
      },
      'adaptive': {
        default: 'perplexity-sonar',
        perplexity: 'sonar',
        claude: 'claude-3-haiku',
        complex: {
          perplexity: 'sonar-pro',
          claude: 'claude-3-sonnet'
        }
      },
      'best-quality': {
        default: 'claude-3-sonnet',
        perplexity: 'sonar-deep-research',
        claude: 'claude-3-opus',
        complex: {
          perplexity: 'sonar-deep-research',
          claude: 'claude-3-opus'
        }
      }
    };
  }
  
  /**
   * Configure the tiered strategy
   * @param {Object} config - Configuration options
   * @returns {TieredResponseStrategy} This instance for chaining
   */
  configure(config = {}) {
    // Set default tier if provided
    if (config.defaultTier && this.tiers[config.defaultTier]) {
      this.defaultTier = config.defaultTier;
      this.currentTier = this.defaultTier;
    }
    
    // Set budget if provided
    if (config.budget) {
      if (config.budget.daily !== undefined) {
        this.budget.daily = config.budget.daily;
      }
      
      if (config.budget.monthly !== undefined) {
        this.budget.monthly = config.budget.monthly;
      }
    }
    
    // Update tier configurations if provided
    if (config.tiers) {
      Object.keys(config.tiers).forEach(tierName => {
        if (this.tiers[tierName]) {
          this.tiers[tierName] = {
            ...this.tiers[tierName],
            ...config.tiers[tierName]
          };
        }
      });
    }
    
    // Update model mappings if provided
    if (config.modelMappings) {
      Object.keys(config.modelMappings).forEach(strategy => {
        if (this.modelMappings[strategy]) {
          this.modelMappings[strategy] = {
            ...this.modelMappings[strategy],
            ...config.modelMappings[strategy]
          };
        } else {
          this.modelMappings[strategy] = config.modelMappings[strategy];
        }
      });
    }
    
    logger.info('Tiered response strategy configured', {
      defaultTier: this.defaultTier,
      budget: this.budget
    });
    
    return this;
  }
  
  /**
   * Set the current tier
   * @param {string} tierName - Name of the tier to set
   * @returns {boolean} Success status
   */
  setTier(tierName) {
    if (!this.tiers[tierName]) {
      logger.warn(`Tier "${tierName}" not found, using default`, {
        requestedTier: tierName,
        defaultTier: this.defaultTier
      });
      this.currentTier = this.defaultTier;
      return false;
    }
    
    this.currentTier = tierName;
    logger.info(`Tier set to "${tierName}"`, {
      tier: this.tiers[tierName]
    });
    
    return true;
  }
  
  /**
   * Get the current tier configuration
   * @returns {Object} Current tier configuration
   */
  getCurrentTier() {
    return {
      name: this.currentTier,
      ...this.tiers[this.currentTier]
    };
  }
  
  /**
   * Update cost budgets
   * @param {number} dailyCost - Current daily cost
   * @param {number} monthlyCost - Current monthly cost
   */
  updateBudget(dailyCost, monthlyCost) {
    this.budget.currentDailyCost = dailyCost;
    this.budget.currentMonthlyCost = monthlyCost;
    this.budget.lastUpdated = Date.now();
    
    // Auto-adjust tier based on budget if budgets are set
    this.adjustTierBasedOnBudget();
  }
  
  /**
   * Adjust tier based on budget consumption
   * @returns {string} Adjusted tier name
   */
  adjustTierBasedOnBudget() {
    // Skip if budgets aren't set
    if (this.budget.daily === null && this.budget.monthly === null) {
      return this.currentTier;
    }
    
    // Check daily budget
    if (this.budget.daily !== null) {
      const dailyUsagePercentage = (this.budget.currentDailyCost / this.budget.daily) * 100;
      
      // If over 90% of daily budget, switch to minimal tier
      if (dailyUsagePercentage > 90) {
        if (this.currentTier !== 'minimal') {
          logger.warn('Daily budget almost exceeded, switching to minimal tier', {
            budget: this.budget.daily,
            currentCost: this.budget.currentDailyCost,
            usagePercentage: dailyUsagePercentage.toFixed(1) + '%'
          });
          this.setTier('minimal');
          return this.currentTier;
        }
      }
      // If over 75% of daily budget, switch to standard tier if currently premium
      else if (dailyUsagePercentage > 75 && this.currentTier === 'premium') {
        logger.warn('Daily budget usage high, downgrading from premium to standard tier', {
          budget: this.budget.daily,
          currentCost: this.budget.currentDailyCost,
          usagePercentage: dailyUsagePercentage.toFixed(1) + '%'
        });
        this.setTier('standard');
        return this.currentTier;
      }
    }
    
    // Check monthly budget
    if (this.budget.monthly !== null) {
      const monthlyUsagePercentage = (this.budget.currentMonthlyCost / this.budget.monthly) * 100;
      
      // If over 95% of monthly budget, switch to minimal tier
      if (monthlyUsagePercentage > 95) {
        if (this.currentTier !== 'minimal') {
          logger.warn('Monthly budget almost exceeded, switching to minimal tier', {
            budget: this.budget.monthly,
            currentCost: this.budget.currentMonthlyCost,
            usagePercentage: monthlyUsagePercentage.toFixed(1) + '%'
          });
          this.setTier('minimal');
          return this.currentTier;
        }
      }
      // If over 80% of monthly budget, switch to standard tier if currently premium
      else if (monthlyUsagePercentage > 80 && this.currentTier === 'premium') {
        logger.warn('Monthly budget usage high, downgrading from premium to standard tier', {
          budget: this.budget.monthly,
          currentCost: this.budget.currentMonthlyCost,
          usagePercentage: monthlyUsagePercentage.toFixed(1) + '%'
        });
        this.setTier('standard');
        return this.currentTier;
      }
    }
    
    return this.currentTier;
  }
  
  /**
   * Get request options based on current tier and query
   * @param {Object} params - Request parameters
   * @returns {Object} Tier-specific request options
   */
  getRequestOptions(params = {}) {
    const {
      service = 'perplexity',
      query = '',
      complexity = this.estimateQueryComplexity(query),
      forceTier = null,
      overrides = {}
    } = params;
    
    // Use forced tier if provided and valid
    const tierName = (forceTier && this.tiers[forceTier]) ? forceTier : this.currentTier;
    const tier = this.tiers[tierName];
    
    // Check if LLM calls are disabled
    if (areLlmCallsDisabled()) {
      return {
        tier: tierName,
        mockMode: true,
        model: this.getModelForService(service, complexity, tierName),
        tokenLimit: tier.tokenLimit,
        cacheSettings: {
          ttl: tier.cacheTTL,
          strategy: tier.cacheStrategy
        },
        features: { ...tier.features },
        ...overrides
      };
    }
    
    // Get appropriate model based on tier's model strategy
    const model = this.getModelForService(service, complexity, tierName);
    
    // Determine cache settings based on tier
    const cacheSettings = {
      ttl: tier.cacheTTL,
      strategy: tier.cacheStrategy,
      fuzzyMatchThreshold: tier.cacheStrategy === 'aggressive' ? 0.8 : 0.9
    };
    
    // Compile all options
    const options = {
      tier: tierName,
      mockMode: false,
      model,
      tokenLimit: tier.tokenLimit,
      cacheSettings,
      features: { ...tier.features },
      ...overrides
    };
    
    logger.debug('Generated tier-specific request options', {
      tier: tierName,
      model,
      service,
      complexity
    });
    
    return options;
  }
  
  /**
   * Get the appropriate model for a service based on complexity and tier
   * @param {string} service - Service name (perplexity, claude, etc.)
   * @param {string} complexity - Estimated query complexity (simple, medium, complex)
   * @param {string} tierName - Tier name
   * @returns {string} Model name
   */
  getModelForService(service, complexity, tierName = this.currentTier) {
    const tier = this.tiers[tierName];
    const modelStrategy = tier.modelStrategy;
    const mapping = this.modelMappings[modelStrategy];
    
    if (!mapping) {
      logger.warn(`Model strategy "${modelStrategy}" not found, using default`, {
        strategy: modelStrategy
      });
      return service === 'perplexity' ? 'sonar' : 'claude-3-haiku';
    }
    
    // For complex queries, use the complex model if available
    if (complexity === 'complex' && mapping.complex && mapping.complex[service]) {
      return mapping.complex[service];
    }
    
    // Otherwise use the standard model for the service
    return mapping[service] || mapping.default;
  }
  
  /**
   * Estimate query complexity based on content
   * @param {string} query - Query text
   * @returns {string} Complexity level (simple, medium, complex)
   */
  estimateQueryComplexity(query) {
    if (!query) return 'simple';
    
    const queryLength = query.length;
    const wordCount = query.split(/\s+/).length;
    
    // Check for complexity indicators
    const complexityIndicators = [
      'compare', 'analyze', 'evaluate', 'synthesize', 'recommend',
      'research', 'investigate', 'deep dive', 'comprehensive',
      'detailed', 'in-depth', 'thorough', 'exhaustive'
    ];
    
    const hasComplexityIndicators = complexityIndicators.some(
      indicator => query.toLowerCase().includes(indicator)
    );
    
    // Short queries are usually simple
    if (wordCount < 15 && !hasComplexityIndicators) {
      return 'simple';
    }
    
    // Long queries with complexity indicators are complex
    if (wordCount > 50 || (wordCount > 25 && hasComplexityIndicators)) {
      return 'complex';
    }
    
    // Everything else is medium complexity
    return 'medium';
  }
  
  /**
   * Get all available tiers
   * @returns {Object} All tier configurations
   */
  getAllTiers() {
    return { ...this.tiers };
  }

  /**
   * Get status of the tiered response strategy
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      status: 'ACTIVE',
      enabled: true,
      currentTier: this.currentTier,
      availableTiers: Object.keys(this.tiers),
      budget: {
        daily: this.budget.daily,
        monthly: this.budget.monthly,
        currentDailyCost: this.budget.currentDailyCost,
        currentMonthlyCost: this.budget.currentMonthlyCost,
        dailyUsagePercentage: this.budget.daily ? 
          ((this.budget.currentDailyCost / this.budget.daily) * 100).toFixed(1) + '%' : 'N/A',
        monthlyUsagePercentage: this.budget.monthly ? 
          ((this.budget.currentMonthlyCost / this.budget.monthly) * 100).toFixed(1) + '%' : 'N/A'
      },
      modelMappings: this.modelMappings,
      lastTierChangeReason: this.lastTierChangeReason || 'Not changed since initialization'
    };
  }
}

// Create and export singleton instance
const tieredResponseStrategy = new TieredResponseStrategy();
export default tieredResponseStrategy;
