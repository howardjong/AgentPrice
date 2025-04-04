/**
 * Reliability Workflow Test
 * 
 * Tests the workflow across different query types and topics.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadFixtures, runAndValidateTest, formatValidationResults } from '../test-utils.js';

describe('Reliability Single Query Workflow Test', () => {
  // Test query categories
  const TEST_QUERIES = {
    factual: "Who are the current leaders in quantum computing hardware development?",
    analytical: "Analyze the impact of generative AI on content creation industries between 2023-2025",
    numeric: "What is the current market share breakdown of the top 5 EV manufacturers globally?",
    technical: "Explain the benefits and limitations of transformer architecture in modern NLP models"
  };
  
  // Load fixtures before tests
  beforeAll(async () => {
    await loadFixtures();
  });
  
  it('should reliably handle different query types', async () => {
    const results = [];
    
    // Run tests for each query type
    for (const [queryType, query] of Object.entries(TEST_QUERIES)) {
      console.log(`Testing ${queryType} query: "${query}"`);
      
      const result = await runAndValidateTest('reliability', {
        useRealAPIs: false,
        query,
        saveResults: true
      });
      
      results.push({
        queryType,
        query,
        success: result.success,
        error: result.error,
        validation: result.validation,
        metrics: result.metrics
      });
      
      // Log results
      console.log(`- ${queryType} query ${result.success ? 'succeeded' : 'failed'}`);
      if (!result.success) {
        console.log(`  Error: ${result.error}`);
      } else {
        console.log(`  Content length: ${result.researchContent.length} characters`);
        console.log(`  Sources: ${result.sources.length}`);
        console.log(`  Validation: ${result.validation.valid ? 'Passed' : 'Failed'}`);
      }
      
      // Pause between runs to avoid any rate limiting or threading issues
      if (queryType !== Object.keys(TEST_QUERIES).pop()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Calculate reliability statistics
    const successRate = results.filter(r => r.success).length / results.length;
    console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);
    
    const validationRate = results.filter(r => r.success && r.validation.valid).length / results.length;
    console.log(`Validation pass rate: ${(validationRate * 100).toFixed(1)}%`);
    
    // Log failures if any
    const failures = results.filter(r => !r.success || !r.validation.valid);
    if (failures.length > 0) {
      console.log('\nFailures:');
      failures.forEach(f => {
        console.log(`- ${f.queryType}: ${f.success ? 'Execution succeeded but validation failed' : f.error}`);
        if (f.success) {
          console.log(formatValidationResults(f.validation));
        }
      });
    }
    
    // Test expectations
    expect(successRate).toBeGreaterThanOrEqual(0.75);
    expect(validationRate).toBeGreaterThanOrEqual(0.5);
    
    // Verify all tests executed
    expect(results.length).toBe(Object.keys(TEST_QUERIES).length);
  });
});