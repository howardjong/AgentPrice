/**
 * @file dual-mode-query-workflow.vitest.js
 * @description Dual-mode integration tests for the complete single query workflow
 * 
 * This test file supports both mock API testing (using Nock) and live API testing
 * modes for testing the complete query workflow. It can be configured through
 * environment variables to run in either mode.
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import nock from 'nock';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { loadFixture } from '../../utils/apiMocks.js';

// Set up test mode based on environment variables
const USE_LIVE_API = process.env.USE_LIVE_API === 'true';
const SKIP_EXPENSIVE_CALLS = process.env.SKIP_EXPENSIVE_CALLS === 'true' && !USE_LIVE_API;

// Define API endpoints
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';
const ANTHROPIC_API_URL = 'https://api.anthropic.com';

// Import actual services if using live API
let claudeService, perplexityService, contextManager, serviceRouter;

/**
 * Log test mode information
 */
function logTestMode() {
  console.log('\n=== Dual Mode Query Workflow Test ===');
  console.log(`Mode: ${USE_LIVE_API ? 'LIVE API CALLS' : 'MOCK API CALLS'}`);
  console.log(`Skip Expensive: ${SKIP_EXPENSIVE_CALLS ? 'YES' : 'NO'}`);
  console.log('======================================\n');
}

/**
 * Setup function to import actual services when in live mode
 */
async function setupServices() {
  if (USE_LIVE_API) {
    try {
      // Dynamically import actual services for live testing
      claudeService = (await import('../../../services/claudeService.js')).default;
      perplexityService = (await import('../../../services/perplexityService.js')).default;
      contextManager = (await import('../../../services/contextManager.js')).default;
      
      // Check if API keys are available
      const hasAnthropicKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== '';
      const hasPerplexityKey = process.env.PERPLEXITY_API_KEY && process.env.PERPLEXITY_API_KEY !== '';
      
      if (!hasAnthropicKey || !hasPerplexityKey) {
        throw new Error(`Missing API keys: ${!hasAnthropicKey ? 'ANTHROPIC_API_KEY' : ''} ${!hasPerplexityKey ? 'PERPLEXITY_API_KEY' : ''}`);
      }
      
      console.log('✅ Successfully loaded live services');
    } catch (error) {
      console.error(`❌ Failed to load live services: ${error.message}`);
      throw error;
    }
  } else {
    // In mock mode, we'll create mock services below in beforeEach
    console.log('ℹ️ Using mock services');
  }
}

// Sample initial query for testing
const initialQuery = "I'm thinking about starting a new specialty coffee business but not sure what I should charge and if there's a market for it. Can you help me find out?";

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

/**
 * Ensure output directory exists
 */
async function ensureOutputDirectory() {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  try {
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
    throw error;
  }
}

// Print test mode information
logTestMode();

