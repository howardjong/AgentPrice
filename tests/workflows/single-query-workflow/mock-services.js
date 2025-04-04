/**
 * Mock Services for Single Query Workflow Testing
 * 
 * This module provides mock implementations of the Claude and Perplexity
 * services for testing the single-query workflow without making actual API calls.
 * 
 * @module tests/workflows/single-query-workflow/mock-services
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Mock implementation of Claude service
 */
const mockClaudeService = {
  /**
   * Generate chart data from research content
   * @param {string} researchContent - Research content to extract data from
   * @param {string} chartType - Type of chart to generate data for
   * @returns {Promise<Object>} Chart data
   */
  generateChartData: async (researchContent, chartType) => {
    console.log(`[MOCK] Claude generating ${chartType} chart data from research content (${researchContent.length} chars)`);
    
    // Simulate processing time
    const processingTime = Math.min(500 + researchContent.length / 100, 3000);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Return appropriate mock data based on chart type
    switch (chartType) {
      case 'van_westendorp':
        return getMockVanWestendorpData(researchContent);
        
      case 'conjoint':
        return getMockConjointData(researchContent);
        
      case 'basic_bar':
      default:
        return getMockBarChartData(researchContent);
    }
  },
  
  /**
   * Generate Plotly visualization configuration
   * @param {Object} chartData - Data for the chart
   * @param {string} chartType - Type of chart to generate
   * @param {string} title - Chart title
   * @param {string} description - Chart description
   * @returns {Promise<Object>} Plotly configuration
   */
  generatePlotlyVisualization: async (chartData, chartType, title, description) => {
    console.log(`[MOCK] Claude generating ${chartType} Plotly visualization`);
    
    // Simulate processing time
    const processingTime = Math.min(300 + JSON.stringify(chartData).length / 100, 2000);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Generate appropriate mock Plotly config
    let plotlyConfig;
    
    switch (chartType) {
      case 'van_westendorp':
        plotlyConfig = getMockVanWestendorpPlotlyConfig(chartData, title);
        break;
        
      case 'conjoint':
        plotlyConfig = getMockConjointPlotlyConfig(chartData, title);
        break;
        
      case 'basic_bar':
      default:
        plotlyConfig = getMockBarChartPlotlyConfig(chartData, title);
        break;
    }
    
    // Add common properties
    plotlyConfig.modelUsed = 'claude-3-7-sonnet-20250219';
    plotlyConfig.insights = chartData.insights || [
      'First key insight about the data',
      'Second key insight about the data',
      'Third key insight about the data'
    ];
    
    return plotlyConfig;
  },
  
  /**
   * Process text with Claude
   * @param {string} prompt - Text prompt to process
   * @returns {Promise<Object>} Claude response
   */
  processText: async (prompt) => {
    console.log(`[MOCK] Claude processing text prompt (${prompt.length} chars)`);
    
    // Simulate processing time
    const processingTime = Math.min(200 + prompt.length / 10, 2000);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return {
      content: `Mock Claude response for prompt: "${prompt.substring(0, 50)}..."`,
      usage: { total_tokens: Math.floor(prompt.length / 4) }
    };
  },
  
  /**
   * Process a conversation with Claude
   * @param {Array} messages - Conversation messages
   * @returns {Promise<Object>} Claude response
   */
  processConversation: async (messages) => {
    console.log(`[MOCK] Claude processing conversation with ${messages.length} messages`);
    
    // Simulate processing time
    const processingTime = Math.min(300 + messages.length * 200, 2000);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return {
      content: 'Mock conversation response from Claude',
      response: 'Mock conversation response from Claude',
      usage: { total_tokens: messages.length * 50 }
    };
  },
  
  /**
   * Generate clarifying questions
   * @param {string} query - Initial query
   * @returns {Promise<Array>} List of clarifying questions
   */
  generateClarifyingQuestions: async (query) => {
    console.log(`[MOCK] Claude generating clarifying questions for: "${query}"`);
    
    // Simulate processing time
    const processingTime = Math.min(200 + query.length * 5, 1500);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return [
      "What is your specific use case or application?",
      "Are you looking for commercial or research-focused information?",
      "Do you have any specific technical requirements or constraints?",
      "What timeframe are you interested in (e.g., latest developments, future projections)?",
      "Are you interested in a particular region or global perspectives?"
    ];
  }
};

