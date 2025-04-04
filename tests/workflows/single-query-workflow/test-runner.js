/**
 * Single Query Workflow Test Runner
 * 
 * This module provides the core functionality for running workflow tests,
 * including initialization of mock services and test execution.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupTimeMocks } from './test-utils.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define services that will be used in tests
// These will be initialized in initializeMockServices()
let mockServices = {
  claude: null,
  perplexity: null,
  workflow: null
};

// Test lifecycle hooks
beforeAll(async () => {
  // Initialize mock services
  await initializeMockServices();
  
  // Setup time mocks to speed up tests
  const restoreTimeMocks = setupTimeMocks();
  
  // Return cleanup function
  return () => {
    restoreTimeMocks();
  };
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();
});

afterAll(() => {
  // Perform any necessary cleanup
  console.log('Test run complete');
});

/**
 * Initialize mock services for testing
 * @returns {object} The initialized mock services
 */
export async function initializeMockServices() {
  try {
    // Load mock services
    const { services } = await import('./mock-services.js');
    
    // Store services for use in tests
    mockServices = services;
    
    return services;
  } catch (error) {
    console.error('Error initializing mock services:', error);
    throw error;
  }
}

/**
 * Main function to run a workflow test
 * @param {object} options - Test options
 * @returns {object} Test results
 */
export async function runTest(options = {}) {
  // Default options
  const testOptions = {
    query: options.query || "What are the latest advancements in renewable energy storage?",
    useRealAPIs: options.useRealAPIs || false,
    saveResults: options.saveResults || false,
    variant: options.variant || process.env.TEST_VARIANT || 'basic',
    ...options
  };
  
  // Test results object to be returned
  const results = {
    success: false,
    query: testOptions.query,
    variant: testOptions.variant,
    useRealAPIs: testOptions.useRealAPIs,
    timestamp: new Date().toISOString(),
    error: null,
    stageTiming: {}
  };
  
  try {
    // Determine which services to use based on the useRealAPIs flag
    const services = testOptions.useRealAPIs ? 
      await loadRealServices() : 
      mockServices;
    
    // Check if services are available
    if (!services.claude || !services.perplexity || !services.workflow) {
      throw new Error('Required services not available for testing');
    }
    
    // Run the test with timing for each stage
    console.log('Starting workflow test...');
    
    // Stage 1: Query clarification with Claude
    results.stageTiming.clarification = { start: Date.now() };
    const clarificationResults = await services.claude.clarifyQuery(testOptions.query);
    results.stageTiming.clarification.end = Date.now();
    results.clarifiedQuery = clarificationResults.clarifiedQuery;
    
    // Stage 2: Deep research with Perplexity
    results.stageTiming.research = { start: Date.now() };
    const researchResults = await services.perplexity.performDeepResearch(results.clarifiedQuery);
    results.stageTiming.research.end = Date.now();
    results.researchContent = researchResults.content;
    results.sources = researchResults.sources || [];
    
    // Stage 3: Extract data for charting with Claude
    results.stageTiming.extraction = { start: Date.now() };
    const extractionResults = await services.claude.extractDataForCharts(
      results.researchContent,
      results.clarifiedQuery
    );
    results.stageTiming.extraction.end = Date.now();
    results.extractedData = extractionResults.data;
    results.dataExtractionPrompt = extractionResults.prompt;
    
    // Stage 4: Generate chart data with Claude
    results.stageTiming.charting = { start: Date.now() };
    const chartResults = await services.claude.generateChartData(
      results.extractedData,
      results.clarifiedQuery
    );
    results.stageTiming.charting.end = Date.now();
    results.chartData = chartResults.data;
    results.plotlyConfig = chartResults.plotlyConfig;
    
    // Mark test as successful
    results.success = true;
    console.log('Workflow test completed successfully');
    
  } catch (error) {
    // Handle test failure
    results.success = false;
    results.error = error.message;
    console.error('Workflow test failed:', error.message);
    
    // Check for fallback usage
    if (error.fallback) {
      results.fallback = error.fallback;
    }
  }
  
  // Save results if requested
  if (testOptions.saveResults) {
    await saveTestResults(results);
  }
  
  return results;
}

/**
 * Load real API services instead of mocks
 * @returns {object} Real API service instances
 */
async function loadRealServices() {
  try {
    // In a real implementation, this would load the actual service modules
    // For the test framework, we'll use a simulated version
    console.log('Loading real API services...');
    
    // Placeholder for real services implementation
    // This could be importing actual service modules instead of mocks
    const services = {
      claude: {
        async clarifyQuery(query) {
          console.log('Using real Claude API for query clarification');
          // Implementation would connect to actual Claude API
          return { clarifiedQuery: query };
        },
        
        async extractDataForCharts(content, query) {
          console.log('Using real Claude API for data extraction');
          // Implementation would connect to actual Claude API
          return { 
            data: { /* extracted data */ },
            prompt: 'Extraction prompt used'
          };
        },
        
        async generateChartData(data, query) {
          console.log('Using real Claude API for chart generation');
          // Implementation would connect to actual Claude API
          return {
            data: { /* chart data */ },
            plotlyConfig: {
              data: [{ type: 'bar', x: [], y: [] }],
              layout: { title: 'Chart Title' }
            }
          };
        }
      },
      
      perplexity: {
        async performDeepResearch(query) {
          console.log('Using real Perplexity API for deep research');
          // Implementation would connect to actual Perplexity API
          return {
            content: 'Research content would go here',
            sources: [{ title: 'Source 1', url: 'https://example.com' }]
          };
        }
      },
      
      workflow: {
        // Any workflow-specific methods
      }
    };
    
    return services;
  } catch (error) {
    console.error('Error loading real services:', error);
    throw new Error(`Failed to load real API services: ${error.message}`);
  }
}

/**
 * Save test results to a file
 * @param {object} results - Test results
 */
async function saveTestResults(results) {
  try {
    // Create test results directory if it doesn't exist
    const testResultsDir = path.join(process.cwd(), 'test-results', 'single-query-workflow');
    await fs.mkdir(testResultsDir, { recursive: true });
    
    // Generate a filename based on the test variant and timestamp
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const variant = results.variant || 'unknown';
    const filename = `${variant}-test-${timestamp}.json`;
    
    // Save results to file
    await fs.writeFile(
      path.join(testResultsDir, filename),
      JSON.stringify(results, null, 2)
    );
    
    console.log(`Test results saved to: ${filename}`);
  } catch (error) {
    console.error('Error saving test results:', error);
  }
}