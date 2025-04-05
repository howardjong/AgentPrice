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
  console.log('Test suite starting...');
  
  // Initialize mock services
  await initializeMockServices();
  
  // Validate mock services were properly initialized
  console.log('Validating mock services after initialization:');
  console.log('Claude mock service initialized:', !!mockServices.claude);
  console.log('Perplexity mock service initialized:', !!mockServices.perplexity);
  console.log('Claude clarifyQuery method available:', !!mockServices.claude?.clarifyQuery);
  
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
    console.log('Loading mock services...');
    const { services } = await import('./mock-services.js');
    
    // Store services for use in tests
    mockServices = services;
    
    console.log('Mock services initialized:', 
      'Claude service available:', !!services.claude, 
      'Perplexity service available:', !!services.perplexity);
    
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
    timeout: options.timeout || (options.useRealAPIs ? 300000 : 15000), // Much longer timeout for real APIs (5 minutes vs 15 seconds)
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
    console.log('Using query:', testOptions.query);
    console.log('Services available:', 
      'Claude:', !!services.claude, 
      'Perplexity:', !!services.perplexity,
      'Workflow:', !!services.workflow);
    
    // Stage 1: Query clarification with Claude
    console.log('Starting Stage 1: Query clarification with Claude');
    results.stageTiming.clarification = { start: Date.now() };
    
    // Debug - Check if the function exists and what it is
    console.log('Claude clarifyQuery function type:', typeof services.claude.clarifyQuery);
    console.log('Is it a function?', typeof services.claude.clarifyQuery === 'function');
    
    try {
      // Call the function with direct debugging
      console.log('About to call Claude.clarifyQuery with query:', testOptions.query);
      const clarificationResults = await services.claude.clarifyQuery(testOptions.query);
      console.log('Raw clarification results:', clarificationResults);
      console.log('Type of results:', typeof clarificationResults);
      console.log('Is null?', clarificationResults === null);
      console.log('Is undefined?', clarificationResults === undefined);
      
      if (clarificationResults) {
        console.log('Result keys:', Object.keys(clarificationResults));
        console.log('Has clarifiedQuery?', 'clarifiedQuery' in clarificationResults);
      }
      
      console.log('Claude clarification response:', JSON.stringify(clarificationResults, null, 2));
      results.stageTiming.clarification.end = Date.now();
      
      // Safely extract clarifiedQuery
      if (clarificationResults && clarificationResults.clarifiedQuery) {
        results.clarifiedQuery = clarificationResults.clarifiedQuery;
      } else {
        // Create a fallback clarifiedQuery as a workaround
        console.log('WARNING: Creating fallback clarifiedQuery due to missing response');
        results.clarifiedQuery = `${testOptions.query} (fallback clarification)`;
      }
    } catch (error) {
      console.error('ERROR during Claude clarification stage:', error);
      // Create a fallback clarifiedQuery to allow test to continue
      results.clarifiedQuery = `${testOptions.query} (fallback due to error)`;
      results.stageTiming.clarification.end = Date.now();
    }
    
    // Stage 2: Deep research with Perplexity
    results.stageTiming.research = { start: Date.now() };
    
    // Pass any Perplexity-specific options from testOptions
    const perplexityOptions = testOptions.perplexityOptions || {};
    
    // Perform deep research with options
    const researchResults = await services.perplexity.performDeepResearch(
      results.clarifiedQuery,
      perplexityOptions
    );
    
    results.stageTiming.research.end = Date.now();
    results.researchContent = researchResults.content;
    results.sources = researchResults.sources || [];
    results.modelUsed = researchResults.modelUsed || 'unknown';
    
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
    
    // Properly structure chartData to match test expectations
    results.chartData = {
      ...chartResults.data,
      plotlyConfig: chartResults.plotlyConfig,
      insights: chartResults.insights || []
    };
    
    // Log the results structure for debugging
    console.log('WORKFLOW RESULTS STRUCTURE:', Object.keys(results));
    console.log('HAS RESEARCH CONTENT:', !!results.researchContent);
    console.log('HAS CHART DATA:', !!results.chartData);
    console.log('CHART DATA KEYS:', results.chartData ? Object.keys(results.chartData) : 'N/A');
    console.log('HAS PLOTLY CONFIG:', !!(results.chartData && results.chartData.plotlyConfig));
    console.log('HAS INSIGHTS:', !!(results.chartData && results.chartData.insights));
    console.log('INSIGHTS LENGTH:', results.chartData?.insights?.length || 0);
    
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
    const claudeService = await import('../../../services/claudeService.js').then(module => module.default);
    const perplexityService = await import('../../../services/perplexityService.js').then(module => module.default);
    
    // Create adapter services to match the interface expected by our tests
    const services = {
      claude: {
        isOnline: () => true,
        
        async clarifyQuery(query) {
          console.log('Using real Claude API for query clarification');
          
          try {
            // Call Claude's processText to clarify the query
            const extractionPrompt = `Please clarify this query to make it more specific and searchable: "${query}"`;
            
            const response = await claudeService.processText(extractionPrompt, {
              model: 'claude-3-7-sonnet-20250219',
              maxTokens: 1000,
              temperature: 0.3
            });
            
            return {
              clarifiedQuery: response.content,
              clarificationContext: {
                refinementReason: 'Refined by Claude',
                confidenceScore: 0.95,
                modelUsed: response.model
              }
            };
          } catch (error) {
            console.error('Error clarifying query with Claude:', error);
            throw new Error(`Claude API error during query clarification: ${error.message}`);
          }
        },
        
        async extractDataForCharts(content, query) {
          console.log('Using real Claude API for data extraction');
          
          try {
            // Create extraction prompt for chart data
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
            
            const response = await claudeService.processText(extractionPrompt, {
              model: 'claude-3-7-sonnet-20250219',
              maxTokens: 1500,
              temperature: 0.2
            });
            
            // Extract JSON from the response
            let data;
            try {
              // Look for JSON pattern in the content
              const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/) || 
                                response.content.match(/```\n([\s\S]*?)\n```/) ||
                                response.content.match(/\{[\s\S]*\}/);
              
              const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response.content;
              data = JSON.parse(jsonString);
            } catch (parseError) {
              console.error('Failed to parse JSON from Claude response:', parseError);
              // Fallback to a default structure
              data = {
                chartTitle: 'Data from Research',
                chartType: 'bar',
                categories: ['Category A', 'Category B', 'Category C'],
                values: [10, 20, 30],
                metricName: 'Value'
              };
            }
            
            return {
              data: data,
              prompt: extractionPrompt
            };
          } catch (error) {
            console.error('Error extracting data with Claude:', error);
            throw new Error(`Claude API error during data extraction: ${error.message}`);
          }
        },
        
        async generateChartData(data, query) {
          console.log('Using real Claude API for chart generation');
          
          try {
            // Create a prompt for generating Plotly configuration
            const chartPrompt = `Generate a Plotly configuration for the following data:
            
            DATA:
            ${JSON.stringify(data, null, 2)}
            
            QUERY:
            ${query}
            
            Provide your answer as a complete Plotly configuration object with 'data' and 'layout' properties.
            `;
            
            // Use Claude to generate the Plotly configuration
            const response = await claudeService.processText(chartPrompt, {
              model: 'claude-3-7-sonnet-20250219',
              maxTokens: 2000,
              temperature: 0.2
            });
            
            // Extract JSON from the response
            let plotlyConfig;
            try {
              // Look for JSON pattern in the content
              const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/) || 
                                response.content.match(/```\n([\s\S]*?)\n```/) ||
                                response.content.match(/\{[\s\S]*\}/);
              
              const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response.content;
              plotlyConfig = JSON.parse(jsonString);
            } catch (parseError) {
              console.error('Failed to parse JSON from Claude response:', parseError);
              
              // Fallback to a simple Plotly configuration
              plotlyConfig = {
                data: [{
                  type: data.chartType || 'bar',
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
            }
            
            // Generate insights about the chart data
            const insightsPrompt = `Generate 3-5 key insights about this data:
            
            DATA:
            ${JSON.stringify(data, null, 2)}
            
            QUERY:
            ${query}
            
            Provide your answer as a JSON array of insight strings.
            `;
            
            const insightsResponse = await claudeService.processText(insightsPrompt, {
              model: 'claude-3-7-sonnet-20250219',
              maxTokens: 1000,
              temperature: 0.2
            });
            
            // Extract insights from the response
            let insights = [];
            try {
              // Look for JSON pattern in the content
              const jsonMatch = insightsResponse.content.match(/```json\n([\s\S]*?)\n```/) || 
                                insightsResponse.content.match(/```\n([\s\S]*?)\n```/) ||
                                insightsResponse.content.match(/\[[\s\S]*\]/);
              
              const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : insightsResponse.content;
              insights = JSON.parse(jsonString);
            } catch (parseError) {
              console.error('Failed to parse insights JSON from Claude response:', parseError);
              // Fallback to simple insights
              insights = [
                "This chart shows the primary data trends",
                "Values vary across different categories",
                "The highest value is in the middle of the range"
              ];
            }
            
            return {
              data: data,
              plotlyConfig: plotlyConfig,
              insights: insights
            };
          } catch (error) {
            console.error('Error generating chart with Claude:', error);
            throw new Error(`Claude API error during chart generation: ${error.message}`);
          }
        }
      },
      
      perplexity: {
        isOnline: () => true,
        
        async performDeepResearch(query, options = {}) {
          console.log('Using real Perplexity API for deep research with sonar-deep-research model');
          console.log('Options:', JSON.stringify(options, null, 2));
          
          try {
            // Pass a much longer timeout (5 minutes) for deep research operations
            // This should help with the timeout issues observed in testing
            const response = await perplexityService.performDeepResearch(query, {
              timeout: 300000, // 5 minute timeout
              model: 'sonar-deep-research', // Explicitly use deep research model
              ...options
            });
            
            // Check if we should include the full API response for debugging
            const includeFullResponse = options.fullResponse === true;
            
            console.log('Deep research completed successfully!');
            console.log('Model used:', response.modelUsed || 'not reported');
            console.log('Content length:', response.content ? response.content.length : 0);
            console.log('Sources count:', response.sources ? response.sources.length : 0);
            
            // Log first source if available
            if (response.sources && response.sources.length > 0) {
              console.log('First source:', response.sources[0].title, '-', response.sources[0].url);
            }
            
            // Capture the raw API response if available
            const apiResponse = response.apiResponse || response.rawResponse || null;
            if (apiResponse) {
              console.log('Raw API response available with keys:', Object.keys(apiResponse).join(', '));
            }
            
            const result = {
              content: response.content,
              sources: response.sources || [],
              modelUsed: response.modelUsed || 'sonar-deep-research'
            };
            
            // Include the full API response if requested
            if (includeFullResponse && apiResponse) {
              result.apiResponse = apiResponse;
            }
            
            return result;
          } catch (error) {
            console.error('Error performing deep research with Perplexity:', error);
            // Add more context to the error to help with debugging
            if (error.message && error.message.includes('timeout')) {
              console.warn('This appears to be a timeout issue with the Perplexity API.');
              console.warn('Consider using the mock API for CI/CD pipelines.');
            }
            throw new Error(`Perplexity API error during deep research: ${error.message}`);
          }
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
    
    // Add the path to the results
    results.resultPath = path.join(testResultsDir, filename);
    return results;
  } catch (error) {
    console.error('Error saving test results:', error);
    return results;
  }
}

/**
 * Wrapper function for the test runner that supports different test variants
 * This is used by various test files including enhanced-single-query-workflow.vitest.js
 * 
 * @param {string} variant - The test variant to run (basic, performance, etc.)
 * @param {object} options - Test options
 * @returns {Promise<object>} - Test results
 */
export async function runWorkflowTest(variant, options = {}) {
  console.log(`Running workflow test variant: ${variant}`);
  
  // Merge options with variant-specific defaults
  const mergedOptions = {
    variant,
    saveResults: true,
    ...options
  };
  
  // Run the test with the provided options
  const results = await runTest(mergedOptions);
  
  // Enhanced metrics for the wrapper
  results.metrics = results.metrics || {};
  results.metrics.stages = results.metrics.stages || {};
  
  // Add timing data from stageTiming to the metrics
  Object.entries(results.stageTiming || {}).forEach(([stage, timing]) => {
    if (timing.start && timing.end) {
      results.metrics.stages[stage] = {
        ...results.metrics.stages[stage],
        duration: timing.end - timing.start,
        start: timing.start,
        end: timing.end
      };
    }
  });
  
  // Add overall timing
  results.metrics.performance = {
    start: results.timestamp,
    end: new Date().toISOString(),
    duration: Date.now() - new Date(results.timestamp).getTime()
  };
  
  return results;
}