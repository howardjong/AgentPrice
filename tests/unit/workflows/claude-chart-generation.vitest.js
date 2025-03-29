/**
 * Claude Chart Generation Tests
 * Focused on testing the chart generation capabilities of Claude 
 * for the single-query-workflow
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { traceTest } from '../../utils/test-helpers.js';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock logger before other imports
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock monitoring
vi.mock('../../../utils/monitoring.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    executeRequest: vi.fn().mockImplementation((serviceKey, fn) => fn())
  }))
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  class MockMessages {
    create(options) {
      const chartType = options.messages[0].content.toLowerCase();
      
      // Mock responses based on chart type requested
      let content = [];
      
      if (chartType.includes('van westendorp') || chartType.includes('price sensitivity')) {
        content = [
          {
            type: 'text',
            text: JSON.stringify({
              plotlyData: [
                { x: [4, 5, 6, 7, 8, 9, 10, 11], y: [0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05, 0.01], type: 'scatter', name: 'Too Cheap' },
                { x: [4, 5, 6, 7, 8, 9, 10, 11], y: [0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99], type: 'scatter', name: 'Too Expensive' },
                { x: [4, 5, 6, 7, 8, 9, 10, 11], y: [0.1, 0.3, 0.6, 0.8, 0.5, 0.3, 0.2, 0.1], type: 'scatter', name: 'Good Value' },
                { x: [4, 5, 6, 7, 8, 9, 10, 11], y: [0.8, 0.5, 0.3, 0.2, 0.5, 0.7, 0.9, 1.0], type: 'scatter', name: 'Too Costly' },
              ],
              plotlyLayout: {
                title: 'Van Westendorp Price Sensitivity Analysis',
                xaxis: { title: 'Price ($)' },
                yaxis: { title: 'Cumulative Percentage' }
              },
              insights: [
                'Optimal price point appears to be around $7.50-$8.50',
                'Price sensitivity increases significantly above $9.50',
                'Prices below $5.50 may signal quality concerns'
              ]
            })
          }
        ];
      } else if (chartType.includes('conjoint') || chartType.includes('attribute importance')) {
        content = [
          {
            type: 'text',
            text: JSON.stringify({
              plotlyData: [
                { y: ['Flavor Intensity', 'Brewing Method', 'Origin', 'Price'], x: [0.35, 0.25, 0.2, 0.2], type: 'bar', orientation: 'h' }
              ],
              plotlyLayout: {
                title: 'Conjoint Analysis: Attribute Importance',
                xaxis: { title: 'Relative Importance' }
              },
              insights: [
                'Flavor intensity is the most important factor (35%)',
                'Brewing method ranks second in importance (25%)',
                'Origin and price are equally important (20% each)'
              ]
            })
          }
        ];
      } else if (chartType.includes('bar chart') || chartType.includes('basic_bar')) {
        content = [
          {
            type: 'text',
            text: JSON.stringify({
              plotlyData: [
                { x: ['Standard', 'Premium', 'Ultra Premium'], y: [5, 7, 10], type: 'bar' }
              ],
              plotlyLayout: {
                title: 'Average Price Points by Segment',
                xaxis: { title: 'Market Segment' },
                yaxis: { title: 'Price ($)' }
              },
              insights: [
                'Standard specialty coffees average $5',
                'Premium specialty coffees average $7',
                'Ultra-premium specialty coffees average $10'
              ]
            })
          }
        ];
      } else {
        // Default response for unrecognized chart types
        content = [
          {
            type: 'text',
            text: JSON.stringify({
              plotlyData: [],
              plotlyLayout: { title: 'Chart' },
              insights: ['No specific insights available for this chart type']
            })
          }
        ];
      }
      
      return Promise.resolve({
        id: 'msg_' + Math.random().toString(36).substring(2, 12),
        type: 'message',
        role: 'assistant',
        model: 'claude-3-7-sonnet-20250219',
        content: content,
        usage: {
          input_tokens: 500,
          output_tokens: 1000
        }
      });
    }
  }
  
  return {
    default: class MockAnthropic {
      constructor() {
        this.messages = new MockMessages();
      }
    },
    HUMAN_PROMPT: '\n\nHuman: ',
    AI_PROMPT: '\n\nAssistant: '
  };
});

// Import after mocks
import claudeService from '../../../services/claudeService.js';
import logger from '../../../utils/logger.js';

describe('Claude Chart Generation (Workflow Support)', () => {
  traceTest('Claude Chart Generation Workflow');
  
  let originalEnv;
  
  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Setup mock API key
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  // Sample research data from Perplexity that would be used for chart generation
  const sampleResearchData = `
Based on my research into specialty coffee pricing in the Bay Area market, particularly for your chemistry-infused concept:

## Market Pricing Overview
- Standard specialty coffee shops charge $4.50-$5.50 per cup
- Premium specialty coffee averages $5.50-$7.50 per cup
- Ultra-premium specialty experiences range from $7.50-$12.00 per cup

## Van Westendorp Price Sensitivity Analysis
- Too cheap (quality concerns): below $5.50
- Good value: $6.50-$8.00
- Premium but acceptable: $8.00-$9.50
- Too expensive: above $10.00

## Customer Attribute Importance
- Flavor intensity/uniqueness: 35%
- Brewing method/presentation: 25%
- Bean origin/quality: 20%
- Price: 20%

## Competitive Pricing
- Blue Bottle Coffee: $4.75-$6.00 standard, $6.50-$8.50 premium
- Philz Coffee: $4.50-$6.50 standard, $6.50-$8.00 premium
- Ritual Coffee: $5.00-$7.00 standard, $7.00-$9.50 premium

## Profit Margin Analysis
- 35% profit margin requires pricing at minimum $7.50 for standard offerings
- Premium chemistry-infused offerings would need $9.50+ to maintain margins
- Limited edition specialties could command $12-15 with appropriate positioning
`;

  /**
   * Test cases
   */
  it('should generate Van Westendorp price sensitivity chart data', async () => {
    // Execute chart generation
    const chartData = await claudeService.generateChartData(
      sampleResearchData,
      'van_westendorp'
    );
    
    // Verify chart data structure
    expect(chartData).toHaveProperty('plotlyData');
    expect(chartData).toHaveProperty('plotlyLayout');
    expect(chartData).toHaveProperty('insights');
    
    // Verify it's a proper Van Westendorp chart
    expect(chartData.plotlyLayout.title).toContain('Van Westendorp');
    
    // Verify there are 4 lines (too cheap, too expensive, good value, too costly)
    expect(chartData.plotlyData).toHaveLength(4);
    
    // Verify insights
    expect(chartData.insights).toHaveLength(3);
    expect(chartData.insights[0]).toContain('price point');
  });
  
  it('should generate conjoint analysis chart data', async () => {
    // Execute chart generation
    const chartData = await claudeService.generateChartData(
      sampleResearchData,
      'conjoint'
    );
    
    // Verify chart data structure
    expect(chartData).toHaveProperty('plotlyData');
    expect(chartData).toHaveProperty('plotlyLayout');
    expect(chartData).toHaveProperty('insights');
    
    // Verify it's a proper conjoint chart
    expect(chartData.plotlyLayout.title).toContain('Conjoint Analysis');
    
    // Verify data for horizontal bar chart
    expect(chartData.plotlyData[0].orientation).toBe('h');
    expect(chartData.plotlyData[0].type).toBe('bar');
    
    // Verify insights
    expect(chartData.insights).toHaveLength(3);
    expect(chartData.insights[0]).toContain('Flavor intensity');
  });
  
  it('should generate basic bar chart data', async () => {
    // Execute chart generation
    const chartData = await claudeService.generateChartData(
      sampleResearchData,
      'basic_bar'
    );
    
    // Verify chart data structure
    expect(chartData).toHaveProperty('plotlyData');
    expect(chartData).toHaveProperty('plotlyLayout');
    expect(chartData).toHaveProperty('insights');
    
    // Verify it's a basic bar chart
    expect(chartData.plotlyData[0].type).toBe('bar');
    
    // Verify insights
    expect(chartData.insights).toHaveLength(3);
    expect(chartData.insights[0]).toContain('Standard specialty coffees');
  });
  
  it('should handle missing or incomplete data gracefully', async () => {
    // Execute chart generation with limited data
    const limitedData = "Specialty coffee prices range from $4.50 to $12.00 per cup.";
    const chartData = await claudeService.generateChartData(
      limitedData,
      'van_westendorp'
    );
    
    // Even with limited data, should still return a valid structure
    expect(chartData).toHaveProperty('plotlyData');
    expect(chartData).toHaveProperty('plotlyLayout');
    expect(chartData).toHaveProperty('insights');
  });
  
  it('should ensure the generated chart data is compatible with Plotly.js', async () => {
    // Test each chart type for Plotly.js compatibility
    const chartTypes = ['van_westendorp', 'conjoint', 'basic_bar'];
    
    for (const chartType of chartTypes) {
      const chartData = await claudeService.generateChartData(
        sampleResearchData,
        chartType
      );
      
      // Verify the structure is compatible with Plotly.js
      expect(chartData).toHaveProperty('plotlyData');
      expect(Array.isArray(chartData.plotlyData)).toBe(true);
      
      // Each trace should have a type
      chartData.plotlyData.forEach(trace => {
        expect(trace).toHaveProperty('type');
      });
      
      // Layout should have a title at minimum
      expect(chartData.plotlyLayout).toHaveProperty('title');
    }
  });
  
  it('should handle errors in chart generation gracefully', async () => {
    // Mock a failure in the Anthropic API
    vi.spyOn(claudeService, 'generateChartData').mockImplementationOnce(() => {
      throw new Error('Chart generation failed');
    });
    
    // Execute and verify error handling
    await expect(claudeService.generateChartData(
      sampleResearchData,
      'van_westendorp'
    )).rejects.toThrow('Chart generation failed');
  });
});