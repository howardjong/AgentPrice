/**
 * Mock Services for Single Query Workflow Tests
 * 
 * This module provides mock implementations of Claude and Perplexity services
 * for testing the single-query workflow without making actual API calls.
 */

import { vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock data storage
let mockData = {
  queries: {},
  clarifications: {},
  research: {},
  extraction: {},
  charts: {}
};

// Service mock implementations
export const services = {
  claude: {
    isOnline: vi.fn().mockReturnValue(true),
    
    clarifyQuery: vi.fn().mockImplementation(async (query) => {
      console.log('Mock Claude: Clarifying query -', query);
      
      // Return predefined clarification if available
      if (mockData.clarifications[query]) {
        return mockData.clarifications[query];
      }
      
      // Default clarification
      return {
        clarifiedQuery: `${query} (with focus on recent developments and practical applications)`,
        clarificationContext: {
          refinementReason: 'Added specificity and timeframe',
          confidenceScore: 0.9,
          modelUsed: 'claude-mock'
        }
      };
    }),
    
    extractDataForCharts: vi.fn().mockImplementation(async (content, query) => {
      console.log('Mock Claude: Extracting data for charts');
      
      // Return predefined extraction if available
      const key = `${query}:${content.substring(0, 50)}`;
      if (mockData.extraction[key]) {
        return mockData.extraction[key];
      }
      
      // Default extraction
      return {
        data: {
          chartTitle: 'Sample Extracted Data',
          chartType: 'bar',
          categories: ['Category A', 'Category B', 'Category C'],
          values: [25, 40, 15],
          metricName: 'Value'
        },
        prompt: 'Extract data from research content suitable for visualization'
      };
    }),
    
    generateChartData: vi.fn().mockImplementation(async (data, query) => {
      console.log('Mock Claude: Generating chart data');
      
      // Return predefined chart if available
      const key = `${query}:${JSON.stringify(data).substring(0, 50)}`;
      if (mockData.charts[key]) {
        return mockData.charts[key];
      }
      
      // Create default Plotly configuration based on the data
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
    })
  },
  
  perplexity: {
    isOnline: vi.fn().mockReturnValue(true),
    
    performDeepResearch: vi.fn().mockImplementation(async (query) => {
      console.log('Mock Perplexity: Performing deep research on -', query);
      
      // Return predefined research if available
      if (mockData.research[query]) {
        return mockData.research[query];
      }
      
      // Default research response
      return {
        content: `This is mock research content for the query: "${query}"\n\n` +
                 `Recent studies have shown significant advancements in this field. ` +
                 `There are several key findings worth noting:\n\n` +
                 `1. The first major development is the discovery of new methodologies\n` +
                 `2. Secondly, implementation of these techniques has shown a 25% improvement\n` +
                 `3. Finally, industry adoption has reached 40% in Category A, 65% in Category B\n\n` +
                 `Researchers at leading institutions continue to explore applications.`,
        sources: [
          { title: 'Recent Advancements in the Field', url: 'https://example.com/source1' },
          { title: 'Industry Implementation Report', url: 'https://example.com/source2' },
          { title: 'Comparative Analysis Study', url: 'https://example.com/source3' }
        ],
        modelUsed: 'sonar-deep-research-mock'
      };
    })
  },
  
  workflow: {
    // Any workflow-specific methods
  }
};

/**
 * Reset all mocks to their initial state
 */
export function resetMocks() {
  vi.resetAllMocks();
  mockData = {
    queries: {},
    clarifications: {},
    research: {},
    extraction: {},
    charts: {}
  };
}

/**
 * Configure mock responses for a specific query
 * @param {string} query - The query to configure mocks for
 * @param {object} mockResponses - Mock responses for different services
 */
export function configureMockForQuery(query, mockResponses) {
  if (mockResponses.clarification) {
    mockData.clarifications[query] = mockResponses.clarification;
  }
  
  if (mockResponses.research) {
    mockData.research[query] = mockResponses.research;
  }
  
  if (mockResponses.extraction) {
    const key = `${query}:${mockResponses.research?.content.substring(0, 50) || ''}`;
    mockData.extraction[key] = mockResponses.extraction;
  }
  
  if (mockResponses.chart) {
    const extractedData = mockResponses.extraction?.data || {};
    const key = `${query}:${JSON.stringify(extractedData).substring(0, 50)}`;
    mockData.charts[key] = mockResponses.chart;
  }
}

/**
 * Load mock data from fixtures
 */
export async function loadMockDataFromFixtures() {
  try {
    const fixturesPath = path.join(__dirname, 'fixtures');
    
    // Load test queries
    const testQueriesPath = path.join(fixturesPath, 'test-queries.json');
    if (await fileExists(testQueriesPath)) {
      const testQueries = JSON.parse(await fs.readFile(testQueriesPath, 'utf-8'));
      mockData.queries = testQueries.reduce((acc, q) => {
        acc[q.id] = q;
        return acc;
      }, {});
    }
    
    // Load mock API responses
    const mockResponsesPath = path.join(fixturesPath, 'mock-api-responses.json');
    if (await fileExists(mockResponsesPath)) {
      const mockResponses = JSON.parse(await fs.readFile(mockResponsesPath, 'utf-8'));
      
      // Configure mocks for each query
      for (const [query, responses] of Object.entries(mockResponses)) {
        configureMockForQuery(query, responses);
      }
    }
    
    console.log('Mock data loaded from fixtures');
  } catch (error) {
    console.error('Error loading mock data from fixtures:', error);
    // Continue with default mocks if fixtures can't be loaded
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} Whether the file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Setup a mock to simulate failure
 * @param {string} service - Service name ('claude' or 'perplexity')
 * @param {string} method - Method name
 * @param {Error} error - Error to throw
 */
export function setupMockFailure(service, method, error = new Error('Mock service failure')) {
  if (services[service] && services[service][method]) {
    services[service][method].mockRejectedValueOnce(error);
  }
}

/**
 * Setup a mock to simulate partial completion (returning incomplete data)
 * @param {string} service - Service name ('claude' or 'perplexity')
 * @param {string} method - Method name
 * @param {object} partialData - Partial data to return
 */
export function setupPartialCompletion(service, method, partialData) {
  if (services[service] && services[service][method]) {
    services[service][method].mockResolvedValueOnce(partialData);
  }
}

/**
 * Setup a mock to simulate slow response
 * @param {string} service - Service name ('claude' or 'perplexity')
 * @param {string} method - Method name
 * @param {number} delayMs - Delay in milliseconds
 */
export function setupSlowResponse(service, method, delayMs = 1000) {
  if (services[service] && services[service][method]) {
    const originalMock = services[service][method];
    
    services[service][method] = vi.fn().mockImplementationOnce(async (...args) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return originalMock(...args);
    });
  }
}

// Automatically load mock data when this module is imported
loadMockDataFromFixtures();