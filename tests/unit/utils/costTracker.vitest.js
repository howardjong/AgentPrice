/**
 * Cost Tracker Unit Tests
 * 
 * Tests the cost tracking functionality for API usage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock first, before any imports
// Mock the logger 
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  };
});

// Mock fs/promises module to avoid file system operations
vi.mock('fs/promises', () => {
  return {
    mkdir: vi.fn(() => Promise.resolve()),
    writeFile: vi.fn(() => Promise.resolve())
  };
});

// Import modules after mocking
import costTracker from '../../../utils/costTracker.js';
import logger from '../../../utils/logger.js';
import * as fsPromises from 'fs/promises';
import path from 'path';

describe('Cost Tracker', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Reset the cost tracker state
    costTracker.totalApiCalls = 0;
    costTracker.todayUsage = 0.0;
    costTracker.usageByService = {};
    costTracker.usageByModel = {};
    costTracker.usageByHour = {};
    costTracker.tokensByRequest = {};
    costTracker.dailyStats = {
      date: costTracker.getCurrentDate(),
      costs: 0,
      tokens: {
        input: 0,
        output: 0
      },
      requests: 0
    };
    
    // Configure with test settings
    costTracker.configure({
      dailyBudget: 10.0,
      alertThreshold: 0.8,
      enableHistoricalData: false, // Disable for most tests
      detailedTracking: true,
      budgetAlertsEnabled: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should have the expected API', () => {
      expect(costTracker).toHaveProperty('recordUsage');
      expect(costTracker).toHaveProperty('configure');
      expect(costTracker).toHaveProperty('getStatus');
      expect(costTracker).toHaveProperty('estimateRequestCost');
      expect(costTracker).toHaveProperty('calculateSavings');
    });

    it('should initialize with default values', () => {
      const status = costTracker.getStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.dailyBudget).toBe(10.0);
      expect(status.todayUsage).toBe(0.0);
      expect(status.totalApiCalls).toBe(0);
    });

    it('should accept configuration options', () => {
      costTracker.configure({
        dailyBudget: 5.0,
        alertThreshold: 0.5,
        detailedTracking: false
      });
      
      expect(costTracker.dailyBudget).toBe(5.0);
      expect(costTracker.alertThreshold).toBe(0.5);
      expect(costTracker.detailedTracking).toBe(false);
    });
  });

  describe('Usage recording', () => {
    it('should record basic API usage', () => {
      const result = costTracker.recordUsage({
        service: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      // Calculate expected cost: 1000 * 0.003/1000 + 500 * 0.015/1000 = 0.003 + 0.0075 = 0.0105
      expect(result.cost).toBeCloseTo(0.0105, 4);
      expect(result.todayTotal).toBeCloseTo(0.0105, 4);
      
      // Check totals were updated
      expect(costTracker.totalApiCalls).toBe(1);
      expect(costTracker.todayUsage).toBeCloseTo(0.0105, 4);
    });

    it('should handle missing model and use default for service', () => {
      const result = costTracker.recordUsage({
        service: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      // Should use 'claude-3-7-sonnet-20250219' as the default
      expect(result.cost).toBeCloseTo(0.0105, 4);
    });

    it('should track usage by service', () => {
      // Record usage for two different services
      costTracker.recordUsage({
        service: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      costTracker.recordUsage({
        service: 'perplexity',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      // Check usage by service
      expect(costTracker.usageByService.anthropic).toBeDefined();
      expect(costTracker.usageByService.perplexity).toBeDefined();
      expect(costTracker.usageByService.anthropic.requests).toBe(1);
      expect(costTracker.usageByService.perplexity.requests).toBe(1);
    });

    it('should track usage by model', () => {
      // Record usage for two different models
      costTracker.recordUsage({
        service: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      costTracker.recordUsage({
        service: 'perplexity',
        model: 'sonar',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      // Check usage by model
      expect(costTracker.usageByModel['claude-3-7-sonnet-20250219']).toBeDefined();
      expect(costTracker.usageByModel['sonar']).toBeDefined();
      expect(costTracker.usageByModel['claude-3-7-sonnet-20250219'].requests).toBe(1);
      expect(costTracker.usageByModel['sonar'].requests).toBe(1);
    });
  });

  describe('Budget management', () => {
    it('should trigger budget alerts when threshold is reached', () => {
      // Configure a low budget
      costTracker.configure({
        dailyBudget: 0.02,
        alertThreshold: 0.5
      });
      
      // First usage should not trigger alert (below threshold)
      costTracker.recordUsage({
        service: 'anthropic',
        inputTokens: 1000,
        outputTokens: 100
      }); // About 0.0045
      
      // Second usage should trigger alert (above threshold)
      costTracker.recordUsage({
        service: 'anthropic',
        inputTokens: 1000,
        outputTokens: 200
      }); // About 0.006, total ~0.0105
      
      // Check that logger.warn was called for budget alert
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn.mock.calls[0][0]).toContain('budget threshold exceeded');
    });

    it('should trigger budget exhaustion alert when budget is exceeded', () => {
      // Configure a very low budget
      costTracker.configure({
        dailyBudget: 0.01,
        alertThreshold: 0.8
      });
      
      // This usage should exceed the budget
      costTracker.recordUsage({
        service: 'anthropic',
        inputTokens: 2000,
        outputTokens: 500
      }); // About 0.0135
      
      // Check that logger.error was called for budget exhaustion
      expect(logger.error).toHaveBeenCalled();
      expect(logger.error.mock.calls[0][0]).toContain('budget exhausted');
    });
  });

  describe('Cost estimation', () => {
    it('should accurately estimate costs for different models', () => {
      // Claude 3.7 Sonnet
      const claudeEstimate = costTracker.estimateRequestCost({
        service: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      expect(claudeEstimate.costs.total).toBeCloseTo(0.0105, 4);
      
      // Perplexity small model
      const perplexityEstimate = costTracker.estimateRequestCost({
        service: 'perplexity',
        model: 'sonar',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      expect(perplexityEstimate.costs.total).toBeCloseTo(0.0015, 4);
    });

    it('should use default model for service if not specified', () => {
      const estimate = costTracker.estimateRequestCost({
        service: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      // Should use Claude 3.7 Sonnet rates
      expect(estimate.costs.total).toBeCloseTo(0.0105, 4);
    });
  });

  describe('Date handling', () => {
    it('should get current date in YYYY-MM-DD format', () => {
      const date = costTracker.getCurrentDate();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should reset daily usage when the date changes', () => {
      // Record some usage
      costTracker.recordUsage({
        service: 'anthropic',
        inputTokens: 1000,
        outputTokens: 500
      });
      
      // Verify usage was recorded
      expect(costTracker.todayUsage).toBeGreaterThan(0);
      
      // Mock a date change
      const originalGetCurrentDate = costTracker.getCurrentDate;
      costTracker.getCurrentDate = vi.fn(() => {
        // Return tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
      });
      
      // This should trigger a date check and reset
      costTracker.checkDate();
      
      // Usage should be reset
      expect(costTracker.todayUsage).toBe(0);
      
      // Restore original function
      costTracker.getCurrentDate = originalGetCurrentDate;
    });
  });

  describe('Data persistence', () => {
    // We'll replace actual storage tests with more isolated unit tests
    // that don't depend on file system interactions
    
    it('should have enableHistoricalData config option', () => {
      // Set the option
      costTracker.configure({
        enableHistoricalData: true
      });
      
      // Check it was set
      expect(costTracker.enableHistoricalData).toBe(true);
      
      // Change it
      costTracker.configure({
        enableHistoricalData: false
      });
      
      // Check it was updated
      expect(costTracker.enableHistoricalData).toBe(false);
    });
    
    it('should call saveUsageData when enableHistoricalData is true', () => {
      // Mock the saveUsageData method
      const originalSaveUsageData = costTracker.saveUsageData;
      costTracker.saveUsageData = vi.fn(() => Promise.resolve());
      
      try {
        // Enable historical data
        costTracker.configure({
          enableHistoricalData: true
        });
        
        // Record usage
        costTracker.recordUsage({
          service: 'anthropic',
          inputTokens: 1000,
          outputTokens: 500
        });
        
        // Check if saveUsageData was called
        expect(costTracker.saveUsageData).toHaveBeenCalled();
      } finally {
        // Restore original method
        costTracker.saveUsageData = originalSaveUsageData;
      }
    });
    
    it('should not call saveUsageData when enableHistoricalData is false', () => {
      // Mock the saveUsageData method
      const originalSaveUsageData = costTracker.saveUsageData;
      costTracker.saveUsageData = vi.fn(() => Promise.resolve());
      
      try {
        // Disable historical data
        costTracker.configure({
          enableHistoricalData: false
        });
        
        // Record usage
        costTracker.recordUsage({
          service: 'anthropic',
          inputTokens: 1000,
          outputTokens: 500
        });
        
        // Check if saveUsageData was not called
        expect(costTracker.saveUsageData).not.toHaveBeenCalled();
      } finally {
        // Restore original method
        costTracker.saveUsageData = originalSaveUsageData;
      }
    });
  });
});