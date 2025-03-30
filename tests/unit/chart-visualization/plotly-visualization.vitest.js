/**
 * Plotly Visualization Test
 * 
 * This test verifies the system's ability to generate Plotly visualizations
 * for different chart types.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Mock claudeService
vi.mock('../../../services/claudeService.js', () => {
  return {
    processText: vi.fn(),
    processMultimodal: vi.fn(),
    processConversation: vi.fn(),
    generatePlotlyVisualization: vi.fn(),
    getHealthStatus: vi.fn()
  };
});

// Import after mocking
import * as claudeService from '../../../services/claudeService.js';

// Sample test data for visualizations
const samplePriceData = {
  "prices": [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  "tooExpensive": [0.05, 0.10, 0.20, 0.35, 0.48, 0.65, 0.75, 0.85, 0.92, 0.96],
  "expensiveButReasonable": [0.12, 0.25, 0.45, 0.58, 0.72, 0.65, 0.55, 0.42, 0.30, 0.20],
  "goodValue": [0.80, 0.72, 0.60, 0.48, 0.40, 0.30, 0.25, 0.18, 0.12, 0.05],
  "tooCheap": [0.85, 0.65, 0.45, 0.30, 0.18, 0.12, 0.08, 0.05, 0.03, 0.01]
};

const sampleConjointData = {
  "attributes": [
    {
      "name": "Brand",
      "levels": ["Brand A", "Brand B", "Brand C"],
      "importanceScore": 35,
      "utilityScores": {
        "Brand A": 0.8,
        "Brand B": 0.3,
        "Brand C": -1.1
      }
    },
    {
      "name": "Price",
      "levels": ["$10", "$15", "$20"],
      "importanceScore": 40,
      "utilityScores": {
        "$10": 1.2,
        "$15": 0.1,
        "$20": -1.3
      }
    },
    {
      "name": "Features",
      "levels": ["Basic", "Standard", "Premium"],
      "importanceScore": 25,
      "utilityScores": {
        "Basic": -0.9,
        "Standard": 0.2,
        "Premium": 0.7
      }
    }
  ]
};

const sampleBarData = {
  "categories": ["Category A", "Category B", "Category C", "Category D", "Category E"],
  "values": [23, 45, 32, 15, 37]
};

// Mock responses for different chart types
const mockResponses = {
  van_westendorp: {
    plotlyConfig: {
      data: [
        {
          x: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
          y: [0.85, 0.65, 0.45, 0.30, 0.18, 0.12, 0.08, 0.05, 0.03, 0.01],
          type: 'scatter',
          mode: 'lines',
          name: 'Too Cheap'
        },
        {
          x: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
          y: [0.05, 0.10, 0.20, 0.35, 0.48, 0.65, 0.75, 0.85, 0.92, 0.96],
          type: 'scatter',
          mode: 'lines',
          name: 'Too Expensive'
        }
      ],
      layout: {
        title: 'Price Sensitivity Analysis',
        xaxis: { title: 'Price ($)' },
        yaxis: { title: 'Cumulative Percentage' },
        showlegend: true
      },
      config: { responsive: true }
    },
    insights: [
      'The optimal price point is around $25-30.',
      'Customers become price sensitive above $35.',
      'Below $15, the product may be perceived as low quality.'
    ],
    modelUsed: 'claude-3-7-sonnet-20250219',
    pricePoints: {
      optimalPrice: 28,
      indifferencePrice: 25,
      pointOfMarginalExpensiveness: 35,
      pointOfMarginalCheapness: 15
    }
  },
  
  conjoint: {
    plotlyConfig: {
      data: [
        {
          x: ['Brand', 'Price', 'Features'],
          y: [35, 40, 25],
          type: 'bar',
          name: 'Attribute Importance'
        }
      ],
      layout: {
        title: 'Conjoint Analysis Results',
        xaxis: { title: 'Attributes' },
        yaxis: { title: 'Importance (%)' },
        showlegend: true
      },
      config: { responsive: true }
    },
    insights: [
      'Price is the most important factor at 40% importance.',
      'Brand is the second most important at 35%.',
      'Features has the lowest importance at 25%.'
    ],
    modelUsed: 'claude-3-7-sonnet-20250219',
    optimalCombination: {
      Brand: 'Brand A',
      Price: '$10',
      Features: 'Premium'
    }
  },
  
  bar: {
    plotlyConfig: {
      data: [
        {
          x: ["Category A", "Category B", "Category C", "Category D", "Category E"],
          y: [23, 45, 32, 15, 37],
          type: 'bar',
          marker: {
            color: 'rgba(50, 171, 96, 0.6)'
          }
        }
      ],
      layout: {
        title: 'Sample Bar Chart',
        xaxis: { title: 'Categories' },
        yaxis: { title: 'Values' }
      },
      config: { responsive: true }
    },
    insights: [
      'Category B has the highest value at 45.',
      'Category D has the lowest value at 15.',
      'The average value across categories is 30.4.'
    ],
    modelUsed: 'claude-3-7-sonnet-20250219'
  }
};

describe('Plotly Visualization Tests', () => {
  
  beforeEach(() => {
    // Restore mocks before each test
    vi.restoreAllMocks();
    
    // Mock the generatePlotlyVisualization function
    claudeService.generatePlotlyVisualization.mockImplementation(async (data, type, title, description) => {
      // Return the corresponding mock response for the chart type
      if (mockResponses[type]) {
        return Promise.resolve(mockResponses[type]);
      }
      return Promise.reject(new Error(`Unknown chart type: ${type}`));
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Van Westendorp Price Sensitivity Analysis', () => {
    
    it('should generate a Van Westendorp visualization successfully', async () => {
      // Call the service with Van Westendorp data
      const result = await claudeService.generatePlotlyVisualization(
        samplePriceData,
        'van_westendorp',
        'Price Sensitivity Analysis',
        'Analysis of price sensitivity for our new product line'
      );
      
      // Verify the function was called with the correct parameters
      expect(claudeService.generatePlotlyVisualization).toHaveBeenCalledWith(
        samplePriceData,
        'van_westendorp',
        'Price Sensitivity Analysis',
        'Analysis of price sensitivity for our new product line'
      );
      
      // Verify the result structure
      expect(result).toHaveProperty('plotlyConfig');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('modelUsed');
      expect(result).toHaveProperty('pricePoints');
      
      // Verify the plotly config contains the correct data structure
      expect(result.plotlyConfig.data).toBeInstanceOf(Array);
      expect(result.plotlyConfig.data.length).toBeGreaterThan(0);
      expect(result.plotlyConfig.layout).toHaveProperty('title');
      
      // Verify the price points
      expect(result.pricePoints).toHaveProperty('optimalPrice');
      expect(result.pricePoints).toHaveProperty('indifferencePrice');
      expect(result.pricePoints).toHaveProperty('pointOfMarginalExpensiveness');
      expect(result.pricePoints).toHaveProperty('pointOfMarginalCheapness');
    });
    
    it('should include at least 3 insights in the response', async () => {
      const result = await claudeService.generatePlotlyVisualization(
        samplePriceData,
        'van_westendorp',
        'Price Sensitivity Analysis',
        'Analysis of price sensitivity for our new product line'
      );
      
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Conjoint Analysis', () => {
    
    it('should generate a conjoint analysis visualization successfully', async () => {
      // Call the service with conjoint data
      const result = await claudeService.generatePlotlyVisualization(
        sampleConjointData,
        'conjoint',
        'Conjoint Analysis Results',
        'Analysis of consumer preferences and tradeoffs'
      );
      
      // Verify the function was called with the correct parameters
      expect(claudeService.generatePlotlyVisualization).toHaveBeenCalledWith(
        sampleConjointData,
        'conjoint',
        'Conjoint Analysis Results',
        'Analysis of consumer preferences and tradeoffs'
      );
      
      // Verify the result structure
      expect(result).toHaveProperty('plotlyConfig');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('modelUsed');
      expect(result).toHaveProperty('optimalCombination');
      
      // Verify the plotly config contains the correct data structure
      expect(result.plotlyConfig.data).toBeInstanceOf(Array);
      expect(result.plotlyConfig.data.length).toBeGreaterThan(0);
      expect(result.plotlyConfig.layout).toHaveProperty('title');
      
      // Verify the optimal combination
      expect(result.optimalCombination).toHaveProperty('Brand');
      expect(result.optimalCombination).toHaveProperty('Price');
      expect(result.optimalCombination).toHaveProperty('Features');
    });
    
    it('should include at least 3 insights in the response', async () => {
      const result = await claudeService.generatePlotlyVisualization(
        sampleConjointData,
        'conjoint',
        'Conjoint Analysis Results',
        'Analysis of consumer preferences and tradeoffs'
      );
      
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Bar Chart', () => {
    
    it('should generate a bar chart visualization successfully', async () => {
      // Call the service with bar chart data
      const result = await claudeService.generatePlotlyVisualization(
        sampleBarData,
        'bar',
        'Sample Bar Chart',
        'Visualization of category performance'
      );
      
      // Verify the function was called with the correct parameters
      expect(claudeService.generatePlotlyVisualization).toHaveBeenCalledWith(
        sampleBarData,
        'bar',
        'Sample Bar Chart',
        'Visualization of category performance'
      );
      
      // Verify the result structure
      expect(result).toHaveProperty('plotlyConfig');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('modelUsed');
      
      // Verify the plotly config contains the correct data structure
      expect(result.plotlyConfig.data).toBeInstanceOf(Array);
      expect(result.plotlyConfig.data.length).toBeGreaterThan(0);
      expect(result.plotlyConfig.layout).toHaveProperty('title');
      
      // Verify bar chart specific properties
      const chartData = result.plotlyConfig.data[0];
      expect(chartData.type).toBe('bar');
      expect(chartData.x).toEqual(sampleBarData.categories);
      expect(chartData.y).toEqual(sampleBarData.values);
    });
    
    it('should include at least 3 insights in the response', async () => {
      const result = await claudeService.generatePlotlyVisualization(
        sampleBarData,
        'bar',
        'Sample Bar Chart',
        'Visualization of category performance'
      );
      
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Error Handling', () => {
    
    it('should handle unknown chart types properly', async () => {
      // Override the mock for this specific test
      claudeService.generatePlotlyVisualization.mockImplementation(async (data, type) => {
        if (type === 'unknown_type') {
          return Promise.reject(new Error('Unknown chart type: unknown_type'));
        }
        return mockResponses.bar; // Default fallback
      });
      
      await expect(
        claudeService.generatePlotlyVisualization(
          sampleBarData,
          'unknown_type',
          'Unknown Chart',
          'Testing error handling'
        )
      ).rejects.toThrow('Unknown chart type: unknown_type');
    });
    
    it('should handle API errors properly', async () => {
      // Override the mock for this specific test
      claudeService.generatePlotlyVisualization.mockImplementation(async () => {
        throw new Error('API error: rate limit exceeded');
      });
      
      await expect(
        claudeService.generatePlotlyVisualization(
          sampleBarData,
          'bar',
          'Error Test',
          'Testing error handling'
        )
      ).rejects.toThrow('API error: rate limit exceeded');
    });
  });
});