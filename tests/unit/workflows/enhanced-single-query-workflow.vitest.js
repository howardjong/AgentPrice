
/**
 * Enhanced Single Query Workflow Tests
 * 
 * This test suite uses the enhanced dual-mode testing framework to verify
 * the single-query workflow with various configurations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runWorkflowTest } from '../../workflows/single-query-workflow/test-runner.js';

// Mock or spy on essential dependencies
// We'll use the existing mock services from the test-runner

describe('Single Query Workflow', () => {
  // Use a shorter timeout for mocked tests but longer for real API tests
  const testTimeout = process.env.USE_REAL_APIS ? 60000 : 15000;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });
  
  describe('Basic functionality', () => {
    it('should complete a basic workflow with mock APIs', async () => {
      // Run the basic workflow test with mock APIs
      const results = await runWorkflowTest('basic', { 
        query: 'What are the best practices for unit testing?',
        useRealAPIs: false
      });
      
      // Verify results
      expect(results).toBeDefined();
      expect(results.success).toBe(true);
      expect(results.query).toContain('unit testing');
      expect(results.researchContent).toBeDefined();
      expect(results.chartData).toBeDefined();
      expect(results.chartData.plotlyConfig).toBeDefined();
      expect(results.chartData.insights.length).toBeGreaterThan(0);
      
      // Verify metrics
      expect(results.metrics).toBeDefined();
      expect(results.metrics.stages.research).toBeDefined();
      expect(results.metrics.stages.dataExtraction).toBeDefined();
      expect(results.metrics.stages.chartGeneration).toBeDefined();
    }, testTimeout);
    
    // Add a conditional test that only runs with real APIs when needed
    (process.env.USE_REAL_APIS ? it : it.skip)('should complete a basic workflow with real APIs', async () => {
      // Run with real APIs
      const results = await runWorkflowTest('basic', { 
        query: 'What are the best practices for unit testing?',
        useRealAPIs: true
      });
      
      // Verify results with real APIs
      expect(results).toBeDefined();
      expect(results.success).toBe(true);
      expect(results.query).toContain('unit testing');
      expect(results.researchContent).toBeDefined();
      expect(results.chartData).toBeDefined();
      expect(results.chartData.plotlyConfig).toBeDefined();
      expect(results.chartData.insights.length).toBeGreaterThan(0);
    }, 120000); // Longer timeout for real API test
  });
  
  describe('Chart generation variants', () => {
    it('should generate a basic bar chart', async () => {
      const results = await runWorkflowTest('basic', { 
        visualizationType: 'basic_bar'
      });
      
      expect(results.success).toBe(true);
      expect(results.chartData.plotlyConfig.data[0].type).toContain('bar');
    }, testTimeout);
    
    it('should generate a van westendorp chart', async () => {
      const results = await runWorkflowTest('basic', { 
        visualizationType: 'van_westendorp'
      });
      
      expect(results.success).toBe(true);
      expect(results.chartData.plotlyConfig).toBeDefined();
      // Van Westendorp specific validations
      expect(results.chartData.plotlyConfig.data.length).toBeGreaterThanOrEqual(4);
    }, testTimeout);
  });
  
  describe('Deep research functionality', () => {
    it('should perform deep research when enabled', async () => {
      const results = await runWorkflowTest('basic', { 
        enableDeepResearch: true
      });
      
      expect(results.success).toBe(true);
      expect(results.deepResearch).toBeDefined();
      expect(results.sources.length).toBeGreaterThan(0);
    }, testTimeout);
    
    it('should skip deep research when disabled', async () => {
      const results = await runWorkflowTest('noDeepResearch');
      
      expect(results.success).toBe(true);
      expect(results.deepResearch).toBeUndefined();
    }, testTimeout);
  });
  
  describe('Performance metrics', () => {
    it('should collect detailed performance metrics', async () => {
      const results = await runWorkflowTest('performance');
      
      expect(results.success).toBe(true);
      expect(results.metrics).toBeDefined();
      expect(results.metrics.performance).toBeDefined();
      expect(results.metrics.stages).toBeDefined();
      
      // Verify we have memory measurements
      expect(results.metrics.performance.start).toBeDefined();
      expect(results.metrics.performance.end).toBeDefined();
      
      // Verify we have timing for all stages
      const stageNames = Object.keys(results.metrics.stages);
      expect(stageNames).toContain('research');
      expect(stageNames).toContain('dataExtraction');
      expect(stageNames).toContain('chartGeneration');
      
      // Each stage should have timing information
      stageNames.forEach(stage => {
        expect(results.metrics.stages[stage].duration).toBeGreaterThan(0);
      });
    }, testTimeout);
  });
});
