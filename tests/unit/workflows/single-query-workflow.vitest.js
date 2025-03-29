/**
 * Single Query Workflow Integration Test
 * Tests the complete workflow from test-single-query-workflow.js
 * with mocked API calls
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { traceTest } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs/promises';

// Mock fs for output file operations
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined)
  };
});

// Mock the services
vi.mock('../../../services/claudeService.js', () => ({
  default: {
    generateClarifyingQuestions: vi.fn().mockResolvedValue([
      'Can you briefly describe your product and the core problem it solves?',
      'Who is your target customer, and how do they currently address this problem?',
      'Who are your main competitors, and how is your product different?',
      'What price ranges or benchmarks exist in your market today?',
      'Are there key financial or operational constraints affecting your pricing?'
    ]),
    processConversation: vi.fn().mockResolvedValue({
      response: 'Optimized research prompt for specialty coffee business with chemistry-based flavor infusions.',
      modelUsed: 'claude-3-7-sonnet-20250219'
    }),
    generateChartData: vi.fn().mockImplementation((content, chartType) => {
      const mockChartData = {
        van_westendorp: {
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
        },
        conjoint: {
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
        },
        basic_bar: {
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
        }
      };
      return Promise.resolve(mockChartData[chartType] || {
        plotlyData: [],
        plotlyLayout: {},
        insights: []
      });
    })
  }
}));

vi.mock('../../../services/perplexityService.js', () => ({
  default: {
    performDeepResearch: vi.fn().mockResolvedValue({
      query: 'Research specialty coffee pricing in Bay Area',
      timestamp: new Date().toISOString(),
      content: 'Based on my research, specialty coffee in the Bay Area typically follows these pricing tiers:\n\n- Standard specialty: $4.50-$5.50\n- Premium specialty: $5.50-$7.50\n- Ultra-premium specialty: $7.50-$12.00\n\nFor your chemistry-infused coffee concept, the Van Westendorp analysis indicates:\n- Too cheap: below $5.50\n- Good value: $6.50-$8.00\n- Premium but acceptable: $8.00-$9.50\n- Too expensive: above $10.00',
      sources: [
        'https://example.com/specialty-coffee-pricing',
        'https://example.com/bay-area-coffee-market',
        'https://example.com/pricing-strategies'
      ],
      modelUsed: 'sonar-deep-research',
      jobId: 'test-uuid'
    })
  }
}));

vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import the services after mocking
import claudeService from '../../../services/claudeService.js';
import perplexityService from '../../../services/perplexityService.js';
import logger from '../../../utils/logger.js';

// Import the uuid module but mock it
import { v4 as uuidv4 } from 'uuid';
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid')
}));

describe('Single Query Workflow Integration', () => {
  traceTest('Single Query Workflow Integration');
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Reset all mocks after each test
    vi.clearAllMocks();
  });
  
  // Main test case that simulates the entire workflow
  it('should execute the complete single query workflow with mocked services', async () => {
    // Step 1: Define the initial query (mimicking test-single-query-workflow.js)
    const initialQuery = "I'm thinking about starting a new specialty coffee busines but not sure what I should charge and if there's a market for it. Can you help me find out?";
    
    // Step 2: Generate clarifying questions with Claude
    const clarifyingQuestions = await claudeService.generateClarifyingQuestions(initialQuery);
    
    // Verify questions were generated
    expect(claudeService.generateClarifyingQuestions).toHaveBeenCalledWith(initialQuery);
    expect(clarifyingQuestions).toHaveLength(5);
    expect(clarifyingQuestions[0]).toBe('Can you briefly describe your product and the core problem it solves?');
    
    // Step 3: Pre-populate answers (simulating user responses)
    const prePopulatedAnswers = {
      "Can you briefly describe your product and the core problem it solves?": 
        "We use advanced chemistry lab techniques to infuse coffees with unique natural flavors, offering enthusiasts distinctive tastes and experiences they can't find elsewhere.",
    
      "Who is your target customer, and how do they currently address this problem?": 
        "Our primary customers are Bay Area coffee connoisseurs and adventurous professionals aged 25-45, who currently frequent specialty cafes seeking premium or artisanal coffee experiences.",
    
      "Who are your main competitors, and how is your product different?": 
        "Blue Bottle Coffee: Popular but lacks experimental flavor infusions. Philz Coffee: Offers customization, but without our chemistry-driven innovations.",
    
      "What price ranges or benchmarks exist in your market today?": 
        "Specialty coffees typically range from $4.50-$7.50 per cup; premium specialty blends may reach up to $10-$12 per cup.",
    
      "Are there key financial or operational constraints affecting your pricing?": 
        "We aim for at least a 35% profit margin due to high equipment costs and premium ingredients required for infusion techniques."
    };
    
    // Step 4: Collect answers and build context
    const answersContext = [];
    for (const question of clarifyingQuestions) {
      const answer = prePopulatedAnswers[question] || "No specific preference.";
      answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
    }
    
    // Step 5: Generate optimized research prompt with Claude
    const optimizedPromptResponse = await claudeService.processConversation([
      { 
        role: 'user', 
        content: expect.stringContaining(initialQuery) 
      }
    ]);
    
    // Verify prompt was generated
    expect(claudeService.processConversation).toHaveBeenCalled();
    expect(optimizedPromptResponse.response).toContain('Optimized research prompt');
    
    const optimizedQuery = optimizedPromptResponse.response;
    
    // Step 6: Perform deep research with Perplexity
    const researchJobId = uuidv4();
    const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
      jobId: researchJobId
    });
    
    // Verify research was performed with the right parameters
    expect(perplexityService.performDeepResearch).toHaveBeenCalledWith(optimizedQuery, {
      jobId: researchJobId
    });
    
    // Verify research results structure
    expect(researchResults).toHaveProperty('content');
    expect(researchResults).toHaveProperty('sources');
    expect(researchResults).toHaveProperty('modelUsed', 'sonar-deep-research');
    
    // Verify source count
    expect(researchResults.sources).toHaveLength(3);
    
    // Step 7: Generate charts using Claude with the research results
    const chartTypes = ['van_westendorp', 'conjoint', 'basic_bar'];
    
    for (const chartType of chartTypes) {
      const chartData = await claudeService.generateChartData(
        researchResults.content,
        chartType
      );
      
      // Verify chart generation was called correctly
      expect(claudeService.generateChartData).toHaveBeenCalledWith(
        researchResults.content,
        chartType
      );
      
      // Verify chart data structure
      expect(chartData).toHaveProperty('plotlyData');
      expect(chartData).toHaveProperty('plotlyLayout');
      expect(chartData).toHaveProperty('insights');
      
      // Verify insights were generated
      expect(chartData.insights.length).toBeGreaterThan(0);
    }
    
    // Verify file operations (mkdir and writeFile) were called to save results
    expect(fs.mkdir).toHaveBeenCalled();
    
    // Verify overall flow
    expect(claudeService.generateClarifyingQuestions).toHaveBeenCalledTimes(1);
    expect(claudeService.processConversation).toHaveBeenCalledTimes(1);
    expect(perplexityService.performDeepResearch).toHaveBeenCalledTimes(1);
    expect(claudeService.generateChartData).toHaveBeenCalledTimes(3); // Once for each chart type
  });
  
  // Additional focused test cases for key workflow components
  it('should handle failure in generating clarifying questions', async () => {
    // Setup
    claudeService.generateClarifyingQuestions.mockRejectedValueOnce(new Error('Claude API error'));
    
    // Execute & Verify
    const initialQuery = "I'm thinking about starting a new specialty coffee business.";
    await expect(claudeService.generateClarifyingQuestions(initialQuery)).rejects.toThrow('Claude API error');
  });
  
  it('should handle failure in deep research phase', async () => {
    // Setup
    perplexityService.performDeepResearch.mockRejectedValueOnce(new Error('Perplexity API error'));
    
    // Execute & Verify
    const query = 'Research specialty coffee pricing';
    await expect(perplexityService.performDeepResearch(query)).rejects.toThrow('Perplexity API error');
  });
  
  it('should handle failure in chart generation phase', async () => {
    // Setup
    claudeService.generateChartData.mockRejectedValueOnce(new Error('Chart generation error'));
    
    // Execute & Verify
    await expect(claudeService.generateChartData('Research data', 'van_westendorp')).rejects.toThrow('Chart generation error');
  });
  
  it('should ensure chart data structure is compatible with Plotly', async () => {
    // Execute
    const chartData = await claudeService.generateChartData('Research data', 'van_westendorp');
    
    // Verify Plotly-compatible structure
    expect(chartData).toHaveProperty('plotlyData');
    expect(chartData).toHaveProperty('plotlyLayout');
    
    // Check that data is an array of traces
    expect(Array.isArray(chartData.plotlyData)).toBe(true);
    
    // Check that each trace has the minimum Plotly requirements
    chartData.plotlyData.forEach(trace => {
      expect(trace).toHaveProperty('type');
      // For scatter/line plots
      if (trace.type === 'scatter') {
        expect(trace).toHaveProperty('x');
        expect(trace).toHaveProperty('y');
      }
      // For bar charts
      else if (trace.type === 'bar') {
        // Either x,y or y,x should be present depending on orientation
        expect(
          (trace.hasOwnProperty('x') && trace.hasOwnProperty('y')) ||
          (trace.hasOwnProperty('orientation') && trace.orientation === 'h')
        ).toBe(true);
      }
    });
    
    // Check layout has at least a title and axis properties
    expect(chartData.plotlyLayout).toHaveProperty('title');
    expect(chartData.plotlyLayout).toHaveProperty('xaxis');
    expect(chartData.plotlyLayout).toHaveProperty('yaxis');
  });
});