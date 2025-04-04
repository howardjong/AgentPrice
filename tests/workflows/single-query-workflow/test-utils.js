/**
 * Test utilities for the single query workflow tests
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { vi } from 'vitest';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define test data and fixtures
const testDataDir = path.join(__dirname, 'fixtures');
const testResultsDir = path.join(process.cwd(), 'test-results', 'single-query-workflow');
let fixtures = {
  queries: [],
  expectedResponses: {}
};

/**
 * Load test fixtures from files
 */
export async function loadFixtures() {
  try {
    // Ensure test results directory exists
    await fs.mkdir(testResultsDir, { recursive: true }).catch(() => {});
    
    // Load query fixtures
    const queriesPath = path.join(testDataDir, 'test-queries.json');
    const queriesData = await fs.readFile(queriesPath, 'utf8');
    fixtures.queries = JSON.parse(queriesData);
    
    // Load expected responses
    const responsesPath = path.join(testDataDir, 'expected-responses.json');
    const responsesData = await fs.readFile(responsesPath, 'utf8');
    fixtures.expectedResponses = JSON.parse(responsesData);
    
    return true;
  } catch (error) {
    console.error('Error loading fixtures:', error);
    return false;
  }
}

/**
 * Run a test based on the given variant and options
 * @param {string} variant - Test variant to run
 * @param {object} options - Test options
 * @returns {object} Test results
 */
export async function runAndValidateTest(variant, options = {}) {
  const { runTest } = await import('./test-runner.js');
  
  // Set default options
  const testOptions = {
    query: options.query || selectQueryForVariant(variant),
    useRealAPIs: options.useRealAPIs || false,
    saveResults: options.saveResults || false,
    ...options
  };
  
  console.log(`Running test with query: "${testOptions.query}"`);
  
  // Capture start time
  const startTime = Date.now();
  
  // Run the test
  const results = await runTest(testOptions);
  
  // Calculate test duration
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Add metrics to results
  results.metrics = {
    test: {
      duration,
      startTime,
      endTime
    },
    stages: {}
  };
  
  // Add stage metrics if available
  if (results.stageTiming) {
    for (const [stage, timing] of Object.entries(results.stageTiming)) {
      results.metrics.stages[stage] = {
        duration: timing.end - timing.start,
        startTime: timing.start,
        endTime: timing.end
      };
    }
  }
  
  // Validate the results
  const validation = validateResults(results, variant);
  results.validation = validation;
  
  // Save results if requested
  if (testOptions.saveResults) {
    await saveTestResults(results, variant);
  }
  
  return results;
}

/**
 * Select an appropriate test query for the given variant
 * @param {string} variant - Test variant
 * @returns {string} The selected query
 */
function selectQueryForVariant(variant) {
  if (!fixtures.queries || fixtures.queries.length === 0) {
    return "What are the latest advancements in renewable energy storage?";
  }
  
  // If the TEST_QUERY environment variable is set, use that
  if (process.env.TEST_QUERY) {
    return process.env.TEST_QUERY;
  }
  
  // Otherwise select a query based on the variant
  switch (variant) {
    case 'basic':
      return fixtures.queries[0] || "What are the latest advancements in renewable energy storage?";
    case 'performance':
      return fixtures.queries[1] || "Explain the concept of quantum computing in simple terms";
    case 'reliability':
      return fixtures.queries[2] || "What are the economic impacts of AI on employment?";
    case 'errorHandling':
      return fixtures.queries[3] || "What are the primary factors affecting climate change?";
    default:
      // Select a random query
      const randomIndex = Math.floor(Math.random() * fixtures.queries.length);
      return fixtures.queries[randomIndex] || "What are the latest breakthroughs in AI research?";
  }
}

/**
 * Validate test results against expected outputs
 * @param {object} results - Test results
 * @param {string} variant - Test variant
 * @returns {object} Validation results
 */
