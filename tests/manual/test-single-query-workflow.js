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
const initialQuery = "What are the current market pricing models for subscription SaaS products in the productivity space?";

// Pre-populated answers to clarifying questions (mimicking user responses)
const prePopulatedAnswers = {
  "What specific industry or niche within the productivity space are you interested in?": 
    "Task and project management software for small to medium businesses.",

  "Are you more interested in B2B or B2C pricing models?": 
    "Primarily B2B with some consideration for prosumers/small teams.",

  "What price range are you considering for your product?": 
    "Thinking about tiered pricing with a free tier, $15/user/month for pro, and $35/user/month for enterprise.",

  "Are you interested in specific pricing strategies like flat-rate, usage-based, or seat-based pricing?": 
    "Interested in comparing seat-based vs. usage-based models, with a focus on feature differentiation between tiers.",

  "Would you like examples from specific leading companies in the space?": 
    "Yes, particularly interested in Asana, ClickUp, Monday.com and other project management tools."
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

    // Step 3: Combine initial query with answers to form a comprehensive research query
    const enhancedQuery = `
${initialQuery}

Additional context from user:
${answersContext.join("\n\n")}

Based on all the above information, provide a comprehensive analysis of SaaS pricing models 
in the productivity space, focusing on task and project management software.
Include specific examples from leading companies and provide detailed insights on tiered pricing strategies.
`;

    console.log("\nPrepared enhanced query with all context. Ready to send to Perplexity.");

    // Step 4: Perform a single deep research query with the enhanced context
    console.log("\nPerforming deep research with Perplexity (single API call)...");
    console.time("Deep Research");
    const researchJobId = uuidv4();
    const researchResults = await perplexityService.performDeepResearch(enhancedQuery, {
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
        enhancedQuery,
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