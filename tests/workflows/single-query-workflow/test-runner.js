/**
 * Test Runner for Single Query Workflow
 * 
 * This module provides a unified test runner for the single-query workflow
 * that incorporates deep research and visualization generation. It supports
 * both mock-based testing and live API testing.
 * 
 * @module tests/workflows/single-query-workflow/test-runner
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

// Default output directory for test results
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'test-results', 'single-query-workflow');

/**
 * Initialize real services for live API testing
 * @returns {Object} Object containing initialized real service instances
 */
async function initializeRealServices() {
  // Dynamic imports to load the real services only when needed
  const claudeService = (await import('../../../services/claudeService.js')).default;
  const perplexityService = (await import('../../../services/perplexityService.js')).default;
  
  // Verify necessary API keys exist
  const missingKeys = [];
  if (!process.env.ANTHROPIC_API_KEY) missingKeys.push('ANTHROPIC_API_KEY');
  if (!process.env.PERPLEXITY_API_KEY) missingKeys.push('PERPLEXITY_API_KEY');
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing required API keys for live testing: ${missingKeys.join(', ')}`);
  }
  
  return {
    claude: claudeService,
    perplexity: perplexityService
  };
}

/**
 * Initialize mock services for CI/CD and development testing
 * @returns {Object} Object containing mock service instances
 */
function initializeMockServices() {
  // Load mocks
  const { mockClaudeService, mockPerplexityService } = require('./mock-services.js');
  
  return {
    claude: mockClaudeService,
    perplexity: mockPerplexityService
  };
}

/**
 * Save test results to a file for later analysis
 * @param {Object} results - Test results to save
 * @param {string} outputDir - Directory to save results in
 * @param {string} [filename] - Custom filename (defaults to timestamped filename)
 */
async function saveTestResults(results, outputDir, filename) {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    // Default filename with timestamp
    const defaultFilename = `test-results-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const outputPath = path.join(outputDir, filename || defaultFilename);
    
    // Save results
    await fs.writeFile(
      outputPath,
      JSON.stringify(results, null, 2)
    );
    
    console.log(`Test results saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving test results:', error);
    throw error;
  }
}

/**
 * Run a single-query workflow test with configurable options
 * 
 * @param {Object} options - Test configuration options
 * @param {boolean} [options.useRealAPIs=false] - Whether to use real APIs or mock services
 * @param {string} [options.query] - The research query to test with
 * @param {string} [options.visualizationType='basic_bar'] - Type of visualization to generate
 * @param {boolean} [options.enableDeepResearch=true] - Whether to use deep research mode
 * @param {boolean} [options.saveResults=false] - Whether to save test results to files
 * @param {string} [options.outputDir=DEFAULT_OUTPUT_DIR] - Directory to save results in
 * @returns {Promise<Object>} Test results
 */
async function testSingleQueryWorkflow({
  useRealAPIs = false,
  query = 'What are the latest advancements in renewable energy storage technologies in 2025?',
  visualizationType = 'basic_bar',
  enableDeepResearch = true,
  saveResults = false,
  outputDir = DEFAULT_OUTPUT_DIR
}) {
  const testId = uuidv4();
  console.log(`Starting single-query workflow test [${testId}]`);
  console.log(`Mode: ${useRealAPIs ? 'LIVE API' : 'MOCK'}`);
  console.log(`Query: "${query}"`);
  console.log(`Chart type: ${visualizationType}`);
  console.log(`Deep research: ${enableDeepResearch ? 'Enabled' : 'Disabled'}`);
  
  // Configure services based on mode
  let services;
  try {
    services = useRealAPIs 
      ? await initializeRealServices() 
      : initializeMockServices();
  } catch (error) {
    console.error('Failed to initialize services:', error);
    return {
      success: false,
      error: `Service initialization failed: ${error.message}`,
      testMode: useRealAPIs ? 'LIVE' : 'MOCK'
    };
  }
  
  try {
    // Track test metrics
    const metrics = {
      startTime: Date.now(),
      stages: {}
    };
    
    // Stage 1: Initial Deep Research
    console.log('Stage 1: Performing deep research...');
    metrics.stages.research = { start: Date.now() };
    
    const researchResults = await services.perplexity.performDeepResearch(query, {
      enableChunking: true,
      model: enableDeepResearch 
        ? 'llama-3.1-sonar-large-128k-online' 
        : 'llama-3.1-sonar-small-128k-online'
    });
    
    metrics.stages.research.end = Date.now();
    metrics.stages.research.duration = metrics.stages.research.end - metrics.stages.research.start;
    
    console.log(`Research completed in ${metrics.stages.research.duration}ms`);
    console.log(`Research content length: ${researchResults.content?.length || 0} characters`);
    console.log(`Sources: ${researchResults.citations?.length || 0}`);
    
    // Stage 2: Data Extraction for Visualization
    console.log('Stage 2: Extracting chart data...');
    metrics.stages.dataExtraction = { start: Date.now() };
    
    const chartData = await services.claude.generateChartData(
      researchResults.content,
      visualizationType
    );
    
    metrics.stages.dataExtraction.end = Date.now();
    metrics.stages.dataExtraction.duration = metrics.stages.dataExtraction.end - metrics.stages.dataExtraction.start;
    
    console.log(`Data extraction completed in ${metrics.stages.dataExtraction.duration}ms`);
    console.log(`Chart insights: ${chartData.insights?.length || 0}`);
    
    // Stage 3: Chart Generation
    console.log('Stage 3: Generating visualization...');
    metrics.stages.chartGeneration = { start: Date.now() };
    
    const chartTitle = `${query} - ${visualizationType.toUpperCase()} Chart`;
    const chartDescription = "Visualization based on deep research results";
    
    const plotlyConfig = await services.claude.generatePlotlyVisualization(
      chartData.data,
      visualizationType,
      chartTitle,
      chartDescription
    );
    
    metrics.stages.chartGeneration.end = Date.now();
    metrics.stages.chartGeneration.duration = metrics.stages.chartGeneration.end - metrics.stages.chartGeneration.start;
    
    console.log(`Chart generation completed in ${metrics.stages.chartGeneration.duration}ms`);
    
    // Calculate total duration
    metrics.endTime = Date.now();
    metrics.totalDuration = metrics.endTime - metrics.startTime;
    
    console.log(`Total test duration: ${metrics.totalDuration}ms`);
    
    // Assemble results
    const results = {
      testId,
      query,
      researchContent: researchResults.content,
      chartData,
      plotlyConfig,
      metrics,
      sources: researchResults.citations || [],
      testMode: useRealAPIs ? 'LIVE' : 'MOCK',
      success: true
    };
    
    // Optional: Save results to file for later analysis
    if (saveResults) {
      const resultPath = await saveTestResults(results, outputDir);
      results.resultPath = resultPath;
    }
    
    console.log(`Test completed successfully [${testId}]`);
    return results;
  } catch (error) {
    console.error(`Test failed [${testId}]:`, error);
    return {
      testId,
      success: false,
      error: error.message,
      errorDetails: error,
      testMode: useRealAPIs ? 'LIVE' : 'MOCK'
    };
  }
}

export {
  testSingleQueryWorkflow,
  initializeRealServices,
  initializeMockServices,
  saveTestResults
};

export default testSingleQueryWorkflow;