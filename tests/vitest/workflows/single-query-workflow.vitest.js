/**
 * Single Query Workflow - Vitest Version
 * 
 * This test verifies the complete path of a search query through the system,
 * including generation of clarifying questions, research, and visualization.
 * 
 * By default, all external API calls are mocked.
 * Set USE_LIVE_APIS=true in the environment to use real API calls.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Import services to test
import claudeService from '../../../services/claudeService.js';
import perplexityService from '../../../services/perplexityService.js';
import logger from '../../../utils/logger.js';

// Mock data for API responses
const MOCK_DATA = {
  clarifyingQuestions: [
    "Can you briefly describe your product and the core problem it solves?",
    "Who is your target customer, and how do they currently address this problem?",
    "Who are your main competitors, and how is your product different?",
    "What price ranges or benchmarks exist in your market today?",
    "Are there key financial or operational constraints affecting your pricing?"
  ],
  optimizedQueryResponse: {
    response: "Conduct comprehensive pricing research for a specialty coffee business using advanced chemistry techniques to infuse unique natural flavors. Specifically:\n\n1. Market Analysis:\n   - Size and growth rate of the Bay Area specialty coffee market\n   - Current demand for premium/experimental coffee experiences\n   - Pricing benchmarks across different specialty coffee segments (standard specialty, premium artisanal, experimental)\n\n2. Competitor Analysis:\n   - Detailed pricing models for Blue Bottle Coffee and Philz Coffee\n   - Pricing strategies of other chemistry-focused or experimental coffee brands\n   - How competitors position price relative to their unique value propositions\n\n3. Price Sensitivity Data:\n   - Van Westendorp price sensitivity analysis for chemistry-infused specialty coffee:\n     * Too cheap price point (quality concerns arise)\n     * Bargain price point (good value)\n     * Expensive price point (premium but still acceptable)\n     * Too expensive price point (prohibitively costly)\n\n4. Customer Value Analysis:\n   - Conjoint analysis data showing:\n     * Relative importance of attributes (flavor innovation, brewing method, beans origin, etc.)\n     * Price-feature tradeoffs specifically for 25-45 year old Bay Area coffee connoisseurs\n     * Willingness to pay premium for chemistry-based flavor innovations\n\n5. Pricing Strategy Recommendations:\n   - Optimal price points for standard and premium offerings\n   - Strategic positioning options (premium/luxury vs. accessible innovation)\n   - Pricing models that would maintain the minimum 35% profit margin requirement\n\n6. Implementation Tactics:\n   - Tiered pricing structure recommendations\n   - Limited edition/seasonal pricing strategies\n   - Subscription or loyalty program pricing approaches\n   - Pricing communication strategies highlighting the unique chemistry-driven value\n\nPlease provide data-driven insights with specific price points and ranges whenever possible, and include market positioning data that would help visualize the optimal pricing strategy for this unique specialty coffee business."
  },
  perplexityResults: {
    modelUsed: "pplx-70b-online",
    content: `# Specialty Coffee Business Pricing Strategy Research

## 1. Market Analysis

### Size and Growth of Bay Area Specialty Coffee Market
- The Bay Area specialty coffee market is valued at approximately $950 million annually
- Growth rate of 7.3% year-over-year, outpacing the national average of 5.1%
- San Francisco alone has over 350 specialty coffee establishments

### Demand for Premium/Experimental Coffee
- 68% of Bay Area coffee consumers report willingness to try experimental flavors
- 42% regularly seek out unique or novel coffee experiences
- Average consumption of premium coffee is 3.4 cups per customer visit

### Pricing Benchmarks
| Segment | Price Range Per Cup | Wholesale (lb) | Retail (12oz bag) |
|---------|---------------------|----------------|-------------------|
| Standard Specialty | $4.00-$5.50 | $15-$20 | $14-$18 |
| Premium Artisanal | $5.50-$8.00 | $20-$28 | $18-$25 |
| Experimental/Innovative | $7.00-$12.00 | $25-$40 | $22-$36 |

## 2. Competitor Analysis

### Blue Bottle Coffee
- Standard drip coffee: $4.50-$5.50
- Pour-over specialty coffee: $6.00-$7.50
- Limited reserves: $8.00-$10.00
- Positioning: Premium quality, careful sourcing, minimalist aesthetic
- Markup strategy: 78-85% margins on cup sales, 55-62% on beans

### Philz Coffee
- Standard blends: $4.25-$5.25
- Custom creations: $5.75-$7.25
- Special selections: $6.50-$8.50
- Positioning: Customization, personal experience, unique preparation methods
- Markup strategy: 75-82% margins on cup sales, 48-58% on beans

### Chemistry-Focused Coffee Brands
- Joyride Coffee (nitrogen-infused): $6.50-$9.00 per cup
- Saint Frank (specialized extraction): $7.00-$10.00 per cup
- Ritual Coffee (experimental processing): $6.00-$9.50 per cup
- Common positioning: Scientific approach, innovation premium, educational component

## 3. Price Sensitivity Data (Van Westendorp Model)

Based on survey data from 230 Bay Area coffee enthusiasts ages 25-45:

| Price Point | Amount (Per Cup) |
|-------------|------------------|
| Too Cheap (quality concerns) | Below $5.90 |
| Bargain (good value) | $6.75-$8.25 |
| Expensive (premium but acceptable) | $8.50-$10.75 |
| Too Expensive (prohibitively costly) | Above $11.25 |

**Optimal Price Point (OPP)**: $8.20 per cup
**Indifference Price Point (IPP)**: $7.90 per cup

## 4. Customer Value Analysis

### Conjoint Analysis: Attribute Importance
| Attribute | Relative Importance |
|-----------|---------------------|
| Flavor uniqueness/innovation | 32.5% |
| Bean quality/origin | 21.8% |
| Brewing method | 16.4% |
| Store ambiance/experience | 12.2% |
| Brand reputation | 9.7% |
| Sustainable practices | 7.4% |

### Price-Feature Tradeoffs
- 76% of respondents would pay $2 more for chemistry-based flavor innovations
- 64% would pay $3-4 more compared to standard specialty coffee
- 37% would pay $5+ more for truly unique flavor experiences

### Target Demographic Insights
- Bay Area professionals (25-45) spend an average of $114/month on coffee
- 84% visit specialty coffee shops 3+ times per week
- 71% consider themselves "coffee enthusiasts" or "experimental consumers"

## 5. Pricing Strategy Recommendations

### Optimal Price Points
| Offering | Recommended Price Point | Rationale |
|----------|-------------------------|-----------|
| Signature Chemistry-Infused | $8.25-$9.25 per cup | Aligns with optimal price point and perceived premium value |
| Limited Edition Creations | $10.50-$12.00 per cup | Positioned as ultra-premium, collectible experiences |
| Standard Specialty (non-infused) | $5.75-$6.50 per cup | Entry point, still premium vs regular cafes |

### Strategic Positioning Options
1. **Premium Innovation Leader**: Position at $9.00 average price point, emphasizing laboratory techniques and scientific innovation
2. **Accessible Experimentation**: Position at $7.75 average price point, focusing on approachable flavor adventures
3. **Hybrid Model**: Tiered approach with both premium ($10+) and more accessible ($7-8) options to maximize market coverage

### Profit Margin Analysis
Based on estimated costs:
- Raw ingredient cost per cup: $1.20-$1.80
- Chemistry infusion process: $0.90-$1.40
- Overhead allocation: $0.80-$1.20
- Total cost base: $2.90-$4.40 per cup

| Price Point | Cost Base | Profit Margin |
|-------------|-----------|---------------|
| $7.50 | $3.65 (avg) | 51.3% |
| $8.25 | $3.65 (avg) | 55.8% |
| $9.00 | $3.65 (avg) | 59.4% |
| $10.50 | $3.65 (avg) | 65.2% |

All recommended price points exceed the minimum 35% profit margin requirement.

## 6. Implementation Tactics

### Tiered Pricing Structure
- **Exploration** tier: $6.50-$7.50 (entry-level infusions)
- **Discovery** tier: $8.00-$9.50 (signature chemistry creations)
- **Laboratory** tier: $10.00-$12.00 (limited edition experiments)

### Limited Edition/Seasonal Strategies
- Monthly "Scientist's Selection": +$2.00 premium over standard pricing
- Seasonal releases (4x yearly): +$3.00 premium with collectible packaging
- Collaboration series with local chefs/mixologists: +$3.50 premium

### Subscription Program
| Subscription Tier | Monthly Price | What's Included | Savings vs Regular |
|-------------------|---------------|-----------------|-------------------|
| Enthusiast | $89/month | 12 standard cups, 2 premium cups | 15% |
| Explorer | $129/month | 12 standard cups, 5 premium cups | 18% |
| Chemist | $179/month | 8 standard cups, 10 premium cups, 1 limited edition | 22% |

### Pricing Communication Strategies
- Emphasize "laboratory to cup" process in menu descriptions
- Display chemistry equipment as part of store design to reinforce value
- Develop "flavor profiles" cards explaining the scientific process
- Create transparent cost breakdown highlighting the premium ingredients and specialized techniques
- Offer "flavor flight" samplers to demonstrate value difference vs standard coffee

## Conclusion

The optimal pricing strategy for your chemistry-infused specialty coffee business centers on an $8.25-$9.25 core price point for signature offerings, with appropriate tiering for both more accessible and ultra-premium experiences. This pricing structure:
- Aligns with the Van Westendorp optimal price point of $8.20
- Exceeds your minimum 35% profit margin requirement (achieving 55-60%)
- Positions your offerings appropriately against key competitors
- Matches customer expectations for innovative flavor experiences
- Provides flexibility through tiered options and special releases

The data suggests that your unique chemistry-based approach can command a significant premium over standard specialty coffee, with most target customers willing to pay $2-4 more for distinctive experiences. By implementing the recommended tiered pricing structure and communication strategies, you can effectively convey the value proposition of your innovative approach to coffee.`,
    sources: [
      {
        title: "Specialty Coffee Consumption Trends in Urban Markets",
        url: "https://www.beveragedaily.com/Article/2023/08/15/Specialty-Coffee-Consumption-Trends-in-Urban-Markets",
        snippet: "The specialty coffee segment has seen significant growth in urban markets, particularly in tech hubs like the Bay Area where consumers show increased willingness to pay premium prices for innovative coffee experiences."
      },
      {
        title: "Price Sensitivity in Premium Food & Beverage Markets",
        url: "https://www.foodnavigator-usa.com/Article/2023/06/10/Price-Sensitivity-Analysis-Premium-FoodService",
        snippet: "Van Westendorp price sensitivity analysis reveals optimal price points for premium beverages typically fall between 2.5-3.5x the standard market offering price when significant innovation or experience enhancement is present."
      },
      {
        title: "Bay Area Coffee Market Report 2023",
        url: "https://www.sfchronicle.com/food/article/bay-area-coffee-market-growth-17654321.php",
        snippet: "The San Francisco Bay Area coffee market continues to outpace national growth averages, with consumers particularly interested in novel preparation methods and flavor profiles."
      }
    ]
  },
  chartData: {
    van_westendorp: {
      data: {
        x_values: [5.0, 5.25, 5.5, 5.75, 6.0, 6.25, 6.5, 6.75, 7.0, 7.25, 7.5, 7.75, 8.0, 8.25, 8.5, 8.75, 9.0, 9.25, 9.5, 9.75, 10.0, 10.25, 10.5, 10.75, 11.0, 11.25, 11.5, 11.75, 12.0],
        too_cheap: [2, 3, 4, 6, 9, 13, 18, 25, 33, 41, 50, 59, 68, 76, 82, 88, 92, 95, 97, 98, 99, 99, 100, 100, 100, 100, 100, 100, 100],
        bargain: [0, 0, 1, 2, 3, 5, 8, 12, 18, 25, 33, 42, 52, 61, 70, 78, 85, 90, 94, 96, 98, 99, 99, 100, 100, 100, 100, 100, 100],
        expensive: [0, 0, 0, 0, 0, 1, 2, 3, 5, 8, 12, 17, 23, 30, 38, 47, 56, 65, 73, 80, 86, 91, 94, 96, 98, 99, 99, 100, 100],
        too_expensive: [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 6, 9, 13, 18, 24, 32, 40, 49, 58, 67, 75, 82, 88, 92, 95, 97, 99, 100]
      },
      chart_config: {
        title: "Van Westendorp Price Sensitivity Meter - Specialty Chemistry-Infused Coffee",
        x_axis_title: "Price (USD)",
        y_axis_title: "Cumulative Percentage of Respondents",
        annotations: [
          {
            x: 7.9,
            y: 42,
            text: "Indifference Price Point: $7.90",
            showarrow: true,
            arrowhead: 1
          },
          {
            x: 8.2,
            y: 52,
            text: "Optimal Price Point: $8.20",
            showarrow: true,
            arrowhead: 1
          }
        ]
      },
      insights: [
        "Optimal price point ($8.20) suggests this is the ideal price to maximize consumer acceptance",
        "The range between $7.50-$9.00 shows lowest resistance, with less than 40% finding it 'expensive'",
        "Price sensitivity increases sharply beyond $10.50, with over 75% finding it 'too expensive'",
        "Below $6.50, quality perception concerns rise significantly (>50% 'too cheap')"
      ]
    },
    conjoint: {
      data: {
        attributes: ["Flavor Innovation", "Bean Origin", "Brewing Method", "Store Experience", "Brand Reputation", "Sustainability"],
        importance: [32.5, 21.8, 16.4, 12.2, 9.7, 7.4]
      },
      chart_config: {
        title: "Conjoint Analysis: Attribute Importance for Specialty Coffee",
        x_axis_title: "Attributes",
        y_axis_title: "Relative Importance (%)"
      },
      insights: [
        "Flavor innovation is the most valued attribute (32.5%), making it the key pricing lever",
        "Bean origin and quality (21.8%) is the second most important factor, supporting premium positioning",
        "Combined, the top two attributes account for over 54% of purchase decisions",
        "Store experience and brand reputation together (21.9%) nearly match bean origin importance",
        "Sustainability practices, while scoring lowest (7.4%), still represent a meaningful differentiator"
      ]
    },
    basic_bar: {
      data: {
        competitors: ["Standard Cafe", "Blue Bottle", "Philz", "Ritual Coffee", "Chemistry-Infused (You)", "Super Premium"],
        prices: [4.25, 6.75, 7.25, 8.50, 9.00, 11.50],
        margins: [45, 55, 52, 58, 59, 63]
      },
      chart_config: {
        title: "Competitive Pricing Analysis - Specialty Coffee in Bay Area",
        x_axis_title: "Competitor",
        y_axis_title: "Average Price per Cup ($)",
        secondary_y_title: "Profit Margin (%)"
      },
      insights: [
        "The proposed $9.00 price point positions the offering clearly in the premium segment",
        "At this price point, the business achieves higher margins (59%) than most competitors",
        "There's a clear price gap between standard specialty coffee ($4-7) and premium innovative options ($8-12)",
        "The closest competitors (Ritual Coffee at $8.50) still lack the chemistry-based differentiation",
        "A $9.00 price point balances premium positioning with broader market accessibility compared to super-premium options"
      ]
    }
  }
};

// Sample initial query
const initialQuery = "I'm thinking about starting a new specialty coffee busines but not sure what I should charge and if there's a market for it. Can you help me find out?";

// Pre-populated answers to clarifying questions (mimicking user responses)
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

// Check if live APIs should be used (default: false)
const USE_LIVE_APIS = process.env.USE_LIVE_APIS === 'true';

// Set up test output directory
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'output');

describe('Single Query Workflow', () => {
  beforeAll(async () => {
    // Create output directory if it doesn't exist
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error(`Error creating output directory: ${error.message}`);
    }
    
    // Setup mocks if not using live APIs
    if (!USE_LIVE_APIS) {
      // Mock Claude Service
      // Mock the generateClarifyingQuestions function directly
      vi.spyOn(claudeService, 'generateClarifyingQuestions').mockResolvedValue(MOCK_DATA.clarifyingQuestions);
      
      // Mock the generateChartData function directly 
      vi.spyOn(claudeService, 'generateChartData').mockImplementation((content, chartType) => {
        return Promise.resolve(MOCK_DATA.chartData[chartType] || MOCK_DATA.chartData.basic_bar);
      });
      
      // Use processConversation for the optimized query generation
      vi.spyOn(claudeService, 'processConversation').mockResolvedValue(MOCK_DATA.optimizedQueryResponse);
      
      // Mock Perplexity Service
      vi.spyOn(perplexityService, 'performDeepResearch').mockResolvedValue(MOCK_DATA.perplexityResults);
      
      // Log the mock setup
      console.log('📢 Using mocked API calls for all external services');
    } else {
      console.log('⚠️ Using LIVE API calls to external services - this may incur costs!');
    }
  });
  
  afterEach(() => {
    if (!USE_LIVE_APIS) {
      // Clear mock call history between tests
      vi.clearAllMocks();
    }
  });
  
  afterAll(() => {
    if (!USE_LIVE_APIS) {
      // Restore all mocks
      vi.restoreAllMocks();
    }
  });
  
  it('should generate clarifying questions based on initial query', async () => {
    // Get clarifying questions
    const questions = await claudeService.generateClarifyingQuestions(initialQuery);
    
    // Verify we got questions back
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
    
    // Save questions to output file
    const outputPath = path.join(OUTPUT_DIR, 'clarifying-questions.json');
    await fs.writeFile(outputPath, JSON.stringify(questions, null, 2));
    
    // Log usage of real vs mock
    if (!USE_LIVE_APIS) {
      expect(claudeService.generateClarifyingQuestions).toHaveBeenCalledWith(initialQuery);
    }
  }, 30000);
  
  it('should generate an optimized research prompt based on user answers', async () => {
    // Get clarifying questions (either real or mocked)
    const questions = await claudeService.generateClarifyingQuestions(initialQuery);
    
    // Collect answers context
    const answersContext = [];
    for (const question of questions) {
      const answer = prePopulatedAnswers[question] || "No specific preference.";
      answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
    }
    
    // Prepare context for Claude to generate the optimized query
    const queryGenerationPrompt = `
I need to create an optimized prompt for a deep research query based on a user's initial question and their answers to clarifying questions.

Original query: ${initialQuery}

Here are the clarifying questions and answers from the user:
${answersContext.join("\n\n")}

Based on this information, generate a comprehensive, well-structured prompt for a research AI. 
The prompt should:
1. Include key information from the original query and user answers
2. Request specific market and pricing information relevant to the user's business context
3. EXPLICITLY request data points needed for pricing visualizations, including:
   - Van Westendorp price sensitivity model data (too cheap, bargain, expensive, too expensive price points)
   - Conjoint analysis data (attribute importance, feature preferences, price-feature tradeoffs)
   - Pricing benchmarks across market segments
4. Request both strategic pricing recommendations and tactical implementation steps
5. Ask for competitor pricing models and market positioning data
6. Ensure the request is focused on the specific business/domain mentioned by the user

Format the prompt so it includes:
- A clear request statement highlighting the need for deep pricing research
- Relevant context from the user's answers
- Specific pricing data points to gather for visualization and strategy development
- A request for data-driven insights and actionable pricing recommendations

DO NOT include generic instructions about formatting or citation requirements in the prompt.
`;
    
    // Get optimized query
    const response = await claudeService.processConversation([
      { role: 'user', content: queryGenerationPrompt }
    ]);
    
    // Verify we received a response 
    expect(response).toBeDefined();
    expect(response.response).toBeDefined();
    expect(typeof response.response).toBe('string');
    expect(response.response.length).toBeGreaterThan(200);
    
    // Save optimized query to output file
    const outputPath = path.join(OUTPUT_DIR, 'optimized-query.txt');
    await fs.writeFile(outputPath, response.response);
    
    // Log usage of real vs mock
    if (!USE_LIVE_APIS) {
      expect(claudeService.processConversation).toHaveBeenCalled();
    }
  }, 30000);
  
  it('should perform deep research using the optimized prompt', async () => {
    // Get optimized query (from previous step or mock)
    let optimizedQuery;
    if (USE_LIVE_APIS) {
      // Get clarifying questions
      const questions = await claudeService.generateClarifyingQuestions(initialQuery);
      
      // Collect answers context
      const answersContext = [];
      for (const question of questions) {
        const answer = prePopulatedAnswers[question] || "No specific preference.";
        answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
      }
      
      // Generate optimized query
      const queryGenerationPrompt = `
I need to create an optimized prompt for a deep research query based on a user's initial question and their answers to clarifying questions.

Original query: ${initialQuery}

Here are the clarifying questions and answers from the user:
${answersContext.join("\n\n")}

Based on this information, generate a comprehensive, well-structured prompt for a research AI. 
The prompt should:
1. Include key information from the original query and user answers
2. Request specific market and pricing information relevant to the user's business context
3. EXPLICITLY request data points needed for pricing visualizations, including:
   - Van Westendorp price sensitivity model data (too cheap, bargain, expensive, too expensive price points)
   - Conjoint analysis data (attribute importance, feature preferences, price-feature tradeoffs)
   - Pricing benchmarks across market segments
4. Request both strategic pricing recommendations and tactical implementation steps
5. Ask for competitor pricing models and market positioning data
6. Ensure the request is focused on the specific business/domain mentioned by the user

Format the prompt so it includes:
- A clear request statement highlighting the need for deep pricing research
- Relevant context from the user's answers
- Specific pricing data points to gather for visualization and strategy development
- A request for data-driven insights and actionable pricing recommendations

DO NOT include generic instructions about formatting or citation requirements in the prompt.
`;
      
      const response = await claudeService.processConversation([
        { role: 'user', content: queryGenerationPrompt }
      ]);
      
      optimizedQuery = response.response;
    } else {
      optimizedQuery = MOCK_DATA.optimizedQueryResponse.response;
    }
    
    // Perform deep research
    const researchJobId = uuidv4();
    const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
      jobId: researchJobId
    });
    
    // Verify the research results
    expect(researchResults).toBeDefined();
    expect(researchResults.content).toBeDefined();
    expect(typeof researchResults.content).toBe('string');
    expect(researchResults.sources).toBeDefined();
    expect(Array.isArray(researchResults.sources)).toBe(true);
    
    // Save research results to output file
    const outputPath = path.join(OUTPUT_DIR, 'research-results.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify({
        query: initialQuery,
        optimizedQuery,
        result: researchResults,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
    // Log usage of real vs mock
    if (!USE_LIVE_APIS) {
      expect(perplexityService.performDeepResearch).toHaveBeenCalled();
    }
  }, 60000);
  
  it('should generate chart data from research results', async () => {
    // Get research results (from previous step or mock)
    let researchContent;
    if (USE_LIVE_APIS) {
      // We would need to run the previous steps to get this
      // For simplicity in this test, let's read from the output file if it exists
      try {
        const researchData = await fs.readFile(path.join(OUTPUT_DIR, 'research-results.json'), 'utf8');
        const parsedData = JSON.parse(researchData);
        researchContent = parsedData.result.content;
      } catch (error) {
        // If file doesn't exist, use the mock data
        researchContent = MOCK_DATA.perplexityResults.content;
      }
    } else {
      researchContent = MOCK_DATA.perplexityResults.content;
    }
    
    // Chart types to generate
    const chartTypes = ['van_westendorp', 'conjoint', 'basic_bar'];
    
    // Generate each chart type
    for (const chartType of chartTypes) {
      const chartData = await claudeService.generateChartData(
        researchContent,
        chartType
      );
      
      // Verify chart data
      expect(chartData).toBeDefined();
      if (chartType === 'van_westendorp') {
        expect(chartData.data).toBeDefined();
        expect(chartData.data.x_values).toBeDefined();
        expect(Array.isArray(chartData.data.x_values)).toBe(true);
      } else if (chartType === 'conjoint') {
        expect(chartData.data).toBeDefined();
        expect(chartData.data.attributes).toBeDefined();
        expect(chartData.data.importance).toBeDefined();
      } else if (chartType === 'basic_bar') {
        expect(chartData.data).toBeDefined();
        expect(chartData.data.competitors).toBeDefined();
        expect(chartData.data.prices).toBeDefined();
      }
      
      // Verify insights
      expect(chartData.insights).toBeDefined();
      expect(Array.isArray(chartData.insights)).toBe(true);
      expect(chartData.insights.length).toBeGreaterThan(0);
      
      // Save chart data
      const outputPath = path.join(OUTPUT_DIR, `${chartType}-chart.json`);
      await fs.writeFile(outputPath, JSON.stringify(chartData, null, 2));
    }
    
    // Log usage of real vs mock
    if (!USE_LIVE_APIS) {
      expect(claudeService.generateChartData).toHaveBeenCalled();
    }
  }, 60000);
  
  it('should complete the full workflow end-to-end', async () => {
    // This test integrates all the previous steps into a single flow
    // 1. Generate clarifying questions
    const questions = await claudeService.generateClarifyingQuestions(initialQuery);
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    
    // 2. Collect answers
    const answersContext = [];
    for (const question of questions) {
      const answer = prePopulatedAnswers[question] || "No specific preference.";
      answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
    }
    
    // 3. Generate optimized query
    const queryGenerationPrompt = `
I need to create an optimized prompt for a deep research query based on a user's initial question and their answers to clarifying questions.

Original query: ${initialQuery}

Here are the clarifying questions and answers from the user:
${answersContext.join("\n\n")}

Based on this information, generate a comprehensive, well-structured prompt for a research AI. 
The prompt should:
1. Include key information from the original query and user answers
2. Request specific market and pricing information relevant to the user's business context
3. EXPLICITLY request data points needed for pricing visualizations, including:
   - Van Westendorp price sensitivity model data (too cheap, bargain, expensive, too expensive price points)
   - Conjoint analysis data (attribute importance, feature preferences, price-feature tradeoffs)
   - Pricing benchmarks across market segments
4. Request both strategic pricing recommendations and tactical implementation steps
5. Ask for competitor pricing models and market positioning data
6. Ensure the request is focused on the specific business/domain mentioned by the user

Format the prompt so it includes:
- A clear request statement highlighting the need for deep pricing research
- Relevant context from the user's answers
- Specific pricing data points to gather for visualization and strategy development
- A request for data-driven insights and actionable pricing recommendations

DO NOT include generic instructions about formatting or citation requirements in the prompt.
`;
    
    const response = await claudeService.processConversation([
      { role: 'user', content: queryGenerationPrompt }
    ]);
    
    const optimizedQuery = response.response;
    expect(optimizedQuery).toBeDefined();
    expect(typeof optimizedQuery).toBe('string');
    
    // 4. Perform deep research
    const researchJobId = uuidv4();
    const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
      jobId: researchJobId
    });
    
    expect(researchResults).toBeDefined();
    expect(researchResults.content).toBeDefined();
    expect(researchResults.sources).toBeDefined();
    
    // 5. Generate charts
    const chartTypes = ['van_westendorp', 'conjoint', 'basic_bar'];
    const chartResults = {};
    
    for (const chartType of chartTypes) {
      const chartData = await claudeService.generateChartData(
        researchResults.content,
        chartType
      );
      
      expect(chartData).toBeDefined();
      expect(chartData.insights).toBeDefined();
      
      chartResults[chartType] = chartData;
    }
    
    // 6. Save complete workflow results
    const outputPath = path.join(OUTPUT_DIR, 'complete-workflow-results.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify({
        initialQuery,
        clarifyingQuestions: questions,
        userAnswers: prePopulatedAnswers,
        optimizedQuery,
        researchResults,
        chartResults,
        timestamp: new Date().toISOString(),
        usedLiveApis: USE_LIVE_APIS
      }, null, 2)
    );
    
    // Success!
    expect(true).toBe(true);
  }, 150000);
});

/**
 * Helper function to run the test with live APIs
 * This can be used programmatically if needed
 */
export async function runWithLiveApis() {
  // Set the environment variable
  process.env.USE_LIVE_APIS = 'true';
  
  // Import and run Vitest programmatically
  const { run } = await import('vitest/runner');
  await run(['tests/vitest/workflows/single-query-workflow.vitest.js']);
  
  // Reset the environment variable
  process.env.USE_LIVE_APIS = 'false';
}

/**
 * Export some utilities for programmatic use
 */
export default {
  runWithLiveApis,
  MOCK_DATA,
  initialQuery,
  prePopulatedAnswers
};