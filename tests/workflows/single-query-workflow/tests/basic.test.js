/**
 * Basic Single Query Workflow Test
 * 
 * This file contains basic end-to-end tests for the single query workflow.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadFixtures, runAndValidateTest, validateChartData } from '../test-utils.js';

describe('Basic Single Query Workflow Test', () => {
  // Load fixtures before tests
  beforeAll(async () => {
    await loadFixtures();
  });
  
  it('should execute the full workflow successfully', async () => {
    // Run a basic test with default query
    const results = await runAndValidateTest('basic', {
      useRealAPIs: false,
      saveResults: true
    });
    
    // Check overall success
    expect(results.success).toBe(true);
    
    // Check for the presence of all required data elements
    expect(results.clarifiedQuery).toBeDefined();
    expect(results.researchContent).toBeDefined();
    expect(typeof results.researchContent).toBe('string');
    expect(results.researchContent.length).toBeGreaterThan(100);
    
    expect(results.sources).toBeDefined();
    expect(Array.isArray(results.sources)).toBe(true);
    
    expect(results.extractedData).toBeDefined();
    expect(typeof results.extractedData).toBe('object');
    
    expect(results.chartData).toBeDefined();
    expect(typeof results.chartData).toBe('object');
    
    expect(results.plotlyConfig).toBeDefined();
    expect(typeof results.plotlyConfig).toBe('object');
    expect(results.plotlyConfig.data).toBeDefined();
    expect(Array.isArray(results.plotlyConfig.data)).toBe(true);
    expect(results.plotlyConfig.data.length).toBeGreaterThan(0);
    
    // Check the chart data structure
    const chartValidation = validateChartData(results.plotlyConfig);
    expect(chartValidation.valid).toBe(true);
    
    if (chartValidation.warnings.length > 0) {
      console.log('Chart validation warnings:', chartValidation.warnings);
    }
    
    // Verify timing data is present
    expect(results.stageTiming).toBeDefined();
    expect(results.stageTiming.clarification).toBeDefined();
    expect(results.stageTiming.research).toBeDefined();
    expect(results.stageTiming.extraction).toBeDefined();
    expect(results.stageTiming.charting).toBeDefined();
    
    // Log the test results
    console.log('\nBasic workflow test results:');
    console.log(`- Clarified query: "${results.clarifiedQuery}"`);
    console.log(`- Research content: ${results.researchContent.length} characters`);
    console.log(`- Sources: ${results.sources.length}`);
    console.log(`- Chart type: ${results.plotlyConfig.data[0].type}`);
    console.log('- Stage durations:');
    Object.entries(results.stageTiming).forEach(([stage, timing]) => {
      const duration = timing.end - timing.start;
      console.log(`  * ${stage}: ${duration}ms`);
    });
  });
  
  it('should generate a valid chart with appropriate data', async () => {
    // Run a test focusing on chart generation
    const results = await runAndValidateTest('basic', {
      query: 'What is the market share of leading cloud providers?',
      useRealAPIs: false
    });
    
    // Check overall success
    expect(results.success).toBe(true);
    
    // Validate the chart data structure is correct
    const chartValidation = validateChartData(results.plotlyConfig);
    expect(chartValidation.valid).toBe(true);
    
    // Check that the chart type is appropriate for the data
    const chartType = results.plotlyConfig.data[0].type;
    expect(['bar', 'pie', 'scatter']).toContain(chartType);
    
    // Verify the chart has a title
    expect(results.plotlyConfig.layout.title).toBeDefined();
    expect(typeof results.plotlyConfig.layout.title).toBe('string');
    expect(results.plotlyConfig.layout.title.length).toBeGreaterThan(5);
    
    // For bar and line charts, verify axes are properly labeled
    if (chartType === 'bar' || chartType === 'scatter') {
      expect(results.plotlyConfig.layout.xaxis).toBeDefined();
      expect(results.plotlyConfig.layout.yaxis).toBeDefined();
    }
    
    // For pie charts, verify labels and values
    if (chartType === 'pie') {
      expect(results.plotlyConfig.data[0].labels).toBeDefined();
      expect(Array.isArray(results.plotlyConfig.data[0].labels)).toBe(true);
      expect(results.plotlyConfig.data[0].values).toBeDefined();
      expect(Array.isArray(results.plotlyConfig.data[0].values)).toBe(true);
      expect(results.plotlyConfig.data[0].labels.length).toBe(results.plotlyConfig.data[0].values.length);
    }
  });
});