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
    
    clarifyQuery: vi.fn(async (query) => {
      // First, log the actual function call and parameters
      console.log('********* MOCK CLAUDE SERVICE CALLED *********');
      console.log('Function: clarifyQuery');
      console.log('Query:', query);
      console.log('Function context:', this);
      console.log('Mock data clarifications available:', Object.keys(mockData.clarifications));
      console.log('*********************************************');
      
      try {
        console.log(`Mock Claude is handling query: "${query}"`);
        
        // For direct debugging, hardcode a response for the test
        if (query === "What are the latest advancements in renewable energy storage?") {
          console.log("DIRECT TEST MATCH - Using hardcoded value for energy storage query");
          return {
            clarifiedQuery: "What are the most recent technological breakthroughs and implementations in renewable energy storage systems, focusing on developments from the past 2-3 years?",
            clarificationContext: {
              refinementReason: "Added specificity about timeframe and technology focus",
              confidenceScore: 0.95,
              modelUsed: "claude-mock"
            }
          };
        }
        
        if (query === "What are the latest advancements in quantum computing?") {
          console.log("DIRECT TEST MATCH - Using hardcoded value for quantum computing query");
          return {
            clarifiedQuery: "What are the most significant hardware and software advancements in quantum computing from the past year, focusing on qubit count, error correction, and practical applications?",
            clarificationContext: {
              refinementReason: "Added specificity about timeframe and technical areas of interest",
              confidenceScore: 0.92,
              modelUsed: "claude-mock"
            }
          };
        }
        
        if (query === "What are global renewable energy adoption rates?") {
          console.log("DIRECT TEST MATCH - Using hardcoded value for adoption rates query");
          return {
            clarifiedQuery: "What are the current global adoption rates of different renewable energy technologies, including regional variations and recent growth trends?",
            clarificationContext: {
              refinementReason: "Added specificity about technology types and analytical dimensions",
              confidenceScore: 0.94,
              modelUsed: "claude-mock"
            }
          };
        }
        
        // Check if we have mock data for this query
        if (mockData.clarifications[query]) {
          console.log('Found mock data for query:', query);
          const mockResponse = mockData.clarifications[query];
          console.log('Returning mock response:', JSON.stringify(mockResponse));
          return mockResponse;
        }
        
        // Default fallback response
        console.log('No mock data found, using default response for query:', query);
        const defaultResponse = {
          clarifiedQuery: `${query} (with focus on recent developments and practical applications)`,
          clarificationContext: {
            refinementReason: 'Added specificity and timeframe',
            confidenceScore: 0.9,
            modelUsed: 'claude-mock'
          }
        };
        console.log('Default response:', JSON.stringify(defaultResponse));
        return defaultResponse;
      } catch (error) {
        console.error('ERROR in Claude mock service:', error);
        console.error(error.stack);
        
        // Even on error, return a valid response
        return {
          clarifiedQuery: `${query} (fallback from error handler)`,
          clarificationContext: {
            refinementReason: 'Error in mock service',
            confidenceScore: 0.5,
            modelUsed: 'claude-mock-error-handler'
          }
        };
      }
    }),
    
    extractDataForCharts: vi.fn(async (content, query) => {
      console.log('********* MOCK CLAUDE EXTRACT DATA SERVICE CALLED *********');
      console.log('Function: extractDataForCharts');
      console.log('Content length:', content?.length);
      console.log('Query:', query);
      console.log('*********************************************');
      
      try {
        console.log(`Mock Claude extracting data for: "${query}"`);
        
        // For direct debugging, hardcode responses for specific test queries
        if (query.includes("renewable energy storage")) {
          console.log("DIRECT TEST MATCH - Using hardcoded value for energy storage extraction");
          return {
            data: {
              chartTitle: "Renewable Energy Storage Technologies Efficiency Comparison",
              chartType: "bar",
              categories: ["Vanadium Flow Batteries", "A-CAES", "Gravity Storage", "Lithium Iron Phosphate", "Solid-State Batteries"],
              values: [85, 65, 85, 90, 75],
              metricName: "Round-Trip Efficiency (%)"
            },
            prompt: "Extract data about storage efficiency from the research content for visualization"
          };
        }
        
        if (query.includes("quantum computing")) {
          console.log("DIRECT TEST MATCH - Using hardcoded value for quantum computing extraction");
          return {
            data: {
              chartTitle: "Recent Quantum Computing Hardware Advancements",
              chartType: "bar",
              categories: ["IBM Osprey", "Google Sycamore", "IonQ", "PsiQuantum"],
              values: [433, 53, 32, 8],
              metricName: "Qubit Count"
            },
            prompt: "Extract data about qubit counts from the research content for visualization"
          };
        }
        
        if (query.includes("renewable energy adoption")) {
          console.log("DIRECT TEST MATCH - Using hardcoded value for adoption rates extraction");
          return {
            data: {
              chartTitle: "Global Renewable Energy Adoption by Technology",
              chartType: "bar",
              categories: ["Solar", "Wind", "Hydroelectric", "Geothermal"],
              values: [20, 15, 30, 5],
              metricName: "Global Adoption Rate (%)"
            },
            prompt: "Extract data on global adoption rates for different renewable energy technologies"
          };
        }
        
        // Return predefined extraction if available
        const key = `${query}:${content?.substring(0, 50)}`;
        if (mockData.extraction[key]) {
          console.log('Found predefined extraction for key:', key);
          return mockData.extraction[key];
        }
        
        // Default extraction
        console.log('No predefined extraction found, using default values');
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
      } catch (error) {
        console.error('ERROR in Claude extractDataForCharts mock:', error);
        console.error(error.stack);
        
        // Return a valid fallback response
        return {
          data: {
            chartTitle: 'Fallback Chart Data',
            chartType: 'bar',
            categories: ['Fallback A', 'Fallback B', 'Fallback C'],
            values: [10, 20, 30],
            metricName: 'Value'
          },
          prompt: 'Extract data from research content (fallback)'
        };
      }
    }),
    
    generateChartData: vi.fn(async (data, query) => {
      console.log('********* MOCK CLAUDE CHART GEN SERVICE CALLED *********');
      console.log('Function: generateChartData');
      console.log('Data:', JSON.stringify(data, null, 2));
      console.log('Query:', query);
      console.log('*********************************************');
      
      try {
        console.log(`Mock Claude generating chart data for: "${query}"`);
        
        // For direct debugging, hardcode responses for specific test queries
        if (query.includes("renewable energy storage")) {
          console.log("DIRECT TEST MATCH - Using hardcoded chart for energy storage");
          return {
            data: data,
            plotlyConfig: {
              data: [{
                type: "bar",
                x: data.categories || ["Vanadium Flow Batteries", "A-CAES", "Gravity Storage", "Lithium Iron Phosphate", "Solid-State Batteries"],
                y: data.values || [85, 65, 85, 90, 75],
                marker: {
                  color: "rgb(55, 83, 109)"
                }
              }],
              layout: {
                title: data.chartTitle || "Renewable Energy Storage Technologies Efficiency Comparison",
                xaxis: {
                  title: "Storage Technology"
                },
                yaxis: {
                  title: data.metricName || "Round-Trip Efficiency (%)",
                  range: [0, 100]
                }
              }
            }
          };
        }
        
        if (query.includes("quantum computing")) {
          console.log("DIRECT TEST MATCH - Using hardcoded chart for quantum computing");
          return {
            data: data,
            plotlyConfig: {
              data: [{
                type: "bar",
                x: data.categories || ["IBM Osprey", "Google Sycamore", "IonQ", "PsiQuantum"],
                y: data.values || [433, 53, 32, 8],
                marker: {
                  color: "rgb(66, 133, 244)"
                }
              }],
              layout: {
                title: data.chartTitle || "Recent Quantum Computing Hardware Advancements",
                xaxis: {
                  title: "Quantum Processor"
                },
                yaxis: {
                  title: data.metricName || "Qubit Count"
                }
              }
            }
          };
        }
        
        if (query.includes("renewable energy adoption")) {
          console.log("DIRECT TEST MATCH - Using hardcoded chart for adoption rates");
          return {
            data: data,
            plotlyConfig: {
              data: [{
                type: "bar",
                x: data.categories || ["Solar", "Wind", "Hydroelectric", "Geothermal"],
                y: data.values || [20, 15, 30, 5],
                marker: {
                  color: ["#f1c40f", "#3498db", "#2ecc71", "#e74c3c"]
                }
              }],
              layout: {
                title: data.chartTitle || "Global Renewable Energy Adoption by Technology",
                xaxis: {
                  title: "Technology"
                },
                yaxis: {
                  title: data.metricName || "Global Adoption Rate (%)",
                  range: [0, 35]
                }
              }
            }
          };
        }
        
        // Return predefined chart if available
        const key = `${query}:${JSON.stringify(data).substring(0, 50)}`;
        if (mockData.charts[key]) {
          console.log('Found predefined chart data for key:', key);
          return mockData.charts[key];
        }
        
        console.log('No predefined chart found, generating from data');
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
    } catch (error) {
      console.error('ERROR in Claude generateChartData mock:', error);
      console.error(error.stack);
      
      // Return a valid fallback response
      return {
        data: data || {
          chartTitle: 'Fallback Chart',
          chartType: 'bar',
          categories: ['A', 'B', 'C'],
          values: [10, 20, 30],
          metricName: 'Value'
        },
        plotlyConfig: {
          data: [{
            type: 'bar',
            x: ['A', 'B', 'C'],
            y: [10, 20, 30]
          }],
          layout: {
            title: 'Fallback Chart (Error Recovery)'
          }
        }
      };
    }
  })
  },
  
  perplexity: {
    isOnline: vi.fn().mockReturnValue(true),
    
    performDeepResearch: vi.fn(async (query) => {
      console.log('********* MOCK PERPLEXITY SERVICE CALLED *********');
      console.log('Function: performDeepResearch');
      console.log('Query:', query);
      console.log('Mock data research available:', Object.keys(mockData.research));
      console.log('*********************************************');

      try {
        console.log(`Mock Perplexity is handling query: "${query}"`);
        
        // For direct debugging, hardcode responses for specific test queries
        if (query.includes("renewable energy storage")) {
          console.log("DIRECT TEST MATCH - Using hardcoded value for energy storage deep research");
          return {
            content: `Recent advancements in renewable energy storage have been substantial, with several breakthrough technologies reaching commercial viability in the past 2-3 years.\n\nFor grid-scale storage:\n1. Flow batteries have seen significant improvements, with vanadium redox flow batteries now achieving 80-90% round-trip efficiency and 20+ year lifespans.\n\n2. Compressed air energy storage (CAES) has evolved with Hydrostor's Advanced Compressed Air Energy Storage (A-CAES) technology, which achieves 60-70% efficiency without fossil fuels.\n\n3. Gravity-based storage solutions like Energy Vault's crane and block system can store 35MWh of energy and discharge at 4MW, with 80-90% round-trip efficiency.\n\nFor residential storage:\n1. Lithium iron phosphate (LFP) batteries have become dominant due to improved safety and longevity.\n\n2. Solid-state batteries are beginning to enter the market with companies like QuantumScape making progress on commercial production.\n\n3. Salt (sodium-ion) batteries are emerging as a promising alternative to lithium-ion, with CATL announcing mass production.`,
            sources: [
              { title: 'BloombergNEF Battery Price Survey 2023', url: 'https://example.com/bnef-battery-survey-2023' },
              { title: 'IEA Energy Storage Tracking Report 2023', url: 'https://example.com/iea-storage-tracking-2023' }
            ],
            modelUsed: 'sonar-deep-research-mock'
          };
        }
        
        if (query.includes("quantum computing")) {
          console.log("DIRECT TEST MATCH - Using hardcoded value for quantum computing deep research");
          return {
            content: `Recent advancements in quantum computing have been remarkable, spanning hardware, software, and practical applications.\n\nOn the hardware front, significant milestones include:\n1. IBM's Osprey quantum processor with 433 qubits, more than tripling their previous system's qubit count.\n2. Google's achievement of error correction using logical qubits with their Sycamore processor.\n\nIn quantum software and algorithms:\n1. The development of hybrid quantum-classical algorithms has expanded, with Variational Quantum Eigensolver (VQE) seeing significant improvements.\n2. Quantum machine learning frameworks have matured, with TensorFlow Quantum and PennyLane enabling integration with classical ML workflows.`,
            sources: [
              { title: 'IBM Quantum Development Roadmap 2023', url: 'https://example.com/ibm-quantum-roadmap' },
              { title: 'Nature: Quantum Error Correction with the Surface Code', url: 'https://example.com/nature-quantum-error-correction' }
            ],
            modelUsed: 'sonar-deep-research-mock'
          };
        }
        
        if (query.includes("renewable energy adoption")) {
          console.log("DIRECT TEST MATCH - Using hardcoded value for adoption rates deep research");
          return {
            content: `Global renewable energy adoption has seen significant growth in recent years, with uneven distribution across regions and technologies.\n\nSolar energy adoption reached 25% in developed countries and 15% in developing nations, with China leading global capacity at 306 GW installed.\n\nWind power accounts for 20% of energy production in Europe, 12% in North America, and 8% in Asia.\n\nHydroelectric power remains at 30% globally with minimal recent growth.\n\nGeothermal energy is still only at 5% adoption worldwide.`,
            sources: [
              { title: 'Global Renewable Energy Report 2024', url: 'https://example.com/global-energy-report' },
              { title: 'IRENA Renewable Capacity Statistics 2023', url: 'https://example.com/irena-statistics' }
            ],
            modelUsed: 'sonar-deep-research-mock'
          };
        }
        
        // Check if we have mock data for this query
        if (mockData.research[query]) {
          console.log('Found mock data for research query:', query);
          const mockResponse = mockData.research[query];
          console.log('Returning mock research data');
          return mockResponse;
        }
        
        // Default fallback response
        console.log('No mock data found, using default research response for query:', query);
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
      } catch (error) {
        console.error('ERROR in Perplexity mock service:', error);
        console.error(error.stack);
        
        // Even on error, return a valid response to prevent test failure
        return {
          content: `Error occurred during research, but here's a fallback response for: "${query}"`,
          sources: [
            { title: 'Fallback Source', url: 'https://example.com/fallback' }
          ],
          modelUsed: 'sonar-deep-research-mock-error-handler'
        };
      }
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
  try {
    console.log('configureMockForQuery called for query:', query);
    
    if (mockResponses.clarification) {
      console.log('Setting up clarification mock for query:', query);
      console.log('Clarification data:', JSON.stringify(mockResponses.clarification));
      console.log('Has clarifiedQuery:', mockResponses.clarification.hasOwnProperty('clarifiedQuery'));
      mockData.clarifications[query] = mockResponses.clarification;
      console.log('Stored mock data for clarification, keys now:', Object.keys(mockData.clarifications));
      
      // Verify the data was properly stored
      if (mockData.clarifications[query]) {
        console.log('Verification - Mock data stored successfully');
        console.log('Retrieved mock has clarifiedQuery:', 
          mockData.clarifications[query].hasOwnProperty('clarifiedQuery'));
      } else {
        console.error('Verification FAILED - Mock data was not stored properly');
      }
    }
    
    if (mockResponses.research) {
      console.log('Setting up research mock for query:', query);
      mockData.research[query] = mockResponses.research;
    }
    
    if (mockResponses.extraction) {
      console.log('Setting up extraction mock for query:', query);
      const key = `${query}:${mockResponses.research?.content.substring(0, 50) || ''}`;
      mockData.extraction[key] = mockResponses.extraction;
    }
    
    if (mockResponses.chart) {
      console.log('Setting up chart mock for query:', query);
      const extractedData = mockResponses.extraction?.data || {};
      const key = `${query}:${JSON.stringify(extractedData).substring(0, 50)}`;
      mockData.charts[key] = mockResponses.chart;
    }
  } catch (error) {
    console.error('Error in configureMockForQuery:', error);
    console.error(error.stack);
  }
}

/**
 * Load mock data from fixtures
 */
export async function loadMockDataFromFixtures() {
  try {
    const fixturesPath = path.join(__dirname, 'fixtures');
    console.log('Loading mock data from fixtures path:', fixturesPath);
    
    // Load test queries
    const testQueriesPath = path.join(fixturesPath, 'test-queries.json');
    console.log('Test queries path:', testQueriesPath);
    const testQueriesExists = await fileExists(testQueriesPath);
    console.log('Test queries file exists:', testQueriesExists);
    
    if (testQueriesExists) {
      const testQueries = JSON.parse(await fs.readFile(testQueriesPath, 'utf-8'));
      mockData.queries = testQueries.reduce((acc, q) => {
        acc[q.id] = q;
        return acc;
      }, {});
      console.log('Loaded test queries:', Object.keys(mockData.queries).length);
    }
    
    // Load mock API responses
    const mockResponsesPath = path.join(fixturesPath, 'mock-api-responses.json');
    console.log('Mock API responses path:', mockResponsesPath);
    const mockResponsesExists = await fileExists(mockResponsesPath);
    console.log('Mock API responses file exists:', mockResponsesExists);
    
    if (mockResponsesExists) {
      const mockResponses = JSON.parse(await fs.readFile(mockResponsesPath, 'utf-8'));
      console.log('Mock responses loaded, queries:', Object.keys(mockResponses));
      
      // Configure mocks for each query
      for (const [query, responses] of Object.entries(mockResponses)) {
        console.log('Configuring mock for query:', query);
        console.log('Response data available:', Object.keys(responses));
        configureMockForQuery(query, responses);
      }
      
      console.log('Configured mock data:');
      console.log('- Clarifications:', Object.keys(mockData.clarifications));
      console.log('- Research:', Object.keys(mockData.research));
    }
    
    console.log('Mock data loaded from fixtures');
  } catch (error) {
    console.error('Error loading mock data from fixtures:', error);
    console.error(error.stack);
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
// Since this is async but we need it to be ready immediately, 
// we'll prepare some known mock responses inline
// This data will be merged with any loaded from files
(async () => {
  // Immediately set up basic mock data for the default test queries
  const defaultQueries = [
    "What are the latest advancements in renewable energy storage?",
    "What are the latest advancements in quantum computing?",
    "What are global renewable energy adoption rates?"
  ];
  
  // Add default clarification responses
  for (const query of defaultQueries) {
    mockData.clarifications[query] = {
      clarifiedQuery: `${query} (enhanced with additional specificity)`,
      clarificationContext: {
        refinementReason: 'Added specificity and timeframe',
        confidenceScore: 0.9,
        modelUsed: 'claude-mock'
      }
    };
    console.log(`Added default mock clarification for: ${query}`);
  }
  
  // Then load from fixtures asynchronously (will override these defaults if present)
  loadMockDataFromFixtures();
})();