/**
 * Mock implementation of Perplexity service
 */
const mockPerplexityService = {
  /**
   * Perform deep research with Perplexity
   * @param {string} query - Research query
   * @param {Object} options - Research options
   * @returns {Promise<Object>} Research results
   */
  performDeepResearch: async (query, options = {}) => {
    const requestId = options.requestId || uuidv4();
    console.log(`[MOCK] Perplexity performing deep research [${requestId}]: "${query}"`);
    console.log(`[MOCK] Research options:`, JSON.stringify(options));
    
    // Determine research content length based on options
    const isDeepResearch = options.model?.includes('large') || options.model?.includes('huge');
    const contentLength = isDeepResearch ? 12000 : 6000;
    
    // Simulate processing time - deep research takes longer
    const processingTime = isDeepResearch 
      ? Math.min(2000 + query.length * 10, 8000)
      : Math.min(1000 + query.length * 5, 4000);
      
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Generate mock citations
    const numCitations = isDeepResearch ? 12 : 6;
    const citations = [];
    for (let i = 1; i <= numCitations; i++) {
      citations.push(`https://example.com/research-source-${i}`);
    }
    
    // Return mock research results
    return {
      content: getMockResearchContent(query, contentLength),
      citations: citations,
      followUpQuestions: [
        `What are the challenges in implementing ${query.split(' ').slice(0, 3).join(' ')}?`,
        `How do recent advances in ${query.split(' ').slice(-3).join(' ')} compare to previous approaches?`,
        `What are the economic implications of ${query.split(' ').slice(0, 4).join(' ')}?`
      ],
      model: options.model || 'llama-3.1-sonar-small-128k-online',
      requestId
    };
  },
  
  /**
   * Get health status of the Perplexity service
   * @returns {Object} Health status
   */
  getHealthStatus: () => {
    return {
      service: 'perplexity',
      status: 'available',
      circuitBreakerStatus: 'CLOSED',
      defaultModel: 'llama-3.1-sonar-small-128k-online',
      availableModels: {
        small: 'llama-3.1-sonar-small-128k-online',
        large: 'llama-3.1-sonar-large-128k-online',
        huge: 'llama-3.1-sonar-huge-128k-online'
      }
    };
  }
};

/**
 * Generate mock research content for testing
 * @param {string} query - Research query
 * @param {number} [length=6000] - Approximate length of content to generate
 * @returns {string} Mock research content
 */
function getMockResearchContent(query, length = 6000) {
  // Extract keywords from query
  const keywords = query.split(' ')
    .filter(word => word.length > 3)
    .map(word => word.replace(/[^a-zA-Z0-9]/g, ''));
    
  // Create content with sections based on query keywords
  let content = `# Comprehensive Research on ${query}\n\n`;
  
  // Introduction
  content += `## Introduction\n\n`;
  content += `This research explores the latest developments and insights regarding ${query}. `;
  content += `The following sections provide a detailed analysis of current trends, emerging technologies, and future prospects.\n\n`;
  
  // Generate sections based on keywords
  for (let i = 0; i < Math.min(keywords.length, 4); i++) {
    const keyword = keywords[i].charAt(0).toUpperCase() + keywords[i].slice(1);
    content += `## ${keyword} Analysis\n\n`;
    content += `Recent developments in ${keyword} demonstrate significant progress in this area. `;
    content += `Multiple studies have shown that ${keyword}-related technologies have advanced substantially in the past year. `;
    content += `Industry experts project continued growth and innovation in ${keyword} applications.\n\n`;
    content += `Key findings regarding ${keyword}:\n\n`;
    content += `- Finding 1 related to ${keyword}\n`;
    content += `- Finding 2 related to ${keyword}\n`;
    content += `- Finding 3 related to ${keyword}\n\n`;
  }
  
  // Add statistical section for chart data
  content += `## Statistical Analysis\n\n`;
  content += `Statistical analysis reveals important trends in ${query}:\n\n`;
  content += `1. Market share distribution shows Company A (34%), Company B (28%), Company C (22%), and others (16%)\n`;
  content += `2. Growth rates vary from 12% to 28% annually depending on the specific technology\n`;
  content += `3. Investment in research and development has increased by 45% over the past three years\n`;
  content += `4. Consumer adoption rates show significant regional variations\n\n`;
  
  // Add conclusion
  content += `## Conclusion\n\n`;
  content += `In conclusion, ${query} continues to evolve rapidly with new breakthroughs and applications emerging regularly. `;
  content += `The field presents both significant opportunities and challenges that will shape its development in the coming years. `;
  content += `Continued research and innovation will be essential to address current limitations and unlock the full potential of these technologies.\n\n`;
  
  // Pad content if needed
  while (content.length < length) {
    content += `Additional analysis shows that further research is needed to fully understand the implications and applications of ${query}. `;
    content += `Various stakeholders including researchers, industry leaders, and policymakers continue to explore this topic in depth. `;
  }
  
  return content.substring(0, length);
}

