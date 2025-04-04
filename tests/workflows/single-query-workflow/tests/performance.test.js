/**
 * Performance Workflow Test
 * 
 * Tests the workflow's performance characteristics.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadFixtures, runAndValidateTest, formatValidationResults } from '../test-utils.js';

describe('Performance Single Query Workflow Test', () => {
  // Load fixtures before tests
  beforeAll(async () => {
    await loadFixtures();
  });
  
  it('should run performance tests across multiple iterations', async () => {
    const NUM_RUNS = 3;
    const results = [];
    
    // Run multiple test iterations
    for (let i = 0; i < NUM_RUNS; i++) {
      console.log(`Running performance test iteration ${i + 1}/${NUM_RUNS}`);
      
      const result = await runAndValidateTest('performance', {
        useRealAPIs: false,
        saveResults: true
      });
      
      results.push(result);
      
      // Pause between runs to avoid any rate limiting or threading issues
      if (i < NUM_RUNS - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Calculate performance metrics across runs
    const avgTotalDuration = results.reduce((sum, r) => sum + r.metrics.test.duration, 0) / NUM_RUNS;
    
    const stageDurations = {};
    
    // Calculate average durations for each stage
    results.forEach(result => {
      Object.entries(result.metrics.stages).forEach(([stage, data]) => {
        if (!stageDurations[stage]) {
          stageDurations[stage] = [];
        }
        stageDurations[stage].push(data.duration);
      });
    });
    
    const avgStageDurations = {};
    Object.entries(stageDurations).forEach(([stage, durations]) => {
      avgStageDurations[stage] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    });
    
    // Log performance results
    console.log('\nPerformance Results:');
    console.log(`Average total duration: ${avgTotalDuration.toFixed(2)}ms`);
    Object.entries(avgStageDurations).forEach(([stage, avg]) => {
      console.log(`Average ${stage} duration: ${avg.toFixed(2)}ms`);
    });
    
    // Test expectations
    results.forEach((result, i) => {
      expect(result.success, `Run ${i + 1} should be successful`).toBe(true);
    });
    
    // Verify all results include the necessary data
    results.forEach((result, i) => {
      expect(result.researchContent, `Run ${i + 1} should have research content`).toBeDefined();
      expect(result.chartData, `Run ${i + 1} should have chart data`).toBeDefined();
      expect(result.plotlyConfig, `Run ${i + 1} should have Plotly config`).toBeDefined();
    });
    
    // Analyze duration consistency
    const durationVariance = calculateVariance(results.map(r => r.metrics.test.duration));
    console.log(`Duration variance: ${durationVariance.toFixed(2)}ms²`);
    
    // Create variance report for each stage
    console.log('\nStage Variance Report:');
    Object.entries(stageDurations).forEach(([stage, durations]) => {
      const variance = calculateVariance(durations);
      console.log(`${stage}: ${variance.toFixed(2)}ms²`);
    });
  });
});

/**
 * Calculate statistical variance of an array of numbers
 * @param {number[]} values - Array of values
 * @returns {number} The variance
 */
function calculateVariance(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}