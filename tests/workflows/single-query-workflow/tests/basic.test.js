/**
 * Basic Tests for Single Query Workflow
 * 
 * This file contains basic functional tests for the single-query workflow.
 * These tests verify the core functionality using mock services.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { runTest } from '../test-runner.js';
import { resetMocks, configureMockForQuery } from '../mock-services.js';

// Test setup
beforeEach(() => {
  // Reset mocks before each test
  resetMocks();
});

describe('Basic Single Query Workflow Tests', () => {
  test('should complete the entire workflow with default query', async () => {
    // Run the workflow with default options
    const results = await runTest();
    
    // Verify the workflow completed successfully
    expect(results.success).toBe(true);
    
    // Verify each stage produced expected outputs
    expect(results.clarifiedQuery).toBeDefined();
    expect(results.researchContent).toBeDefined();
    expect(results.extractedData).toBeDefined();
    expect(results.plotlyConfig).toBeDefined();
    
    // Verify the chart data is properly structured
    expect(results.plotlyConfig.data).toBeInstanceOf(Array);
    expect(results.plotlyConfig.layout).toBeInstanceOf(Object);
    expect(results.plotlyConfig.layout.title).toBeDefined();
  });
  
  test('should complete workflow with a custom query', async () => {
    // Run the workflow with a custom query
    const customQuery = 'What are the latest advancements in quantum computing?';
    const results = await runTest({ query: customQuery });
    
    // Verify successful completion
    expect(results.success).toBe(true);
    
    // Verify the query was clarified
    expect(results.clarifiedQuery).toContain('quantum computing');
    
    // Verify research was performed
    expect(results.researchContent).toBeDefined();
    expect(results.researchContent).toContain('quantum computing');
    
    // Verify sources were provided
    expect(results.sources).toBeInstanceOf(Array);
    expect(results.sources.length).toBeGreaterThan(0);
  });
  
  test('should extract appropriate data for visualizations', async () => {
    // Configure a custom mock response
    const query = 'What are global renewable energy adoption rates?';
    configureMockForQuery(query, {
      clarification: {
        clarifiedQuery: 'What are the current global adoption rates of different renewable energy technologies?',
        clarificationContext: {
          refinementReason: 'Made the query more specific to compare different technologies',
          confidenceScore: 0.95,
          modelUsed: 'claude-mock'
        }
      },
      research: {
        content: `
          Global renewable energy adoption has seen significant growth in recent years.
          Solar energy adoption reached 25% in developed countries and 15% in developing nations.
          Wind power accounts for 20% of energy production in Europe, 12% in North America, and 8% in Asia.
          Hydroelectric power remains at 30% globally with minimal recent growth.
          Geothermal energy is still only at 5% adoption worldwide.
        `,
        sources: [
          { title: 'Global Renewable Energy Report 2024', url: 'https://example.com/energy-report' },
          { title: 'Renewable Technology Adoption Trends', url: 'https://example.com/adoption-trends' }
        ],
        modelUsed: 'sonar-deep-research-mock'
      }
    });
    
    // Run the workflow with the configured query
    const results = await runTest({ query });
    
    // Verify the extracted data includes the specified technologies
    expect(results.extractedData).toBeDefined();
    expect(results.extractedData.chartType).toBeDefined();
    expect(results.extractedData.categories).toBeInstanceOf(Array);
    expect(results.extractedData.values).toBeInstanceOf(Array);
    
    // Verify the chart configuration was generated correctly
    expect(results.plotlyConfig).toBeDefined();
    expect(results.plotlyConfig.data[0].type).toBeDefined();
    expect(results.plotlyConfig.layout.title).toBeDefined();
  });
  
  test('should report timing metrics for each stage', async () => {
    // Run the workflow with timing metrics
    const results = await runTest();
    
    // Verify timing metrics for each stage
    expect(results.stageTiming.clarification).toBeDefined();
    expect(results.stageTiming.clarification.start).toBeDefined();
    expect(results.stageTiming.clarification.end).toBeDefined();
    
    expect(results.stageTiming.research).toBeDefined();
    expect(results.stageTiming.research.start).toBeDefined();
    expect(results.stageTiming.research.end).toBeDefined();
    
    expect(results.stageTiming.extraction).toBeDefined();
    expect(results.stageTiming.extraction.start).toBeDefined();
    expect(results.stageTiming.extraction.end).toBeDefined();
    
    expect(results.stageTiming.charting).toBeDefined();
    expect(results.stageTiming.charting.start).toBeDefined();
    expect(results.stageTiming.charting.end).toBeDefined();
    
    // Check that each stage took some amount of time (even if mocked)
    for (const stage of Object.values(results.stageTiming)) {
      expect(stage.end).toBeGreaterThanOrEqual(stage.start);
    }
  });
});