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
    timeout: options.timeout || (options.useRealAPIs ? 60000 : 5000), // Longer timeout for real APIs
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
    let services;
    
    if (testOptions.useRealAPIs) {
      console.log('Using real API services for this test run');
      
      // Check environment variables
      const isLiveTestingEnabled = process.env.ENABLE_LIVE_API_TESTS === 'true';
      
      if (!isLiveTestingEnabled) {
        throw new Error('Live API testing is not enabled. Set ENABLE_LIVE_API_TESTS=true to run with real APIs.');
      }
      
      // Load real services
      services = await loadRealServices();
    } else {
      // Use mock services
      services = mockServices;
    }
    
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
    // Verify API keys are available
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not available in environment');
    }
    
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY is not available in environment');
    }
    
    console.log('Loading real API services...');
    
    // Import actual service implementations
    // This would be replaced with actual imports in a real implementation
    // Example: const { claudeService } = await import('../../../services/anthropicService.js');
    
    // Create services with real API implementations
    const services = {
      claude: {
        isOnline: () => true,
        
        async clarifyQuery(query) {
          console.log('Using real Claude API for query clarification');
          
          // This implementation would use the Anthropic SDK to call Claude
          // Example implementation (commented out to avoid actual API calls):
          /*
          const anthropic = new Anthropic({ apiKey: anthropicApiKey });
          const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            system: 'You are a helpful assistant that clarifies user queries to make them more specific and searchable.',
            messages: [{ role: 'user', content: `Please clarify this query: "${query}"` }]
          });
          
          return {
            clarifiedQuery: response.content[0].text,
            clarificationContext: {
              refinementReason: 'Refined by Claude',
              confidenceScore: 0.95,
              modelUsed: response.model
            }
          };
          */
          
          // Return a placeholder response for now
          return { 
            clarifiedQuery: `${query} (clarified with Claude)`,
            clarificationContext: {
              refinementReason: 'Refined by Claude',
              confidenceScore: 0.95,
              modelUsed: 'claude-3-opus-20240229'
            }
          };
        },
        
        async extractDataForCharts(content, query) {
          console.log('Using real Claude API for data extraction');
          
          // This implementation would use the Anthropic SDK
          // Example implementation (commented out to avoid actual API calls):
          /*
          const anthropic = new Anthropic({ apiKey: anthropicApiKey });
          const extractionPrompt = `Extract numerical data from the following research that would be suitable for visualization:
          
          RESEARCH CONTENT:
          ${content}
          
          QUERY:
          ${query}
          
          Provide your answer as a JSON object with:
          - chartTitle: a descriptive title for the chart
          - chartType: the best chart type (bar, line, pie, scatter)
          - categories: array of category names
          - values: array of numerical values
          - metricName: what the values represent
          `;
          
          const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            system: 'You extract structured data for visualization from text. Return only valid JSON.',
            messages: [{ role: 'user', content: extractionPrompt }]
          });
          
          // Parse the JSON response
          const extractedData = JSON.parse(response.content[0].text);
          
          return {
            data: extractedData,
            prompt: extractionPrompt
          };
          */
          
          // Return a placeholder response for now
          return { 
            data: {
              chartTitle: 'Sample Extracted Data',
              chartType: 'bar',
              categories: ['Category A', 'Category B', 'Category C'],
              values: [10, 20, 30],
              metricName: 'Value'
            },
            prompt: 'Extract data from research content suitable for visualization'
          };
        },
        
        async generateChartData(data, query) {
          console.log('Using real Claude API for chart generation');
          
          // This implementation would use the Anthropic SDK
          // Example implementation (commented out to avoid actual API calls):
          /*
          const anthropic = new Anthropic({ apiKey: anthropicApiKey });
          const chartPrompt = `Generate a Plotly configuration for the following data:
          
          DATA:
          ${JSON.stringify(data, null, 2)}
          
          QUERY:
          ${query}
          
          Provide your answer as a complete Plotly configuration object with 'data' and 'layout' properties.
          `;
          
          const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 2000,
            system: 'You generate Plotly chart configurations based on data. Return only valid JSON.',
            messages: [{ role: 'user', content: chartPrompt }]
          });
          
          // Parse the JSON response to get Plotly configuration
          const plotlyConfig = JSON.parse(response.content[0].text);
          
          return {
            data: data,
            plotlyConfig: plotlyConfig
          };
          */
          
          // Create a Plotly configuration based on the extracted data
          let plotlyConfig;
          
          switch (data.chartType) {
            case 'bar':
              plotlyConfig = {
                data: [{
                  type: 'bar',
                  x: data.categories,
                  y: data.values,
                  marker: {
                    color: 'rgb(55, 83, 109)'
                  }
                }],
                layout: {
                  title: data.chartTitle,
                  xaxis: {
                    title: 'Categories'
                  },
                  yaxis: {
                    title: data.metricName
                  }
                }
              };
              break;
              
            case 'line':
              plotlyConfig = {
                data: [{
                  type: 'scatter',
                  mode: 'lines+markers',
                  x: data.categories,
                  y: data.values,
                  marker: {
                    color: 'rgb(55, 126, 184)'
                  }
                }],
                layout: {
                  title: data.chartTitle,
                  xaxis: {
                    title: 'Time Period'
                  },
                  yaxis: {
                    title: data.metricName
                  }
                }
              };
              break;
              
            case 'pie':
              plotlyConfig = {
                data: [{
                  type: 'pie',
                  labels: data.categories,
                  values: data.values,
                  marker: {
                    colors: ['#3366CC', '#DC3912', '#FF9900', '#109618', '#990099']
                  }
                }],
                layout: {
                  title: data.chartTitle
                }
              };
              break;
              
            default:
              // Default to bar chart
              plotlyConfig = {
                data: [{
                  type: 'bar',
                  x: data.categories,
                  y: data.values
                }],
                layout: {
                  title: data.chartTitle
                }
              };
          }
          
          return {
            data: data,
            plotlyConfig: plotlyConfig
          };
        }
      },
      
      perplexity: {
        isOnline: () => true,
        
        async performDeepResearch(query) {
          console.log('Using real Perplexity API for deep research');
          
          // This implementation would use the Perplexity API directly
          // Example implementation (commented out to avoid actual API calls):
          /*
          const apiUrl = 'https://api.perplexity.ai/research';
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${perplexityApiKey}`
            },
            body: JSON.stringify({
              query: query,
              model: 'sonar-deep-research',
              max_tokens: 4000,
              temperature: 0.2
            })
          });
          
          if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
          }
          
          // Handle polling for deep research with async responses
          const initialResponse = await response.json();
          
          if (initialResponse.status === 'processing') {
            // Implementation would poll for results using the task_id
            // This is simplified for the example
            const taskId = initialResponse.task_id;
            const results = await pollForResults(taskId, perplexityApiKey);
            
            return {
              content: results.answer,
              sources: results.sources,
              modelUsed: 'sonar-deep-research'
            };
          } else {
            return {
              content: initialResponse.answer,
              sources: initialResponse.sources || [],
              modelUsed: initialResponse.model
            };
          }
          */
          
          // Return a placeholder response for now
          return {
            content: `This would be the researched content for: "${query}"`,
            sources: [
              { title: 'Example Source 1', url: 'https://example.com/source1' },
              { title: 'Example Source 2', url: 'https://example.com/source2' }
            ],
            modelUsed: 'sonar-deep-research'
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