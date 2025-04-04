
/**
 * Workflow Test Registry
 * 
 * This file serves as a central registry of all workflow tests for the single-query
 * workflow, documenting what each test covers, what modes it supports, and any
 * special considerations.
 * 
 * This registry helps organize our approach and identify coverage gaps.
 */

const TEST_REGISTRY = {
  // Vitest/Jest workflow tests
  "unit/workflows/single-query-workflow.vitest.js": {
    description: "Basic end-to-end test of the single-query workflow",
    supports: {
      mock: true,
      realApi: false,
    },
    covers: ["basic", "end-to-end"],
    metrics: ["timing"],
    notes: "Focuses on correct sequence of operations",
  },

  "unit/workflows/claude-chart-generation.vitest.js": {
    description: "Tests chart generation functionality",
    supports: {
      mock: true,
      realApi: false,
    },
    covers: ["visualization", "plotly-charts"],
    metrics: ["timing"],
    notes: "Focuses specifically on chart generation capabilities",
  },

  "unit/workflows/enhanced-single-query-workflow.vitest.js": {
    description: "Enhanced workflow test with comprehensive coverage",
    supports: {
      mock: true,
      realApi: false,
    },
    covers: ["basic", "end-to-end", "error-handling"],
    metrics: ["timing", "reliability"],
    notes: "Extends the basic workflow test with additional coverage",
  },

  "unit/workflows/perplexity-deep-research.vitest.js": {
    description: "Tests the deep research component of the workflow",
    supports: {
      mock: true, 
      realApi: false,
    },
    covers: ["deep-research", "follow-up-questions"],
    metrics: ["timing"],
    notes: "Focuses specifically on deep research capabilities",
  },

  // Manual test scripts
  "manual/test-single-query-workflow.js": {
    description: "CLI interface for manual workflow testing",
    supports: {
      mock: true,
      realApi: true,
    },
    covers: ["basic", "performance", "reliability", "noDeepResearch", "charts"],
    metrics: ["timing", "api-calls", "token-usage"],
    notes: "Most flexible test with command-line options",
  },

  "manual/testDeepResearch.js": {
    description: "Tests for deep research functionality",
    supports: {
      mock: false,
      realApi: true,
    },
    covers: ["deep-research"],
    metrics: ["research-quality"],
    notes: "Only works with real APIs",
  },

  // Other related tests
  "manual/test-plotly-integration.js": {
    description: "Tests Plotly chart integration",
    supports: {
      mock: true,
      realApi: true,
    },
    covers: ["visualization"],
    metrics: ["chart-quality"],
    notes: "Focuses on visualization generation",
  },
};

// Identify gaps in test coverage
const COVERAGE_GAPS = {
  "error-handling": {
    description: "Tests for specific error conditions in the workflow",
    recommendation: "Enhance test-runner.js to inject specific errors and verify recovery",
    priority: "high",
  },
  "performance-benchmarking": {
    description: "Detailed performance benchmarking across different configurations",
    recommendation: "Extend metrics-collector.js to capture more detailed performance metrics",
    priority: "medium",
  },
  "long-running-reliability": {
    description: "Tests for workflow reliability over many runs",
    recommendation: "Create a specialized test mode in test-runner.js for repeated execution",
    priority: "medium",
  },
  "cross-service-recovery": {
    description: "Tests for recovery when one service fails but others continue",
    recommendation: "Add partial failure scenarios to test-config.js",
    priority: "high",
  },
};

module.exports = {
  TEST_REGISTRY,
  COVERAGE_GAPS
};
