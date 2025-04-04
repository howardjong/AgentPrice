/**
 * Test configuration for single-query workflow tests
 * 
 * This file defines the available test variants and their configurations.
 */

const TEST_VARIANTS = {
  /**
   * Basic test with standard configuration
   */
  basic: {
    name: "Basic Workflow Test",
    description: "Standard end-to-end workflow test with basic configuration",
    defaultQuery: "What are the latest developments in renewable energy storage technologies?",
    visualizationType: "basic_bar",
    enableDeepResearch: true,
    enableChunking: true,
    followupQuestions: false,
    saveResults: true
  },

  /**
   * Performance-focused test variant
   */
  performance: {
    name: "Performance Test",
    description: "Test optimized for measuring performance characteristics",
    defaultQuery: "Compare the market share of major cloud providers and their growth trends",
    visualizationType: "basic_bar",
    enableDeepResearch: true,
    enableChunking: true,
    followupQuestions: false,
    saveResults: true,
    performanceMetrics: true
  },

  /**
   * Reliability test variant with diverse query types
   */
  reliability: {
    name: "Reliability Test",
    description: "Test with complex query to verify reliability",
    defaultQuery: "Analyze the impact of generative AI on content creation industries between 2023-2025",
    visualizationType: "basic_bar",
    enableDeepResearch: true,
    enableChunking: true,
    followupQuestions: true,
    saveResults: true
  },

  /**
   * Error handling test variant
   */
  errorHandling: {
    name: "Error Handling Test",
    description: "Test with intentional error conditions to verify recovery",
    defaultQuery: "What are the latest developments in renewable energy storage technologies?",
    visualizationType: "basic_bar",
    enableDeepResearch: true,
    enableChunking: false,
    followupQuestions: false,
    saveResults: true,
    injectErrors: true,
    errorPoints: ["research", "dataExtraction"]
  },

  /**
   * Test without deep research (basic mode)
   */
  noDeepResearch: {
    name: "Basic Research Mode Test",
    description: "Test using the basic research mode instead of deep research",
    defaultQuery: "What are the top 5 cloud computing providers in 2025?",
    visualizationType: "basic_bar",
    enableDeepResearch: false,
    enableChunking: true,
    followupQuestions: false,
    saveResults: true
  },

  /**
   * Van Westendorp price sensitivity chart test
   */
  vanWestendorp: {
    name: "Van Westendorp Price Analysis",
    description: "Test generating Van Westendorp price sensitivity analysis charts",
    defaultQuery: "What is the optimal pricing strategy for premium electric vehicles in 2025?",
    visualizationType: "van_westendorp",
    enableDeepResearch: true,
    enableChunking: true,
    followupQuestions: false,
    saveResults: true
  },

  /**
   * Conjoint analysis chart test
   */
  conjoint: {
    name: "Conjoint Analysis Test",
    description: "Test generating conjoint analysis charts for product features",
    defaultQuery: "What are the most important features for consumers when purchasing smartphones in 2025?",
    visualizationType: "conjoint",
    enableDeepResearch: true,
    enableChunking: true,
    followupQuestions: false,
    saveResults: true
  },

  /**
   * Cross-service recovery test
   */
  crossServiceRecovery: {
    name: "Cross-Service Recovery Test",
    description: "Test recovery when one service fails but others continue",
    defaultQuery: "What are the latest developments in renewable energy storage technologies?",
    visualizationType: "basic_bar",
    enableDeepResearch: true,
    enableChunking: true,
    followupQuestions: false,
    saveResults: true,
    simulatePartialFailure: true,
    failureService: "claude", // Claude will fail but Perplexity should succeed
    recoveryAttempts: 3
  },

  /**
   * Long-running reliability test
   */
  longRunning: {
    name: "Long-Running Reliability Test",
    description: "Test for workflow reliability over extended operation",
    defaultQuery: "Provide a detailed analysis of climate change mitigation technologies with effectiveness statistics",
    visualizationType: "basic_bar",
    enableDeepResearch: true,
    enableChunking: true,
    followupQuestions: true,
    extendedContent: true, // Generate more extensive content
    saveResults: true
  }
};

module.exports = {
  TEST_VARIANTS
};