/**
 * Mock Services for Single Query Workflow Tests
 * 
 * This module provides mock implementations of the services used in the workflow.
 * These mocks simulate the behavior of the real services without external dependencies.
 */

import { vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to fixtures
const fixturesDir = path.join(__dirname, 'fixtures');

// Mock Claude service
const claudeService = {
  isOnline: vi.fn().mockReturnValue(true),
  
  clarifyQuery: vi.fn().mockImplementation(async (query) => {
    // Simulate query refinement by Claude
    // In a real implementation, this would call the Claude API
    console.log(`Mock Claude clarifying query: "${query}"`);
    
    // Return a slightly refined version of the query
    return {
      clarifiedQuery: `${query} (focusing on recent developments and key technologies)`,
      clarificationContext: {
        refinementReason: 'Added focus on recent developments for more relevant results',
        confidenceScore: 0.92
      }
    };
  }),
  
  extractDataForCharts: vi.fn().mockImplementation(async (content, query) => {
    // Simulate data extraction from research content
    console.log(`Mock Claude extracting data for charts from content (${content.length} chars)`);
    
    // Generate mock extracted data based on query theme
    let extractedData;
    
    if (query.toLowerCase().includes('renewable') || query.toLowerCase().includes('energy')) {
      extractedData = {
        chartTitle: 'Renewable Energy Storage Technologies Comparison',
        chartType: 'bar',
        categories: ['Lithium-Ion', 'Flow Batteries', 'Pumped Hydro', 'Compressed Air', 'Thermal Storage'],
        values: [85, 70, 92, 65, 78],
        metricName: 'Efficiency (%)'
      };
    } else if (query.toLowerCase().includes('quantum')) {
      extractedData = {
        chartTitle: 'Quantum Computing Hardware Progress',
        chartType: 'line',
        categories: ['2020', '2021', '2022', '2023', '2024'],
        values: [53, 127, 433, 1024, 1250],
        metricName: 'Qubits'
      };
    } else if (query.toLowerCase().includes('market') || query.toLowerCase().includes('economic')) {
      extractedData = {
        chartTitle: 'Market Share Distribution',
        chartType: 'pie',
        categories: ['Company A', 'Company B', 'Company C', 'Company D', 'Others'],
        values: [38, 25, 17, 12, 8],
        metricName: 'Market Share (%)'
      };
    } else {
      // Default data
      extractedData = {
        chartTitle: 'Data Analysis Results',
        chartType: 'bar',
        categories: ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'],
        values: [42, 58, 35, 27, 43],
        metricName: 'Value'
      };
    }
    
    return {
      data: extractedData,
      prompt: 'Extract the key numerical data points from the research content that would be suitable for a chart visualization.'
    };
  }),
  
  generateChartData: vi.fn().mockImplementation(async (data, query) => {
    // Simulate chart data generation
    console.log(`Mock Claude generating chart data for "${data.chartTitle}"`);
    
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
  })
};

// Mock Perplexity service
const perplexityService = {
  isOnline: vi.fn().mockReturnValue(true),
  
  performDeepResearch: vi.fn().mockImplementation(async (query) => {
    // Simulate deep research with Perplexity
    console.log(`Mock Perplexity performing deep research for query: "${query}"`);
    
    // Load a sample response based on query keywords
    let responseFile = 'default-research.json';
    
    // Try to match query to specific response files
    const queryLower = query.toLowerCase();
    if (queryLower.includes('renewable') || queryLower.includes('energy storage')) {
      responseFile = 'renewable-energy-research.json';
    } else if (queryLower.includes('quantum')) {
      responseFile = 'quantum-computing-research.json';
    } else if (queryLower.includes('market') || queryLower.includes('economic')) {
      responseFile = 'market-analysis-research.json';
    } else if (queryLower.includes('ai') || queryLower.includes('artificial intelligence')) {
      responseFile = 'ai-research.json';
    }
    
    try {
      // Try to load specific response file
      const responsePath = path.join(fixturesDir, 'responses', responseFile);
      const responseData = await fs.readFile(responsePath, 'utf8');
      const parsedResponse = JSON.parse(responseData);
      
      // Simulate async research process with some delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        content: parsedResponse.content,
        sources: parsedResponse.sources || [],
        modelUsed: 'sonar-deep-research'
      };
    } catch (error) {
      // If specific file isn't found, generate a generic response
      console.log(`Response file ${responseFile} not found, using generic response`);
      
      // Generate a mock research response based on the query
      let content = '';
      let sources = [];
      
      if (queryLower.includes('renewable') || queryLower.includes('energy')) {
        content = `Recent advancements in renewable energy storage technologies have focused on improving efficiency and reducing costs. Lithium-ion batteries continue to lead the market, with significant improvements in energy density and cycle life. Flow batteries are emerging as a promising option for grid-scale storage due to their scalability and long duration capabilities. Thermal energy storage systems using molten salt have seen increased adoption in concentrated solar power plants. Research into solid-state batteries shows potential for higher energy density and improved safety compared to conventional lithium-ion batteries.`;
        
        sources = [
          { title: 'Advances in Grid-Scale Energy Storage Technologies', url: 'https://example.com/energy-storage-2023' },
          { title: 'Comparative Analysis of Battery Technologies', url: 'https://example.com/battery-comparison' },
          { title: 'Thermal Energy Storage: Current Status and Future Trends', url: 'https://example.com/thermal-storage' }
        ];
      } else if (queryLower.includes('quantum')) {
        content = `Quantum computing has seen significant progress in recent years. IBM has increased their quantum volume and reduced error rates in their superconducting qubit systems. Google's Sycamore processor demonstrated quantum supremacy in 2019, and they have continued to improve their hardware. Trapped ion quantum computers, developed by companies like IonQ and Honeywell, have shown advantages in qubit connectivity and coherence times. Photonic quantum computing approaches are being pursued by PsiQuantum and Xanadu, with the goal of scalable fault-tolerant quantum computation. Topological qubits, though still theoretical, remain a promising approach for error-resistant quantum computing.`;
        
        sources = [
          { title: 'State of Quantum Computing in 2024', url: 'https://example.com/quantum-state-2024' },
          { title: 'Comparison of Quantum Hardware Approaches', url: 'https://example.com/quantum-hardware' },
          { title: 'Progress in Error Correction for Quantum Systems', url: 'https://example.com/quantum-error-correction' }
        ];
      } else {
        content = `Research results for "${query}" would typically include comprehensive analysis of the latest developments, key statistics, and expert opinions. This would include quantitative data suitable for visualization, comparisons between different approaches or technologies, and forecasts of future trends. The research would draw from academic journals, industry reports, expert interviews, and other authoritative sources to provide a balanced and thorough overview of the topic.`;
        
        sources = [
          { title: 'Comprehensive Analysis Report', url: 'https://example.com/analysis-report' },
          { title: 'Latest Research Findings', url: 'https://example.com/research-findings' },
          { title: 'Expert Perspectives and Forecasts', url: 'https://example.com/expert-forecasts' }
        ];
      }
      
      return {
        content,
        sources,
        modelUsed: 'sonar-deep-research'
      };
    }
  })
};

// Mock Workflow service for any workflow-specific methods
const workflowService = {
  // Add any workflow-specific methods here
};

// Export the services
export const services = {
  claude: claudeService,
  perplexity: perplexityService,
  workflow: workflowService
};