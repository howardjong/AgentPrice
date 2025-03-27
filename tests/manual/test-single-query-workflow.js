/**
 * Test script for optimized workflow integration:
 * 1. Generate clarifying questions with Claude
 * 2. Pre-populate answers to the questions (mimicking user responses)
 * 3. Perform a single deep research with Perplexity using all context
 * 4. Generate interactive Plotly charts with Claude
 */

import claudeService from '../../services/claudeService.js';
import perplexityService from '../../services/perplexityService.js';
import logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Set up output directory
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'output');

async function ensureOutputDirectory() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    logger.error(`Error creating output directory: ${error.message}`);
  }
}

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

async function runSingleQueryWorkflow() {
  console.log("\n==== STARTING OPTIMIZED SINGLE QUERY WORKFLOW TEST ====\n");
  await ensureOutputDirectory();

  try {
    // Step 1: Generate clarifying questions with Claude
    console.log("Generating clarifying questions with Claude...");
    const clarifyingQuestions = await claudeService.generateClarifyingQuestions(initialQuery);
    console.log(`Generated ${clarifyingQuestions.length} clarifying questions:`);
    clarifyingQuestions.forEach((q, i) => console.log(`${i+1}. ${q}`));

    // Step 2: In a real scenario, we would get answers from the user
    // Here we use pre-populated answers to simulate user responses
    console.log("\nCollecting answers to clarifying questions (pre-populated):");
    const answersContext = [];

    for (const question of clarifyingQuestions) {
      const answer = prePopulatedAnswers[question] || "No specific preference.";
      console.log(`Q: ${question}`);
      console.log(`A: ${answer}`);
      answersContext.push(`Question: ${question}\nAnswer: ${answer}`);
    }

    // Step 3: Use Claude to generate an optimized research prompt based on the initial query and answers
    console.log("\nUsing Claude to generate an optimized research prompt...");

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

    // Call Claude to generate the optimized research query
    console.log("\nCalling Claude to generate an optimized research query...");
    const response = await claudeService.processConversation([
      { role: 'user', content: queryGenerationPrompt }
    ]);
    const optimizedQuery = response.response;

    console.log("\nReceived enhanced query from Claude:");
    console.log("------------------------");
    console.log(optimizedQuery);
    console.log("------------------------");
    console.log("\nPrepared enhanced query with all context. Ready to send to Perplexity.");

    // Step 4: Perform a single deep research query with the enhanced context
    console.log("\nPerforming deep research with Perplexity (single API call)...");
    console.time("Deep Research");
    const researchJobId = uuidv4();
    const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
      jobId: researchJobId
    });
    console.timeEnd("Deep Research");

    // Log research results
    console.log(`\nResearch completed successfully with ${researchResults.sources.length} sources`);
    console.log(`Model used: ${researchResults.modelUsed}`);

    // Save research results for future reference
    const researchOutputPath = path.join(OUTPUT_DIR, 'deep-research-results.json');
    await fs.writeFile(
      researchOutputPath,
      JSON.stringify({
        query: initialQuery,
        optimizedQuery,
        result: researchResults,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    console.log(`Research results saved to ${researchOutputPath}`);

    // Step 5: Generate charts using Claude with the research results
    console.log("\nGenerating Plotly visualizations with Claude...");

    const chartTypes = [
      'van_westendorp',
      'conjoint',
      'basic_bar'
    ];

    console.log(`Generating ${chartTypes.length} different chart types...`);

    for (const chartType of chartTypes) {
      console.log(`\nGenerating ${chartType} chart...`);
      try {
        const chartData = await claudeService.generateChartData(
          researchResults.content,
          chartType
        );

        // Save chart data
        const chartOutputPath = path.join(OUTPUT_DIR, `${chartType}-chart.json`);
        await fs.writeFile(chartOutputPath, JSON.stringify(chartData, null, 2));
        console.log(`${chartType} chart data saved to ${chartOutputPath}`);

        // Log insights
        if (chartData.insights && chartData.insights.length) {
          console.log(`\nInsights from ${chartType} chart:`);
          chartData.insights.forEach((insight, i) => console.log(`${i+1}. ${insight}`));
        }
      } catch (error) {
        console.error(`Error generating ${chartType} chart:`, error.message);
      }
    }

    console.log("\n==== SINGLE QUERY WORKFLOW TEST COMPLETED SUCCESSFULLY ====");
  } catch (error) {
    console.error("Error in single query workflow test:", error);
    logger.error(`Test failed: ${error.message}`);
  }
}

// Run the test
runSingleQueryWorkflow();