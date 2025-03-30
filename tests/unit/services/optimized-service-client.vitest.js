/**
 * @file optimized-service-client.vitest.js
 * @description Tests for the optimized service client with cost optimization features
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as optimizedServiceClient from '../../../services/optimizedServiceClient.js';
import * as claudeService from '../../../services/claudeService.js';
import * as perplexityService from '../../../services/perplexityService.js';
import costOptimizer from '../../../utils/costOptimizer.js';
import costTracker from '../../../utils/costTracker.js';

// Mock the dependencies
vi.mock('../../../services/claudeService.js', () => ({
  processText: vi.fn(),
  generatePlotlyVisualization: vi.fn()
}));

vi.mock('../../../services/perplexityService.js', () => ({
  processQuery: vi.fn(),
  conductDeepResearch: vi.fn()
}));

vi.mock('../../../utils/costOptimizer.js', () => ({
  default: {
    processRequest: vi.fn(),
    getSavings: vi.fn(),
    configure: vi.fn(),
    config: {
      enableCaching: true,
      enablePromptOptimization: true,
      enableModelTiering: true,
      testMode: false
    }
  }
}));

vi.mock('../../../utils/costTracker.js', () => ({
  default: {
    recordUsage: vi.fn(),
    getStatus: vi.fn(),
    configure: vi.fn(),
    dailyBudget: 10.0,
    alertThreshold: 0.8,
    detailedTracking: true
  }
}));

vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Optimized Service Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Optimized Claude Client', () => {
    test('should process text through cost optimizer', async () => {
      // Setup mock response
      const mockResponse = {
        content: 'This is a response from Claude',
        model: 'claude-3-7-sonnet-20250219',
        usage: {
          input_tokens: 20,
          output_tokens: 50
        }
      };
      
      // Setup cost optimizer to return the mock response
      costOptimizer.processRequest.mockResolvedValue(mockResponse);
      
      // Get the optimized client
      const claudeClient = optimizedServiceClient.getOptimizedClaudeClient();
      
      // Call processText
      const result = await claudeClient.processText('Hello, Claude!', {
        model: 'claude-3-7-sonnet-20250219'
      });
      
      // Verify cost optimizer was called correctly
      expect(costOptimizer.processRequest).toHaveBeenCalledWith(
        'anthropic',
        'conversation',
        expect.objectContaining({
          prompt: 'Hello, Claude!',
          model: 'claude-3-7-sonnet-20250219'
        }),
        expect.any(Function)
      );
      
      // Verify result
      expect(result).toEqual(mockResponse);
      
      // Verify cost tracking
      expect(costTracker.recordUsage).toHaveBeenCalled();
    });
    
    test('should generate visualization through cost optimizer', async () => {
      // Setup mock response
      const mockResponse = {
        visualizationResult: 'plotly-json-data',
        model: 'claude-3-7-sonnet-20250219',
        usage: {
          input_tokens: 100,
          output_tokens: 500
        }
      };
      
      // Setup cost optimizer to return the mock response
      costOptimizer.processRequest.mockResolvedValue(mockResponse);
      
      // Get the optimized client
      const claudeClient = optimizedServiceClient.getOptimizedClaudeClient();
      
      // Call generateVisualization
      const visualizationData = {
        type: 'bar',
        data: {
          labels: ['A', 'B', 'C'],
          values: [10, 20, 30]
        }
      };
      
      const result = await claudeClient.generateVisualization(visualizationData, {
        model: 'claude-3-7-sonnet-20250219'
      });
      
      // Verify cost optimizer was called correctly
      expect(costOptimizer.processRequest).toHaveBeenCalledWith(
        'anthropic',
        'visualization',
        expect.objectContaining({
          visualizationType: 'bar',
          model: 'claude-3-7-sonnet-20250219'
        }),
        expect.any(Function)
      );
      
      // Verify result
      expect(result).toEqual(mockResponse);
      
      // Verify cost tracking
      expect(costTracker.recordUsage).toHaveBeenCalled();
    });
    
    test('should handle errors in Claude API calls', async () => {
      // Setup cost optimizer to throw an error
      costOptimizer.processRequest.mockRejectedValue(new Error('API error'));
      
      // Get the optimized client
      const claudeClient = optimizedServiceClient.getOptimizedClaudeClient();
      
      // Call processText and expect it to throw
      await expect(claudeClient.processText('Hello, Claude!')).rejects.toThrow('API error');
    });
  });
  
  describe('Optimized Perplexity Client', () => {
    test('should process query through cost optimizer', async () => {
      // Setup mock response
      const mockResponse = {
        content: 'This is a response from Perplexity',
        model: 'sonar',
        usage: {
          prompt_tokens: 15,
          completion_tokens: 40
        }
      };
      
      // Setup cost optimizer to return the mock response
      costOptimizer.processRequest.mockResolvedValue(mockResponse);
      
      // Get the optimized client
      const perplexityClient = optimizedServiceClient.getOptimizedPerplexityClient();
      
      // Call processQuery
      const result = await perplexityClient.processQuery('What is AI?', {
        model: 'sonar'
      });
      
      // Verify cost optimizer was called correctly
      expect(costOptimizer.processRequest).toHaveBeenCalledWith(
        'perplexity',
        'query',
        expect.objectContaining({
          query: 'What is AI?',
          model: 'sonar'
        }),
        expect.any(Function)
      );
      
      // Verify result
      expect(result).toEqual(mockResponse);
      
      // Verify cost tracking
      expect(costTracker.recordUsage).toHaveBeenCalled();
    });
    
    test('should conduct deep research through cost optimizer', async () => {
      // Setup mock response
      const mockResponse = {
        content: 'Detailed research on quantum computing',
        model: 'sonar-deep-research',
        citations: ['https://example.com/research'],
        usage: {
          prompt_tokens: 30,
          completion_tokens: 2000
        }
      };
      
      // Setup cost optimizer to return the mock response
      costOptimizer.processRequest.mockResolvedValue(mockResponse);
      
      // Get the optimized client
      const perplexityClient = optimizedServiceClient.getOptimizedPerplexityClient();
      
      // Call conductDeepResearch
      const result = await perplexityClient.conductDeepResearch(
        'Explain quantum computing advances in 2025',
        {
          model: 'sonar-deep-research',
          recencyFilter: 'month'
        }
      );
      
      // Verify cost optimizer was called correctly
      expect(costOptimizer.processRequest).toHaveBeenCalledWith(
        'perplexity',
        'research',
        expect.objectContaining({
          query: 'Explain quantum computing advances in 2025',
          model: 'sonar-deep-research',
          recencyFilter: 'month'
        }),
        expect.any(Function)
      );
      
      // Verify result
      expect(result).toEqual(mockResponse);
      
      // Verify cost tracking
      expect(costTracker.recordUsage).toHaveBeenCalled();
    });
    
    test('should handle errors in Perplexity API calls', async () => {
      // Setup cost optimizer to throw an error
      costOptimizer.processRequest.mockRejectedValue(new Error('API limit exceeded'));
      
      // Get the optimized client
      const perplexityClient = optimizedServiceClient.getOptimizedPerplexityClient();
      
      // Call processQuery and expect it to throw
      await expect(perplexityClient.processQuery('What is quantum computing?')).rejects.toThrow('API limit exceeded');
    });
  });
  
  describe('Cost Optimization Configuration', () => {
    test('should configure cost optimization settings', () => {
      // Configure cost optimization
      const result = optimizedServiceClient.configureCostOptimization({
        enableCaching: true,
        enablePromptOptimization: false,
        enableModelTiering: true,
        testMode: true,
        costTracking: {
          dailyBudget: 5.0,
          alertThreshold: 0.7
        }
      });
      
      // Verify cost optimizer was configured
      expect(costOptimizer.configure).toHaveBeenCalledWith({
        enableCaching: true,
        enablePromptOptimization: false,
        enableModelTiering: true,
        testMode: true,
        costTracking: {
          dailyBudget: 5.0,
          alertThreshold: 0.7
        }
      });
      
      // Verify cost tracker was configured
      expect(costTracker.configure).toHaveBeenCalledWith({
        dailyBudget: 5.0,
        alertThreshold: 0.7
      });
      
      // Verify result
      expect(result.status).toBe('success');
    });
    
    test('should handle errors in configuration', () => {
      // Setup cost optimizer to throw an error
      costOptimizer.configure.mockImplementation(() => {
        throw new Error('Invalid configuration');
      });
      
      // Configure cost optimization
      const result = optimizedServiceClient.configureCostOptimization({
        invalidOption: true
      });
      
      // Verify result
      expect(result.status).toBe('error');
      expect(result.error).toBe('Invalid configuration');
    });
  });
  
  describe('Cost Optimization Statistics', () => {
    test('should get cost optimization statistics', () => {
      // Setup mock data
      costOptimizer.getSavings.mockReturnValue({
        caching: 0.5,
        tokenOptimization: 0.2,
        modelTiering: 0.3,
        testMode: 1.0,
        total: 2.0
      });
      
      costTracker.getStatus.mockReturnValue({
        todayUsage: 3.0,
        dailyBudget: 10.0,
        totalApiCalls: 100
      });
      
      // Get cost optimization stats
      const stats = optimizedServiceClient.getCostOptimizationStats();
      
      // Verify costOptimizer.getSavings was called
      expect(costOptimizer.getSavings).toHaveBeenCalled();
      
      // Verify costTracker.getStatus was called
      expect(costTracker.getStatus).toHaveBeenCalled();
      
      // Verify stats
      expect(stats.savings.total).toBe(2.0);
      expect(stats.usage.todayUsage).toBe(3.0);
      expect(stats.efficiency.totalSaved).toBe(2.0);
      expect(stats.efficiency.actualCost).toBe(3.0);
      expect(stats.efficiency.totalPotentialCost).toBe(5.0);
      expect(stats.efficiency.percentage).toBe(40); // 2.0 / 5.0 * 100
    });
    
    test('should handle errors when getting stats', () => {
      // Setup cost optimizer to throw an error
      costOptimizer.getSavings.mockImplementation(() => {
        throw new Error('Failed to get savings');
      });
      
      // Get cost optimization stats
      const stats = optimizedServiceClient.getCostOptimizationStats();
      
      // Verify result
      expect(stats.error).toBeDefined();
    });
  });
});