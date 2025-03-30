/**
 * Test Cost Optimization Utilities
 * 
 * This module provides utilities specifically designed to minimize API costs
 * during testing by implementing advanced mocking, caching, and cost tracking.
 */

import costOptimizer from '../../utils/costOptimizer.js';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../utils/logger.js';

// Store test session costs
const testSessionCosts = {
  savedApiCalls: 0,
  estimatedSavings: 0,
  actualApiCalls: 0,
  actualCosts: 0,
  byTest: {},
  byService: {
    anthropic: {
      calls: 0,
      cost: 0
    },
    perplexity: {
      calls: 0,
      cost: 0
    }
  }
};

/**
 * Initialize cost-optimized testing environment
 * 
 * @param {Object} options - Configuration options
 * @returns {Promise<void>}
 */
export async function initializeCostOptimizedTesting(options = {}) {
  try {
    // Configure cost optimizer for testing
    costOptimizer.configure({
      enableCaching: true,
      enablePromptOptimization: true,
      enableModelTiering: true,
      testMode: true,
      ...options
    });
    
    // Create directories if needed
    const mockDir = path.join(process.cwd(), 'tests/fixtures/mock-responses');
    await fs.mkdir(mockDir, { recursive: true });
    
    logger.info('Cost-optimized testing environment initialized', {
      mockResponseDir: mockDir,
      testMode: true
    });
    
    // Reset test session costs
    resetTestSessionCosts();
    
  } catch (error) {
    logger.error('Error initializing cost-optimized testing', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Reset test session cost tracking
 */
export function resetTestSessionCosts() {
  testSessionCosts.savedApiCalls = 0;
  testSessionCosts.estimatedSavings = 0;
  testSessionCosts.actualApiCalls = 0;
  testSessionCosts.actualCosts = 0;
  testSessionCosts.byTest = {};
  testSessionCosts.byService = {
    anthropic: {
      calls: 0,
      cost: 0
    },
    perplexity: {
      calls: 0,
      cost: 0
    }
  };
}

/**
 * Record test API usage
 * 
 * @param {Object} usage - API usage details
 * @param {string} usage.service - Service name (anthropic, perplexity)
 * @param {string} usage.model - Model name
 * @param {number} usage.cost - Cost of the API call
 * @param {boolean} usage.cached - Whether the response was cached
 * @param {boolean} usage.mocked - Whether the response was mocked
 * @param {string} usage.testName - Name of the test
 */
export function recordTestApiUsage(usage) {
  const {
    service,
    model,
    cost = 0,
    cached = false,
    mocked = false,
    testName = 'unknown-test'
  } = usage;
  
  // Track by test
  if (!testSessionCosts.byTest[testName]) {
    testSessionCosts.byTest[testName] = {
      calls: 0,
      cachedCalls: 0,
      mockedCalls: 0,
      actualCalls: 0,
      estimatedCost: 0,
      actualCost: 0,
      savedCost: 0
    };
  }
  
  testSessionCosts.byTest[testName].calls++;
  
  // Track actual API calls vs saved calls
  if (cached || mocked) {
    testSessionCosts.savedApiCalls++;
    testSessionCosts.estimatedSavings += cost;
    
    if (cached) {
      testSessionCosts.byTest[testName].cachedCalls++;
    }
    
    if (mocked) {
      testSessionCosts.byTest[testName].mockedCalls++;
    }
    
    testSessionCosts.byTest[testName].savedCost += cost;
    testSessionCosts.byTest[testName].estimatedCost += cost;
  } else {
    testSessionCosts.actualApiCalls++;
    testSessionCosts.actualCosts += cost;
    
    testSessionCosts.byTest[testName].actualCalls++;
    testSessionCosts.byTest[testName].actualCost += cost;
  }
  
  // Track by service
  if (service && testSessionCosts.byService[service]) {
    if (!cached && !mocked) {
      testSessionCosts.byService[service].calls++;
      testSessionCosts.byService[service].cost += cost;
    }
  }
}

/**
 * Get test session cost metrics
 * 
 * @returns {Object} Test session cost metrics
 */
export function getTestSessionCostMetrics() {
  // Calculate totals and percentages
  const totalCalls = testSessionCosts.savedApiCalls + testSessionCosts.actualApiCalls;
  const totalPotentialCost = testSessionCosts.estimatedSavings + testSessionCosts.actualCosts;
  
  const costSavingsPercent = totalPotentialCost > 0
    ? (testSessionCosts.estimatedSavings / totalPotentialCost) * 100
    : 0;
  
  const callSavingsPercent = totalCalls > 0
    ? (testSessionCosts.savedApiCalls / totalCalls) * 100
    : 0;
  
  // Add metrics to the basic stats
  return {
    ...testSessionCosts,
    metrics: {
      totalCalls,
      totalPotentialCost,
      costSavingsPercent,
      callSavingsPercent,
      averageCostPerCall: totalCalls > 0
        ? totalPotentialCost / totalCalls
        : 0,
      averageActualCostPerCall: testSessionCosts.actualApiCalls > 0
        ? testSessionCosts.actualCosts / testSessionCosts.actualApiCalls
        : 0
    }
  };
}

/**
 * Configure test to minimize API costs
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.recordMockResponses - Whether to record mock responses
 * @param {boolean} options.useRealApis - Whether to use real APIs when needed
 * @param {string} options.testName - Name of the test for cost tracking
 * @returns {Object} Test context
 */
export function setupCostOptimizedTest(options = {}) {
  const {
    recordMockResponses = false,
    useRealApis = false,
    testName = 'unnamed-test'
  } = options;
  
  // Set environment variable for mock response recording
  if (recordMockResponses) {
    process.env.SAVE_MOCK_RESPONSES = 'true';
  }
  
  // Configure test mode based on options
  costOptimizer.configure({
    testMode: !useRealApis
  });
  
  // Return test context for use in tests
  return {
    testName,
    recordApiUsage: (usage) => recordTestApiUsage({
      ...usage,
      testName
    }),
    // Get test-specific metrics
    getMetrics: () => {
      const testMetrics = testSessionCosts.byTest[testName] || {
        calls: 0,
        cachedCalls: 0,
        mockedCalls: 0,
        actualCalls: 0,
        estimatedCost: 0,
        actualCost: 0,
        savedCost: 0
      };
      
      return {
        ...testMetrics,
        savingsPercent: testMetrics.estimatedCost > 0
          ? (testMetrics.savedCost / testMetrics.estimatedCost) * 100
          : 0
      };
    },
    // Cleanup function to call at the end of the test
    cleanup: () => {
      if (recordMockResponses) {
        process.env.SAVE_MOCK_RESPONSES = 'false';
      }
    }
  };
}

/**
 * Create a mock response for testing
 * 
 * @param {string} service - Service name (anthropic, perplexity)
 * @param {string} operation - Operation type
 * @param {Object} response - The mock response
 * @returns {Promise<void>}
 */
export async function createMockResponse(service, operation, response) {
  try {
    await costOptimizer.saveMockResponse(service, operation, response);
    
    logger.debug('Created mock response', {
      service,
      operation,
      responseType: typeof response
    });
  } catch (error) {
    logger.error('Error creating mock response', {
      error: error.message,
      service,
      operation
    });
    throw error;
  }
}

/**
 * Generate a test report for cost optimization
 * 
 * @returns {string} Markdown test report
 */
export function generateCostOptimizationReport() {
  const metrics = getTestSessionCostMetrics();
  
  const testsSorted = Object.entries(metrics.byTest)
    .sort((a, b) => b[1].estimatedCost - a[1].estimatedCost);
  
  let report = `# Test Cost Optimization Report\n\n`;
  
  report += `## Summary\n\n`;
  report += `- Total API calls: ${metrics.metrics.totalCalls}\n`;
  report += `- Calls saved: ${metrics.savedApiCalls} (${metrics.metrics.callSavingsPercent.toFixed(1)}%)\n`;
  report += `- Actual API calls: ${metrics.actualApiCalls}\n`;
  report += `- Estimated cost savings: $${metrics.estimatedSavings.toFixed(4)}\n`;
  report += `- Actual API costs: $${metrics.actualCosts.toFixed(4)}\n`;
  report += `- Total potential cost: $${metrics.metrics.totalPotentialCost.toFixed(4)}\n`;
  report += `- Cost savings: ${metrics.metrics.costSavingsPercent.toFixed(1)}%\n\n`;
  
  report += `## Cost by Service\n\n`;
  report += `| Service | API Calls | Cost |\n`;
  report += `| ------- | --------- | ---- |\n`;
  for (const [service, data] of Object.entries(metrics.byService)) {
    report += `| ${service} | ${data.calls} | $${data.cost.toFixed(4)} |\n`;
  }
  
  report += `\n## Cost by Test\n\n`;
  report += `| Test | Total Calls | Cached | Mocked | Actual | Savings |\n`;
  report += `| ---- | ----------- | ------ | ------ | ------ | ------- |\n`;
  
  for (const [testName, data] of testsSorted) {
    const savingsPercent = data.estimatedCost > 0
      ? (data.savedCost / data.estimatedCost) * 100
      : 0;
    
    report += `| ${testName} | ${data.calls} | ${data.cachedCalls} | ${data.mockedCalls} | ${data.actualCalls} | ${savingsPercent.toFixed(1)}% |\n`;
  }
  
  return report;
}

/**
 * Save test cost optimization report to file
 * 
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} File path
 */
export async function saveTestCostReport(outputPath = 'test-cost-report.md') {
  try {
    const report = generateCostOptimizationReport();
    const filePath = path.join(process.cwd(), outputPath);
    
    await fs.writeFile(filePath, report, 'utf8');
    
    logger.info('Test cost report saved', { filePath });
    
    return filePath;
  } catch (error) {
    logger.error('Error saving test cost report', {
      error: error.message,
      outputPath
    });
    throw error;
  }
}