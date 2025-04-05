/**
 * Verification test for the deep research workflow
 * This script tests the complete workflow from Perplexity deep research to Claude chart generation
 */

const perplexityService = require('../../services/perplexityService');
const claudeService = require('../../services/claudeService');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'output');
const TEST_QUERY = process.argv[2] || "What are the key pricing strategies used by premium children's summer camps in Vancouver for 2025?";
const CHART_TYPE = 'van_westendorp'; // Options: van_westendorp, conjoint, basic_bar
const ENABLE_DEEP_RESEARCH = true;

// Create test unique identifier to track the process
const testId = uuidv4().substring(0, 8);

async function ensureOutputDirectory() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Ensured output directory exists: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
    throw error;
  }
}

async function saveResultToFile(data, filename) {
  try {
    const filePath = path.join(OUTPUT_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Results saved to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving results to file: ${error.message}`);
    throw error;
  }
}

async function verifyDeepResearchWorkflow() {
  console.log(`\n===== Deep Research Workflow Verification Test (ID: ${testId}) =====`);
  console.log(`Query: "${TEST_QUERY}"`);
  console.log(`Chart type: ${CHART_TYPE}`);
  console.log(`Deep research enabled: ${ENABLE_DEEP_RESEARCH}`);

  const metrics = {
    startTime: Date.now(),
    stages: {}
  };

  try {
    await ensureOutputDirectory();

    // Step 1: Perform deep research using Perplexity API
    console.log("\n--- Step 1: Performing Deep Research ---");
    metrics.stages.research = { start: Date.now() };

    console.log("Calling Perplexity API...");
    const researchResults = await perplexityService.performDeepResearch(TEST_QUERY, testId, {
      enableDeepResearch: ENABLE_DEEP_RESEARCH
    });

    metrics.stages.research.end = Date.now();
    metrics.stages.research.duration = metrics.stages.research.end - metrics.stages.research.start;
    console.log(`Deep research completed in ${(metrics.stages.research.duration / 1000).toFixed(1)}s`);
    console.log(`Model requested: ${researchResults.requestedModel}`);
    console.log(`Model used: ${researchResults.modelUsed}`);
    console.log(`Content length: ${researchResults.content.length} characters`);
    console.log(`Sources found: ${researchResults.sources.length}`);

    // Save the research results
    await saveResultToFile(researchResults, `deep-research-results-${testId}.json`);

    // Step 2: Generate chart data using Claude API
    console.log("\n--- Step 2: Generating Chart Data with Claude ---");
    metrics.stages.chartData = { start: Date.now() };

    console.log("Calling Claude API to generate chart data...");
    const chartData = await claudeService.generateChartData(
      researchResults.content,
      CHART_TYPE
    );

    metrics.stages.chartData.end = Date.now();
    metrics.stages.chartData.duration = metrics.stages.chartData.end - metrics.stages.chartData.start;
    console.log(`Chart data generation completed in ${(metrics.stages.chartData.duration / 1000).toFixed(1)}s`);
    console.log(`Chart data generated with ${Object.keys(chartData.data).length} data points`);
    console.log(`Insights generated: ${chartData.insights.length}`);

    // Save the chart data
    await saveResultToFile(chartData, `${CHART_TYPE}-chart-${testId}.json`);

    // Step 3: Generate Plotly visualization with Claude API
    console.log("\n--- Step 3: Generating Plotly Visualization ---");
    metrics.stages.plotly = { start: Date.now() };

    console.log("Calling Claude API to generate Plotly configuration...");
    const plotlyConfig = await claudeService.generatePlotlyVisualization(
      chartData.data,
      CHART_TYPE,
      `${TEST_QUERY} - ${CHART_TYPE.toUpperCase()} Chart`,
      "Based on deep research results"
    );

    metrics.stages.plotly.end = Date.now();
    metrics.stages.plotly.duration = metrics.stages.plotly.end - metrics.stages.plotly.start;
    console.log(`Plotly configuration generation completed in ${(metrics.stages.plotly.duration / 1000).toFixed(1)}s`);

    // Save the Plotly configuration
    const plotlyFile = await saveResultToFile(plotlyConfig, `${CHART_TYPE}_plotly-${testId}.json`);

    // Calculate total metrics
    metrics.endTime = Date.now();
    metrics.totalDuration = metrics.endTime - metrics.startTime;

    // Save the complete workflow results
    const workflowResults = {
      testId,
      query: TEST_QUERY,
      chartType: CHART_TYPE,
      enableDeepResearch: ENABLE_DEEP_RESEARCH,
      metrics,
      perplexityModel: researchResults.modelUsed,
      sourcesCount: researchResults.sources.length,
      success: true
    };

    await saveResultToFile(workflowResults, `workflow-results-${testId}.json`);

    // Print verification summary
    console.log("\n===== Workflow Verification Summary =====");
    console.log(`Total workflow duration: ${(metrics.totalDuration / 1000).toFixed(1)}s`);
    console.log(`Research time: ${(metrics.stages.research.duration / 1000).toFixed(1)}s`);
    console.log(`Chart data generation time: ${(metrics.stages.chartData.duration / 1000).toFixed(1)}s`);
    console.log(`Plotly visualization time: ${(metrics.stages.plotly.duration / 1000).toFixed(1)}s`);
    console.log(`Perplexity model used: ${researchResults.modelUsed}`);
    console.log(`Deep research enabled: ${ENABLE_DEEP_RESEARCH}`);
    console.log(`Chart type: ${CHART_TYPE}`);
    console.log(`Output files saved to: ${OUTPUT_DIR}`);
    console.log(`View the chart: You can view the chart by loading the chart viewer`);
    console.log(`\nWorkflow verification completed successfully! ✅`);

    return true;
  } catch (error) {
    console.error("\n❌ Workflow verification failed:", error);

    // Save the error report
    const errorReport = {
      testId,
      query: TEST_QUERY,
      chartType: CHART_TYPE,
      enableDeepResearch: ENABLE_DEEP_RESEARCH,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      metrics,
      success: false
    };

    try {
      await saveResultToFile(errorReport, `workflow-error-${testId}.json`);
    } catch (saveError) {
      console.error("Error saving error report:", saveError);
    }

    console.log("\n===== Error Summary =====");
    console.log(`Error message: ${error.message}`);
    console.log(`Error occurred after ${((Date.now() - metrics.startTime) / 1000).toFixed(1)}s`);
    console.log(`Error report saved to: ${path.join(OUTPUT_DIR, `workflow-error-${testId}.json`)}`);
    console.log("\nPlease check the error report and logs for details.\n");

    return false;
  }
}

// Run the verification if this script is executed directly
if (require.main === module) {
  verifyDeepResearchWorkflow()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error("Unhandled error in verification script:", error);
      process.exit(1);
    });
}

module.exports = { verifyDeepResearchWorkflow };