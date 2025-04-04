
/**
 * Configuration for single-query workflow tests
 * Supports both mock and real API testing modes
 */

const DEFAULT_TEST_OPTIONS = {
  // Test execution mode
  useRealAPIs: false,          // Use real APIs instead of mocks
  saveResults: true,           // Save test results to file
  
  // Query configuration
  query: "What are the latest developments in quantum computing?",
  visualizationType: "basic_bar",
  
  // Feature flags
  enableDeepResearch: true,    // Enable deep research in the workflow
  
  // Test behavior configuration
  timeoutMs: 60000,            // Overall test timeout
  logLevel: 'info',            // Logging level (debug, info, warn, error)
  
  // Result paths
  outputDir: './tests/output/single-query-workflow/',
};

/**
 * Test variants for different scenarios
 */
const TEST_VARIANTS = {
  basic: {
    name: 'Basic Workflow Test',
    description: 'Tests the basic end-to-end workflow with default settings',
    options: {}
  },
  
  performance: {
    name: 'Performance Test',
    description: 'Tests the workflow with performance metrics collection',
    options: {
      collectPerformanceMetrics: true,
      saveMetrics: true
    }
  },
  
  reliability: {
    name: 'Reliability Test',
    description: 'Tests the workflow with error injection and recovery',
    options: {
      injectErrors: true,
      errorRate: 0.2,
      maxRetries: 3
    }
  },
  
  noDeepResearch: {
    name: 'No Deep Research Test',
    description: 'Tests the workflow without deep research',
    options: {
      enableDeepResearch: false
    }
  },
  
  charts: {
    name: 'Chart Generation Test',
    description: 'Tests various chart generation scenarios',
    options: {
      visualizationTypes: ['basic_bar', 'van_westendorp', 'conjoint']
    }
  }
};

module.exports = {
  DEFAULT_TEST_OPTIONS,
  TEST_VARIANTS
};
