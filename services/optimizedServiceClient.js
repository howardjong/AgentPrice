/**
 * Optimized Service Client
 * 
 * This module provides optimized API client wrappers for external services
 * with built-in cost optimization strategies.
 */

import logger from '../utils/logger.js';
import costOptimizer from '../utils/costOptimizer.js';
import costTracker from '../utils/costTracker.js';
import * as claudeService from './claudeService.js';
import * as perplexityService from './perplexityService.js';

/**
 * Get an optimized Claude API client
 * 
 * @returns {Object} Optimized Claude API client
 */
export function getOptimizedClaudeClient() {
  return {
    /**
     * Process text through Claude with cost optimization
     * 
     * @param {string} prompt - The prompt to send to Claude
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Claude API response
     */
    async processText(prompt, options = {}) {
      try {
        // Prepare parameters for optimization
        const params = {
          prompt,
          model: options.model || 'claude-3-7-sonnet-20250219',
          ...options
        };

        // Estimated input/output tokens for cost tracking
        if (!params.inputTokens && prompt) {
          params.inputTokens = Math.ceil(prompt.length / 4); // Rough estimate
        }
        
        if (!params.outputTokens) {
          params.outputTokens = options.maxTokens || 1000; // Default or specified max tokens
        }

        // Process through cost optimizer
        const result = await costOptimizer.processRequest(
          'anthropic',
          'conversation',
          params,
          // Actual API call function
          async (optimizedParams) => {
            return claudeService.processText(
              optimizedParams.prompt,
              {
                ...optimizedParams,
                // Don't pass these parameters to Claude
                prompt: undefined,
                inputTokens: undefined,
                outputTokens: undefined
              }
            );
          }
        );

        // Track actual usage if available
        if (result && !result.cached && !result.mocked && result.usage) {
          costTracker.recordUsage({
            service: 'anthropic',
            model: result.model || params.model,
            inputTokens: result.usage.input_tokens || params.inputTokens,
            outputTokens: result.usage.output_tokens || params.outputTokens,
            operation: 'conversation',
            requestId: result.requestId || options.requestId
          });
        }

        return result;
      } catch (error) {
        logger.error('Error in optimized Claude client', {
          error: error.message,
          prompt: prompt.substring(0, 100) + '...'
        });
        throw error;
      }
    },

    /**
     * Generate visualization through Claude with cost optimization
     * 
     * @param {Object} visualizationData - Data for visualization
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Visualization response
     */
    async generateVisualization(visualizationData, options = {}) {
      try {
        // Convert visualization data to a prompt
        const visualizationType = visualizationData.type || 'bar';
        const dataStr = JSON.stringify(visualizationData);
        
        const prompt = `Generate a ${visualizationType} chart visualization using the following data: ${dataStr}`;
        
        // Prepare parameters for optimization
        const params = {
          prompt,
          model: options.model || 'claude-3-7-sonnet-20250219',
          visualizationType,
          ...options
        };

        // Estimated tokens
        if (!params.inputTokens) {
          params.inputTokens = Math.ceil(prompt.length / 4);
        }
        
        if (!params.outputTokens) {
          params.outputTokens = 2000; // Visualizations typically need more tokens
        }

        // Process through cost optimizer
        const result = await costOptimizer.processRequest(
          'anthropic',
          'visualization',
          params,
          // Actual API call function
          async (optimizedParams) => {
            return claudeService.generatePlotlyVisualization(
              visualizationData,
              {
                ...options,
                model: optimizedParams.model
              }
            );
          }
        );

        // Track actual usage if available
        if (result && !result.cached && !result.mocked && result.usage) {
          costTracker.recordUsage({
            service: 'anthropic',
            model: result.model || params.model,
            inputTokens: result.usage.input_tokens || params.inputTokens,
            outputTokens: result.usage.output_tokens || params.outputTokens,
            operation: 'visualization',
            requestId: result.requestId || options.requestId
          });
        }

        return result;
      } catch (error) {
        logger.error('Error in optimized Claude visualization', {
          error: error.message,
          visualizationType: visualizationData.type
        });
        throw error;
      }
    }
  };
}

/**
 * Get an optimized Perplexity API client
 * 
 * @returns {Object} Optimized Perplexity API client
 */