/**
 * Generate mock Van Westendorp chart data
 * @param {string} researchContent - Research content
 * @returns {Object} Chart data
 */
function getMockVanWestendorpData(researchContent) {
  return {
    data: {
      x_values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      too_cheap: [0.9, 0.8, 0.6, 0.4, 0.25, 0.15, 0.1, 0.05, 0.02, 0.01],
      bargain: [0.05, 0.15, 0.35, 0.6, 0.75, 0.6, 0.4, 0.25, 0.15, 0.05],
      expensive: [0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 0.8, 0.9, 0.95, 0.98],
      too_expensive: [0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.99],
      optimal_price_point: 50,
      indifference_price_point: 45,
      price_range: { min: 40, max: 60 }
    },
    insights: [
      "The optimal price point is approximately $50",
      "The acceptable price range is between $40 and $60",
      "Below $30, consumers begin to question product quality",
      "Price sensitivity increases significantly above $70"
    ],
    chart_title: "Van Westendorp Price Sensitivity Model"
  };
}

/**
 * Generate mock Conjoint Analysis chart data
 * @param {string} researchContent - Research content
 * @returns {Object} Chart data
 */
function getMockConjointData(researchContent) {
  return {
    data: {
      attributes: ["Price", "Quality", "Features", "Brand", "Support"],
      importance: [0.35, 0.25, 0.20, 0.15, 0.05],
      part_worths: {
        "Price": { "Low": 0.8, "Medium": 0.5, "High": 0.2 },
        "Quality": { "Low": 0.2, "Medium": 0.6, "High": 0.9 },
        "Features": { "Basic": 0.3, "Standard": 0.6, "Advanced": 0.8 },
        "Brand": { "Unknown": 0.3, "Known": 0.7, "Premium": 0.9 },
        "Support": { "Email": 0.4, "Phone": 0.7, "24/7": 0.9 }
      },
      optimal_combination: { 
        "Price": "Medium", 
        "Quality": "High", 
        "Features": "Standard", 
        "Brand": "Known", 
        "Support": "Phone" 
      }
    },
    insights: [
      "Price is the most important attribute at 35% importance",
      "Quality is the second most important attribute at 25% importance",
      "The optimal combination balances medium price with high quality",
      "Support has minimal impact on consumer decisions"
    ],
    chart_title: "Conjoint Analysis of Consumer Preferences"
  };
}

/**
 * Generate mock Bar Chart data
 * @param {string} researchContent - Research content
 * @returns {Object} Chart data
 */