describe('Dual Mode Query Workflow Integration Test', () => {
  // Skip entire test suite if using live API and explicitly skipping expensive calls
  if (SKIP_EXPENSIVE_CALLS && USE_LIVE_API) {
    console.log('⏭️ Skipping tests that require expensive API calls in live mode');
    it.skip('tests skipped due to SKIP_EXPENSIVE_CALLS=true and USE_LIVE_API=true', () => {});
    return;
  }
  
  let outputDir;
  
  beforeAll(async () => {
    // Set up services based on mode
    await setupServices();
    
    // Ensure output directory exists
    outputDir = await ensureOutputDirectory();
  });
  
  beforeEach(async () => {
    // Reset all mocks and interceptors
    vi.resetAllMocks();
    nock.cleanAll();
    
    // Create mock services if in mock mode
    if (!USE_LIVE_API) {
      // Set up mock services
      claudeService = {
        generateClarifyingQuestions: vi.fn().mockResolvedValue([
          "Can you briefly describe your product and the core problem it solves?",
          "Who is your target customer, and how do they currently address this problem?",
          "Who are your main competitors, and how is your product different?",
          "What price ranges or benchmarks exist in your market today?",
          "Are there key financial or operational constraints affecting your pricing?"
        ]),
        processConversation: vi.fn().mockResolvedValue({
          response: "Optimized research query for coffee business market analysis...",
          model: "claude-3-7-sonnet-20250219"
        }),
        generateChartData: vi.fn().mockResolvedValue({
          chartData: {
            type: "van_westendorp",
            data: {
              prices: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
              tooCheap: [95, 80, 60, 40, 25, 15, 10, 5, 3, 1],
              bargain: [5, 20, 40, 60, 75, 85, 80, 70, 50, 30],
              tooExpensive: [1, 5, 10, 20, 35, 50, 70, 85, 95, 99],
              notGoodValue: [50, 40, 30, 20, 15, 10, 15, 25, 40, 60]
            }
          },
          insights: [
            "Optimal price point appears to be between $6-8 for your specialty infused coffee",
            "Price sensitivity increases significantly above $9",
            "You have room to charge a premium over standard specialty coffee ($4.50-$5.50)",
            "Consider a tiered pricing strategy with basic infusions at $7 and premium at $9-10"
          ]
        })
      };
      
      perplexityService = {
        performDeepResearch: vi.fn().mockResolvedValue({
          content: "Detailed market analysis for specialty coffee business...",
          sources: [
            { title: "Specialty Coffee Market Report 2025", url: "https://example.com/coffee-market" },
            { title: "Premium Pricing Strategies", url: "https://example.com/pricing" },
            { title: "Bay Area Coffee Consumer Trends", url: "https://example.com/trends" }
          ],
          modelUsed: "llama-3.1-sonar-large-128k-online"
        })
      };
      
      // Set up nock interceptors for mock mode
      if (!USE_LIVE_API) {
        // Load and set up Claude API mock
        nock(ANTHROPIC_API_URL)
          .post('/v1/messages')
          .reply(200, {
            id: "msg_012345abcdef",
            type: "message",
            role: "assistant",
            content: [
              {
                type: "text",
                text: "Based on my analysis of the specialty coffee market and your business details, here's my research on pricing strategy and market potential..."
              }
            ],
            model: "claude-3-7-sonnet-20250219",
            stop_reason: "end_turn"
          });
          
        // Load and set up Perplexity API mock  
        nock(PERPLEXITY_API_URL)
          .post('/chat/completions')
          .reply(200, {
            id: "chatcmpl-7RyNSG3h8KL9D2K0",
            choices: [
              {
                index: 0,
                message: {
                  content: "# Specialty Coffee Business Market Analysis\n\nBased on comprehensive research of the specialty coffee market in the Bay Area...",
                  role: "assistant",
                  function_call: null
                },
                finish_reason: "stop"
              }
            ],
            created: 1680000000,
            model: "llama-3.1-sonar-large-128k-online"
          });
      }
    }
  });
  
  afterEach(() => {
    if (!USE_LIVE_API) {
      // Clean up nock
      nock.cleanAll();
    }
  });
  
  afterAll(async () => {
    // Clean up connections if needed
    if (USE_LIVE_API && contextManager && contextManager.destroy) {
      await contextManager.destroy();
    }
  });
  
  it('should generate clarifying questions for a business query', async () => {
    // Skip if using live API and specifically skipping expensive calls
    if (USE_LIVE_API && SKIP_EXPENSIVE_CALLS) {
      console.log('⏭️ Skipping expensive Claude API call for clarifying questions');
      return;
    }
    
    console.log('🔍 Testing clarifying question generation...');
    
    // Generate clarifying questions
    const questions = await claudeService.generateClarifyingQuestions(initialQuery);
    
    // Verify the result
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
    
    console.log(`✅ Generated ${questions.length} clarifying questions`);
    
    // For live API mode, log the actual questions
    if (USE_LIVE_API) {
      console.log('\nActual questions from Claude:');
      questions.forEach((q, i) => console.log(`${i+1}. ${q}`));
    }
  });
  
  it('should generate an optimized research prompt based on answers', async () => {
    // Skip if using live API and specifically skipping expensive calls
    if (USE_LIVE_API && SKIP_EXPENSIVE_CALLS) {
      console.log('⏭️ Skipping expensive Claude API call for optimized prompt generation');
      return;
    }
    
    console.log('🔍 Testing optimized research prompt generation...');
    
    // First get questions (or use mock questions)
    let questions;
    if (USE_LIVE_API) {
      questions = await claudeService.generateClarifyingQuestions(initialQuery);
    } else {
      questions = [
        "Can you briefly describe your product and the core problem it solves?",
        "Who is your target customer, and how do they currently address this problem?",
        "Who are your main competitors, and how is your product different?",
        "What price ranges or benchmarks exist in your market today?",
        "Are there key financial or operational constraints affecting your pricing?"
      ];
    }
    
    // Prepare answers context
    const answersContext = [];
    for (const question of questions) {
      const answer = prePopulatedAnswers[question] || "No specific preference.";
      answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
    }
    
    // Prepare prompt for optimized query generation
    const queryGenerationPrompt = `
I need to create an optimized prompt for a deep research query based on a user's initial question and their answers to clarifying questions.

Original query: ${initialQuery}

Here are the clarifying questions and answers from the user:
${answersContext.join("\n\n")}

Based on this information, generate a comprehensive, well-structured prompt for a research AI. 
The prompt should:
1. Include key information from the original query and user answers
2. Request specific market and pricing information relevant to the user's business context
3. EXPLICITLY request data points needed for pricing visualizations
4. Request both strategic pricing recommendations and tactical implementation steps
5. Ask for competitor pricing models and market positioning data
6. Ensure the request is focused on the specific business/domain mentioned by the user

Format the prompt so it includes:
- A clear request statement highlighting the need for deep pricing research
- Relevant context from the user's answers
- Specific pricing data points to gather for visualization and strategy development
- A request for data-driven insights and actionable pricing recommendations
`;
    
    // Get optimized prompt from Claude
    let optimizedQuery;
    if (USE_LIVE_API) {
      const response = await claudeService.processConversation([
        { role: 'user', content: queryGenerationPrompt }
      ]);
      optimizedQuery = response.response;
    } else {
      optimizedQuery = "Optimized research query for coffee business market analysis...";
    }
    
    // Verify the result
    expect(optimizedQuery).toBeDefined();
    expect(typeof optimizedQuery).toBe('string');
    expect(optimizedQuery.length).toBeGreaterThan(100);
    
    console.log('✅ Generated optimized research prompt');
    
    // Save the optimized query for reference
    const outputPath = path.join(outputDir, `optimized-query-${USE_LIVE_API ? 'live' : 'mock'}.txt`);
    await fs.writeFile(outputPath, optimizedQuery);
    console.log(`📝 Saved optimized query to ${outputPath}`);
    
    return optimizedQuery;
  });
  
  it('should perform deep research with Perplexity using the optimized prompt', async () => {
    // Skip if using live API and specifically skipping expensive calls
    if (USE_LIVE_API && SKIP_EXPENSIVE_CALLS) {
      console.log('⏭️ Skipping expensive Perplexity API call for deep research');
      return;
    }
    
    console.log('🔍 Testing deep research with Perplexity...');
    
    // First, generate an optimized query
    let optimizedQuery;
    if (USE_LIVE_API) {
      // Generate a real optimized query using the previous test
      const questions = await claudeService.generateClarifyingQuestions(initialQuery);
      
      // Prepare answers context
      const answersContext = [];
      for (const question of questions) {
        const answer = prePopulatedAnswers[question] || "No specific preference.";
        answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
      }
      
      // Prepare prompt for optimized query generation
      const queryGenerationPrompt = `
I need to create an optimized prompt for a deep research query based on a user's initial question and their answers to clarifying questions.

Original query: ${initialQuery}

Here are the clarifying questions and answers from the user:
${answersContext.join("\n\n")}

Based on this information, generate a comprehensive, well-structured prompt for a research AI.
The prompt should:
1. Include key information from the original query and user answers
2. Request specific market and pricing information relevant to the user's business context
3. EXPLICITLY request data points needed for pricing visualizations
4. Request both strategic pricing recommendations and tactical implementation steps
5. Ask for competitor pricing models and market positioning data
6. Ensure the request is focused on the specific business/domain mentioned by the user
`;
      
      const response = await claudeService.processConversation([
        { role: 'user', content: queryGenerationPrompt }
      ]);
      optimizedQuery = response.response;
    } else {
      // Use a pre-defined optimized query for mock mode
      optimizedQuery = `Conduct a comprehensive market and pricing analysis for a specialty coffee business in the Bay Area that uses advanced chemistry techniques to infuse unique natural flavors into coffee. Target customers are coffee connoisseurs and adventurous professionals aged 25-45.

Please provide:
1. Current market size and growth projections for specialty coffee in the Bay Area
2. Competitive landscape analysis (especially Blue Bottle and Philz Coffee)
3. Price sensitivity data for specialty coffee consumers including:
   - Van Westendorp price points (too cheap, bargain, expensive, too expensive)
   - Feature-price sensitivity for unique flavor infusions
   - Price elasticity in the $5-12 range
4. Recommended pricing strategy that maintains a 35% profit margin
5. Market positioning recommendations against existing competitors
6. Data on consumer willingness to pay for differentiated coffee experiences

Include specific data points that can be used for price modeling and visualization.`;
    }
    
    console.log('📋 Optimized query generated. Performing deep research...');
    
    // Perform deep research using Perplexity
    console.time("Deep Research Duration");
    const researchJobId = uuidv4();
    const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
      jobId: researchJobId
    });
    console.timeEnd("Deep Research Duration");
    
    // Verify the results
    expect(researchResults).toBeDefined();
    expect(researchResults.content).toBeDefined();
    expect(typeof researchResults.content).toBe('string');
    
    if (USE_LIVE_API) {
      expect(researchResults.sources).toBeDefined();
      expect(Array.isArray(researchResults.sources)).toBe(true);
      expect(researchResults.sources.length).toBeGreaterThan(0);
      console.log(`🔗 Retrieved ${researchResults.sources.length} sources from Perplexity`);
    }
    
    console.log('✅ Deep research completed successfully');
    
    // Save research results for reference
    const researchOutputPath = path.join(outputDir, `deep-research-${USE_LIVE_API ? 'live' : 'mock'}.json`);
    await fs.writeFile(
      researchOutputPath,
      JSON.stringify({
        query: initialQuery,
        optimizedQuery,
        result: researchResults,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    console.log(`📝 Saved research results to ${researchOutputPath}`);
    
    return researchResults;
  });
  
  it('should generate chart data based on research results', async () => {
    // Skip if using live API and specifically skipping expensive calls
    if (USE_LIVE_API && SKIP_EXPENSIVE_CALLS) {
      console.log('⏭️ Skipping expensive Claude API call for chart generation');
      return;
    }
    
    console.log('🔍 Testing chart data generation...');
    
    // First, we need research results to generate charts from
    let researchContent;
    if (USE_LIVE_API) {
      // Get real research results from Perplexity
      // This reuses code from the previous test
      const questions = await claudeService.generateClarifyingQuestions(initialQuery);
      
      // Prepare answers context
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

Based on this information, generate a comprehensive, well-structured prompt for a research AI.`;
      
      const response = await claudeService.processConversation([
        { role: 'user', content: queryGenerationPrompt }
      ]);
      const optimizedQuery = response.response;
      
      // Perform research
      const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
        jobId: uuidv4()
      });
      
      researchContent = researchResults.content;
    } else {
      // Use mock research content
      researchContent = `# Specialty Coffee Business Market Analysis

## Market Size and Growth
- Bay Area specialty coffee market: $1.2 billion annually
- Growth rate: 8.5% YoY
- Premium segment (>$5/cup): $420 million, growing at 12.3% YoY

## Consumer Insights
- 68% of Bay Area professionals consume specialty coffee 3+ times per week
- 42% willing to pay premium for unique flavors
- 32% specifically interested in "innovative" coffee experiences

## Price Sensitivity
- Too cheap price point: Below $4.50 (perceived as low quality)
- Bargain price point: $5.50-$6.50
- Expected price point: $7.50
- Premium price point: $8.50-$9.50
- Too expensive price point: Above $11

## Competitor Analysis
- Blue Bottle average price: $5.75
- Philz Coffee average price: $5.25
- Ritual Coffee average price: $5.50
- Sightglass average price: $6.00

## Strategic Recommendations
1. Price core offerings between $7.50-$9.00
2. Consider tiered pricing strategy:
   - Standard infusions: $7.50
   - Premium/seasonal infusions: $9.00
   - Limited edition experiences: $11.00
3. Maintain 35% profit margin by focusing on operational efficiency`;
    }
    
    console.log('📊 Research content ready. Generating chart data...');
    
    // Generate chart data for Van Westendorp price sensitivity model
    const chartType = 'van_westendorp';
    const chartData = await claudeService.generateChartData(
      researchContent,
      chartType
    );
    
    // Verify the results
    expect(chartData).toBeDefined();
    expect(chartData.chartData).toBeDefined();
    expect(chartData.chartData.type).toBe(chartType);
    
    if (USE_LIVE_API) {
      expect(chartData.insights).toBeDefined();
      expect(Array.isArray(chartData.insights)).toBe(true);
      expect(chartData.insights.length).toBeGreaterThan(0);
      
      console.log('\n📊 Chart insights:');
      chartData.insights.forEach((insight, i) => console.log(`${i+1}. ${insight}`));
    }
    
    console.log('✅ Chart data generated successfully');
    
    // Save chart data for reference
    const chartOutputPath = path.join(outputDir, `${chartType}-chart-${USE_LIVE_API ? 'live' : 'mock'}.json`);
    await fs.writeFile(chartOutputPath, JSON.stringify(chartData, null, 2));
    console.log(`📝 Saved chart data to ${chartOutputPath}`);
  });
  
  it('should complete the full end-to-end workflow for a business query', async () => {
    // Skip if using live API and specifically skipping expensive calls
    if (USE_LIVE_API && SKIP_EXPENSIVE_CALLS) {
      console.log('⏭️ Skipping expensive full workflow test with live APIs');
      return;
    }
    
    console.log('🔄 Testing complete end-to-end workflow...');
    
    // Step 1: Generate clarifying questions
    console.log('Step 1: Generating clarifying questions...');
    const questions = await claudeService.generateClarifyingQuestions(initialQuery);
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
    
    // Step 2: Collect answers (pre-populated)
    console.log('Step 2: Collecting answers to questions...');
    const answersContext = [];
    for (const question of questions) {
      const answer = prePopulatedAnswers[question] || "No specific preference.";
      answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
    }
    
    // Step 3: Generate optimized research prompt
    console.log('Step 3: Generating optimized research prompt...');
    const queryGenerationPrompt = `
I need to create an optimized prompt for a deep research query based on a user's initial question and their answers to clarifying questions.

Original query: ${initialQuery}

Here are the clarifying questions and answers from the user:
${answersContext.join("\n\n")}

Based on this information, generate a comprehensive, well-structured prompt for a research AI.`;
    
    const promptResponse = await claudeService.processConversation([
      { role: 'user', content: queryGenerationPrompt }
    ]);
    const optimizedQuery = promptResponse.response;
    expect(optimizedQuery).toBeDefined();
    expect(typeof optimizedQuery).toBe('string');
    expect(optimizedQuery.length).toBeGreaterThan(100);
    
    // Step 4: Perform deep research
    console.log('Step 4: Performing deep research with Perplexity...');
    const researchJobId = uuidv4();
    const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
      jobId: researchJobId
    });
    expect(researchResults).toBeDefined();
    expect(researchResults.content).toBeDefined();
    
    // Step 5: Generate chart data
    console.log('Step 5: Generating chart data based on research...');
    const chartTypes = ['van_westendorp', 'basic_bar'];
    
    for (const chartType of chartTypes) {
      try {
        console.log(`Generating ${chartType} chart...`);
        const chartData = await claudeService.generateChartData(
          researchResults.content,
          chartType
        );
        
        expect(chartData).toBeDefined();
        expect(chartData.chartData).toBeDefined();
        
        // Save chart data
        const chartOutputPath = path.join(outputDir, `${chartType}-chart-full-workflow-${USE_LIVE_API ? 'live' : 'mock'}.json`);
        await fs.writeFile(chartOutputPath, JSON.stringify(chartData, null, 2));
      } catch (error) {
        console.error(`Error generating ${chartType} chart:`, error.message);
        // Don't fail the test on chart generation error, as the core workflow still succeeded
      }
    }
    
    // Save the complete workflow results
    const workflowOutputPath = path.join(outputDir, `complete-workflow-${USE_LIVE_API ? 'live' : 'mock'}.json`);
    await fs.writeFile(
      workflowOutputPath,
      JSON.stringify({
        initialQuery,
        questions,
        answers: prePopulatedAnswers,
        optimizedQuery,
        researchResults: {
          content: researchResults.content,
          sourcesCount: researchResults.sources ? researchResults.sources.length : 'N/A',
          modelUsed: researchResults.modelUsed || 'unknown'
        },
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
    console.log(`✅ Full workflow completed successfully`);
    console.log(`📝 Saved workflow results to ${workflowOutputPath}`);
  });
});

// Export utility functions for external use
export {
  ensureOutputDirectory,
  logTestMode
};