function validateResults(results, variant) {
  const validation = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Check if test succeeded
  if (!results.success) {
    validation.valid = false;
    validation.errors.push(`Test failed: ${results.error}`);
    return validation;
  }
  
  // Basic validations for all tests
  if (!results.researchContent || typeof results.researchContent !== 'string') {
    validation.valid = false;
    validation.errors.push('Missing or invalid research content');
  } else if (results.researchContent.length < 100) {
    validation.warnings.push('Research content is suspiciously short');
  }
  
  if (!results.chartData || typeof results.chartData !== 'object') {
    validation.valid = false;
    validation.errors.push('Missing or invalid chart data');
  }
  
  if (!results.plotlyConfig || typeof results.plotlyConfig !== 'object') {
    validation.valid = false;
    validation.errors.push('Missing or invalid Plotly configuration');
  }
  
  // Check sources if available
  if (!results.sources || !Array.isArray(results.sources) || results.sources.length === 0) {
    validation.warnings.push('Missing or empty sources');
  }
  
  // Expected responses validation (if available for this variant)
  const expectedResponse = fixtures.expectedResponses[variant];
  if (expectedResponse) {
    // Check for expected content patterns
    if (expectedResponse.contentPatterns) {
      for (const pattern of expectedResponse.contentPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (!regex.test(results.researchContent)) {
          validation.warnings.push(`Expected content pattern not found: "${pattern}"`);
        }
      }
    }
    
    // Check for chart type match
    if (expectedResponse.chartType && results.plotlyConfig.data && results.plotlyConfig.data[0]) {
      const chartType = results.plotlyConfig.data[0].type;
      if (chartType !== expectedResponse.chartType) {
        validation.warnings.push(`Chart type mismatch: expected "${expectedResponse.chartType}", got "${chartType}"`);
      }
    }
  }
  
  return validation;
}

/**
 * Save test results to file
 * @param {object} results - Test results
 * @param {string} variant - Test variant
 */
export async function saveTestResults(results, variant) {
  try {
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const resultsFile = path.join(testResultsDir, `${variant}-${timestamp}.json`);
    
    await fs.writeFile(
      resultsFile,
      JSON.stringify(results, null, 2)
    );
    
    console.log(`Results saved to ${resultsFile}`);
    return true;
  } catch (error) {
    console.error('Error saving test results:', error);
    return false;
  }
}

/**
 * Format validation results for display
 * @param {object} validation - Validation results
 * @returns {string} Formatted results
 */
export function formatValidationResults(validation) {
  if (!validation) return 'No validation data available';
  
  let output = `Validation ${validation.valid ? 'PASSED' : 'FAILED'}\n`;
  
  if (validation.errors.length > 0) {
    output += '\nErrors:\n';
    validation.errors.forEach(err => {
      output += `- ${err}\n`;
    });
  }
  
  if (validation.warnings.length > 0) {
    output += '\nWarnings:\n';
    validation.warnings.forEach(warn => {
      output += `- ${warn}\n`;
    });
  }
  
  return output;
}

/**
 * Validate chart data structure
 * @param {object} chartData - Chart data to validate
 * @returns {object} Validation results
 */
export function validateChartData(chartData) {
  const validation = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  if (!chartData) {
    validation.valid = false;
    validation.errors.push('Chart data is null or undefined');
    return validation;
  }
  
  if (typeof chartData !== 'object') {
    validation.valid = false;
    validation.errors.push(`Chart data is not an object, got: ${typeof chartData}`);
    return validation;
  }
  
  // Validate Plotly config structure
  if (!chartData.data || !Array.isArray(chartData.data)) {
    validation.valid = false;
    validation.errors.push('Chart data is missing "data" array property');
  } else if (chartData.data.length === 0) {
    validation.warnings.push('Chart data array is empty');
  } else {
    // Check the first trace
    const firstTrace = chartData.data[0];
    if (!firstTrace.type) {
      validation.warnings.push('Chart trace is missing "type" property');
    }
    
    // Check for common trace properties based on type
    if (firstTrace.type === 'bar' || firstTrace.type === 'scatter') {
      if (!firstTrace.x || !Array.isArray(firstTrace.x)) {
        validation.warnings.push(`Chart ${firstTrace.type} trace is missing "x" array`);
      }
      if (!firstTrace.y || !Array.isArray(firstTrace.y)) {
        validation.warnings.push(`Chart ${firstTrace.type} trace is missing "y" array`);
      }
    } else if (firstTrace.type === 'pie') {
      if (!firstTrace.values || !Array.isArray(firstTrace.values)) {
        validation.warnings.push('Chart pie trace is missing "values" array');
      }
      if (!firstTrace.labels || !Array.isArray(firstTrace.labels)) {
        validation.warnings.push('Chart pie trace is missing "labels" array');
      }
    }
  }
  
  // Check for layout
  if (!chartData.layout || typeof chartData.layout !== 'object') {
    validation.warnings.push('Chart is missing "layout" object');
  } else {
    if (!chartData.layout.title) {
      validation.warnings.push('Chart layout is missing "title"');
    }
  }
  
  return validation;
}

/**
 * Setup mocks for time-sensitive functions
 */
export function setupTimeMocks() {
  // Mock setTimeout to speed up tests
  vi.spyOn(global, 'setTimeout').mockImplementation((callback, timeout) => {
    // Call the callback immediately for tests
    if (typeof callback === 'function') {
      callback();
    }
    return 999; // Return a fake timer ID
  });
  
  // Restore the mock after tests
  return () => {
    vi.restoreAllMocks();
  };
}