function getMockBarChartData(researchContent) {
  return {
    data: {
      competitors: ["Company A", "Company B", "Your Company", "Company C", "Company D"],
      prices: [49.99, 39.99, 44.99, 59.99, 34.99],
      market_segments: ["Premium", "Mid-market", "Budget"],
      segment_price_ranges: {
        "Premium": { "min": 50.00, "max": 100.00 },
        "Mid-market": { "min": 35.00, "max": 49.99 },
        "Budget": { "min": 15.00, "max": 34.99 }
      }
    },
    insights: [
      "Company A is positioned in the mid-market segment with competitive pricing",
      "Company D offers the lowest price point but lacks premium features",
      "Your company's price point is near the upper end of the mid-market segment",
      "There's a significant price gap in the premium segment above Company C"
    ],
    chart_title: "Competitive Pricing Analysis"
  };
}

/**
 * Generate mock Plotly configuration for Van Westendorp chart
 * @param {Object} chartData - Chart data
 * @param {string} title - Chart title
 * @returns {Object} Plotly configuration
 */
function getMockVanWestendorpPlotlyConfig(chartData, title) {
  const data = chartData.data;
  
  return {
    plotlyConfig: {
      data: [
        {
          x: data.x_values,
          y: data.too_cheap,
          type: 'scatter',
          mode: 'lines',
          name: 'Too Cheap',
          line: { color: 'blue' }
        },
        {
          x: data.x_values,
          y: data.bargain,
          type: 'scatter',
          mode: 'lines',
          name: 'Bargain',
          line: { color: 'green' }
        },
        {
          x: data.x_values,
          y: data.expensive,
          type: 'scatter',
          mode: 'lines',
          name: 'Expensive',
          line: { color: 'orange' }
        },
        {
          x: data.x_values,
          y: data.too_expensive,
          type: 'scatter',
          mode: 'lines',
          name: 'Too Expensive',
          line: { color: 'red' }
        }
      ],
      layout: {
        title: title || 'Van Westendorp Price Sensitivity Model',
        xaxis: { title: 'Price ($)' },
        yaxis: { title: 'Cumulative Percentage', range: [0, 1] },
        legend: { x: 0, y: 1 },
        height: 600,
        width: 800
      },
      config: { responsive: true }
    },
    pricePoints: {
      optimalPrice: data.optimal_price_point,
      indifferencePrice: data.indifference_price_point,
      pointOfMarginalExpensiveness: data.price_range.max,
      pointOfMarginalCheapness: data.price_range.min
    }
  };
}

/**
 * Generate mock Plotly configuration for Conjoint Analysis chart
 * @param {Object} chartData - Chart data
 * @param {string} title - Chart title
 * @returns {Object} Plotly configuration
 */
function getMockConjointPlotlyConfig(chartData, title) {
  const data = chartData.data;
  
  return {
    plotlyConfig: {
      data: [
        {
          x: data.attributes,
          y: data.importance,
          type: 'bar',
          marker: {
            color: 'rgba(50, 171, 96, 0.7)',
            line: {
              color: 'rgba(50, 171, 96, 1.0)',
              width: 2
            }
          }
        }
      ],
      layout: {
        title: title || 'Conjoint Analysis - Attribute Importance',
        xaxis: { title: 'Attributes' },
        yaxis: { title: 'Importance', range: [0, 1] },
        bargap: 0.3,
        bargroupgap: 0.1,
        height: 500,
        width: 700
      },
      config: { responsive: true }
    },
    optimalCombination: data.optimal_combination
  };
}

/**
 * Generate mock Plotly configuration for Bar Chart
 * @param {Object} chartData - Chart data
 * @param {string} title - Chart title
 * @returns {Object} Plotly configuration
 */
function getMockBarChartPlotlyConfig(chartData, title) {
  const data = chartData.data;
  
  return {
    plotlyConfig: {
      data: [
        {
          x: data.competitors,
          y: data.prices,
          type: 'bar',
          marker: {
            color: ['#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A'],
          }
        }
      ],
      layout: {
        title: title || 'Competitive Pricing Analysis',
        xaxis: { title: 'Companies' },
        yaxis: { title: 'Price ($)' },
        bargap: 0.3,
        height: 500,
        width: 700
      },
      config: { responsive: true }
    }
  };
}

export {
  mockClaudeService,
  mockPerplexityService,
  getMockResearchContent,
  getMockVanWestendorpData,
  getMockConjointData,
  getMockBarChartData
};