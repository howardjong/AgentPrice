/**
 * Test configuration for Single Query Workflow Tests
 * 
 * This module defines the available test variants and their configuration.
 */

// Define test variants
export const testVariants = {
  basic: {
    name: 'Basic Workflow Test',
    description: 'Basic end-to-end test of the single query workflow',
    defaultQuery: 'What are the latest advancements in renewable energy storage?',
    timeoutMs: 10000,
    expectedOutputs: {
      chartTypes: ['bar', 'line', 'pie']
    }
  },
  
  performance: {
    name: 'Performance Test',
    description: 'Tests focusing on performance metrics and response times',
    defaultQuery: 'Explain the concept of quantum computing in simple terms',
    timeoutMs: 15000,
    iterations: 3,
    expectedOutputs: {
      maxDurationMs: 12000
    }
  },
  
  reliability: {
    name: 'Reliability Test',
    description: 'Tests reliability across different types of queries',
    queries: [
      "Who are the current leaders in quantum computing hardware development?",
      "Analyze the impact of generative AI on content creation industries between 2023-2025",
      "What is the current market share breakdown of the top 5 EV manufacturers globally?",
      "Explain the benefits and limitations of transformer architecture in modern NLP models"
    ],
    timeoutMs: 20000,
    expectedOutputs: {
      successRate: 0.75
    }
  },
  
  errorHandling: {
    name: 'Error Handling Test',
    description: 'Tests system response to various error conditions',
    defaultQuery: 'What are the primary factors affecting climate change?',
    timeoutMs: 10000,
    errorScenarios: [
      'researchServiceFailure',
      'chartGenerationFailure',
      'serviceUnavailable',
      'invalidApiKey'
    ]
  }
};

// Default test configuration
export const defaultTestConfig = {
  useRealAPIs: false,
  saveResults: true,
  retryCount: 2,
  verbose: true
};

// Configuration for test results storage
export const resultsConfig = {
  directory: 'test-results/single-query-workflow',
  saveFormat: 'json'
};