export function getOptimizedPerplexityClient() {
  return {
    /**
     * Process query through Perplexity with cost optimization
     * 
     * @param {string} query - The query to send to Perplexity
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Perplexity API response
     */
    async processQuery(query, options = {}) {
      try {
        // Prepare parameters for optimization
        const params = {
          query,
          model: options.model || 'sonar',
          ...options
        };

        // Estimated tokens
        if (!params.inputTokens && query) {
          params.inputTokens = Math.ceil(query.length / 4);
        }
        
        if (!params.outputTokens) {
          params.outputTokens = options.maxTokens || 1000;
        }

        // Process through cost optimizer
        const result = await costOptimizer.processRequest(
          'perplexity',
          'query',
          params,
          // Actual API call function
          async (optimizedParams) => {
            return perplexityService.processQuery(
              optimizedParams.query,
              {
                ...optimizedParams,
                // Don't pass these parameters to Perplexity
                query: undefined,
                inputTokens: undefined,
                outputTokens: undefined
              }
            );
          }
        );

        // Track actual usage if available
        if (result && !result.cached && !result.mocked && result.usage) {
          costTracker.recordUsage({
            service: 'perplexity',
            model: result.model || params.model,
            inputTokens: result.usage.prompt_tokens || params.inputTokens,
            outputTokens: result.usage.completion_tokens || params.outputTokens,
            operation: 'query',
            requestId: result.requestId || options.requestId
          });
        }

        return result;
      } catch (error) {
        logger.error('Error in optimized Perplexity client', {
          error: error.message,
          query: query.substring(0, 100) + '...'
        });
        throw error;
      }
    },

    /**
     * Conduct deep research through Perplexity with cost optimization
     * 
     * @param {string} query - The research query
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Deep research response
     */
    async conductDeepResearch(query, options = {}) {
      try {
        // Prepare parameters for optimization
        const params = {
          query,
          model: options.model || 'sonar-deep-research',
          ...options
        };

        // Deep research typically requires more tokens
        if (!params.inputTokens && query) {
          params.inputTokens = Math.ceil(query.length / 4);
        }
        
        if (!params.outputTokens) {
          params.outputTokens = options.maxTokens || 4000; // Deep research needs more tokens
        }

        // Process through cost optimizer
        const result = await costOptimizer.processRequest(
          'perplexity',
          'research',
          params,
          // Actual API call function
          async (optimizedParams) => {
            return perplexityService.conductDeepResearch(
              optimizedParams.query,
              {
                ...optimizedParams,
                // Don't pass these parameters to Perplexity
                query: undefined,
                inputTokens: undefined,
                outputTokens: undefined
              }
            );
          }
        );

        // Track actual usage if available
        if (result && !result.cached && !result.mocked && result.usage) {
          costTracker.recordUsage({
            service: 'perplexity',
            model: result.model || params.model,
            inputTokens: result.usage.prompt_tokens || params.inputTokens,
            outputTokens: result.usage.completion_tokens || params.outputTokens,
            operation: 'research',
            requestId: result.requestId || options.requestId
          });
        }

        return result;
      } catch (error) {
        logger.error('Error in optimized Perplexity deep research', {
          error: error.message,
          query: query.substring(0, 100) + '...'
        });
        throw error;
      }
    }
  };
}

/**
 * Get cost optimization statistics
 * 
 * @returns {Object} Cost optimization statistics
 */
export function getCostOptimizationStats() {
  try {
    // Get savings from cost optimizer
    const savings = costOptimizer.getSavings();
    
    // Get usage from cost tracker
    const usage = costTracker.getStatus();
    
    // Calculate efficiency metrics
    const totalSpend = usage.todayUsage || 0;
    const totalSaved = savings.total || 0;
    const efficiency = totalSpend > 0 
      ? (totalSaved / (totalSpend + totalSaved)) * 100 
      : 0;
    
    return {
      savings,
      usage,
      efficiency: {
        percentage: efficiency,
        totalPotentialCost: totalSpend + totalSaved,
        actualCost: totalSpend,
        totalSaved
      },
      optimizationEnabled: {
        caching: costOptimizer.config.enableCaching,
        promptOptimization: costOptimizer.config.enablePromptOptimization,
        modelTiering: costOptimizer.config.enableModelTiering,
        testMode: costOptimizer.config.testMode
      }
    };
  } catch (error) {
    logger.error('Error getting cost optimization stats', { error: error.message });
    return {
      error: 'Failed to retrieve cost optimization statistics'
    };
  }
}

/**
 * Configure cost optimization settings
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Updated configuration
 */
export function configureCostOptimization(options = {}) {
  try {
    // Configure cost optimizer
    costOptimizer.configure(options);
    
    // Configure cost tracker if needed
    if (options.costTracking) {
      costTracker.configure(options.costTracking);
    }
    
    logger.info('Cost optimization configured', { options });
    
    return {
      status: 'success',
      config: {
        costOptimizer: costOptimizer.config,
        costTracker: {
          dailyBudget: costTracker.dailyBudget,
          alertThreshold: costTracker.alertThreshold,
          detailedTracking: costTracker.detailedTracking
        }
      }
    };
  } catch (error) {
    logger.error('Error configuring cost optimization', { error: error.message });
    return {
      status: 'error',
      error: error.message
    };
  }
}