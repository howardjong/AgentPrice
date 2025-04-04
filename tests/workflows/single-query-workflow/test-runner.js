/**
 * Single Query Workflow Test Runner
 * 
 * This module provides a unified test runner that can execute workflow tests
 * in either mock or real API mode. It supports various test variants defined
 * in test-config.js and collects metrics for performance analysis.
 */

import { testVariants } from './test-config.js';
import MetricsCollector from './metrics-collector.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Initialize mock services for testing
 */
async function initializeMockServices() {
  const { mockClaudeService, mockPerplexityService } = await import('./mock-services.js');

  return {
    claude: mockClaudeService,
    perplexity: mockPerplexityService
  };
}

/**
 * Initialize real API services for testing
 * Note: Requires proper API keys in environment variables
 */
async function initializeRealServices() {
  // Dynamically import actual service modules
  const claudeServiceModule = await import('../../../services/claudeService.js');
  const perplexityServiceModule = await import('../../../services/perplexityService.js');

  // Get the default exports
  const claudeService = claudeServiceModule.default;
  const perplexityService = perplexityServiceModule.default;

  // Verify API keys are available
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!anthropicKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable');
  }

  if (!perplexityKey) {
    throw new Error('Missing PERPLEXITY_API_KEY environment variable');
  }

  return {
    claude: claudeService,
    perplexity: perplexityService
  };
}

/**
 * Run a workflow test with the specified variant and options
 */
async function runWorkflowTest(variantName = 'basic', options = {}) {
  // Get variant configuration
  const variant = testVariants[variantName] || testVariants.basic;

  // Initialize metrics collector
  const metrics = new MetricsCollector({
    variant: variantName,
    useRealAPIs: options.useRealAPIs,
    query: options.query || variant.defaultQuery,
    outputDir: options.outputDir
  });

  // Configure test parameters
  const useRealAPIs = options.useRealAPIs || false;
  const query = options.query || variant.defaultQuery;
  const visualizationType = options.visualizationType || variant.visualizationType;
  const enableDeepResearch = options.hasOwnProperty('enableDeepResearch') 
    ? options.enableDeepResearch 
    : variant.enableDeepResearch;
  const saveResults = options.hasOwnProperty('saveResults') 
    ? options.saveResults 
    : variant.saveResults;
  const timeout = options.timeout || 30000; // Default to 30 seconds if not specified

  try {
    // Configure services based on mode
    metrics.startStage('initialization');
    const services = useRealAPIs 
      ? await initializeRealServices() 
      : await initializeMockServices();
    metrics.endStage('initialization');

    console.log(`Running test variant "${variantName}" in ${useRealAPIs ? 'REAL API' : 'MOCK'} mode`);
    console.log(`Query: "${query}"`);

    // Stage 1: Initial Deep Research
    metrics.startStage('research');

    const researchOptions = {
      enableChunking: variant.enableChunking || true,
      model: enableDeepResearch 
        ? 'llama-3.1-sonar-large-128k-online' 
        : 'llama-3.1-sonar-small-128k-online',
      followupQuestions: variant.followupQuestions || false,
      timeout: timeout // Add the timeout parameter
    };

    const researchResults = await services.perplexity.performDeepResearch(
      query, 
      researchOptions
    );

    // Record API usage if available
    if (researchResults.usage) {
      metrics.recordTokenUsage(
        'perplexity',
        researchOptions.model,
        researchResults.usage.prompt_tokens,
        researchResults.usage.completion_tokens,
        researchResults.usage.cost
      );
    }

    metrics.endStage('research');

    // Stage 2: Data Extraction for Visualization
    metrics.startStage('dataExtraction');

    const chartData = await services.claude.generateChartData(
      researchResults.content,
      visualizationType
    );

    // Record API usage if available
    if (chartData.usage) {
      metrics.recordTokenUsage(
        'claude',
        chartData.model || 'claude-3-haiku-20240307',
        chartData.usage.input_tokens,
        chartData.usage.output_tokens,
        chartData.usage.cost
      );
    }

    metrics.endStage('dataExtraction');

    // Stage 3: Chart Generation
    metrics.startStage('chartGeneration');

    const plotlyConfig = await services.claude.generatePlotlyVisualization(
      chartData.data,
      visualizationType,
      `${query} - ${visualizationType.toUpperCase()} Chart`,
      "Visualization based on deep research results"
    );

    // Record API usage if available
    if (plotlyConfig.usage) {
      metrics.recordTokenUsage(
        'claude',
        plotlyConfig.model || 'claude-3-haiku-20240307',
        plotlyConfig.usage.input_tokens,
        plotlyConfig.usage.output_tokens,
        plotlyConfig.usage.cost
      );
    }

    metrics.endStage('chartGeneration');

    // Complete metrics collection
    const testMetrics = metrics.complete();

    // Assemble results
    const results = {
      success: true,
      query,
      researchContent: researchResults.content,
      chartData,
      plotlyConfig,
      metrics: testMetrics,
      sources: researchResults.citations || [],
      testMode: useRealAPIs ? 'REAL_API' : 'MOCK',
      variant: variantName,
      variantName: variant.name
    };

    // Save metrics
    if (saveResults) {
      metrics.startStage('savingResults');

      // Save metrics file
      const metricsResult = await metrics.saveMetrics();
      if (metricsResult) {
        results.metricsPath = metricsResult.path;
      }

      // Save full test results if requested
      if (options.saveFullResults) {
        const outputDir = options.outputDir || path.join(process.cwd(), 'test-results', 'single-query-workflow');
        await fs.mkdir(outputDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const resultPath = path.join(outputDir, `${variantName}-results-${timestamp}.json`);

        await fs.writeFile(
          resultPath,
          JSON.stringify(results, null, 2)
        );

        results.resultPath = resultPath;
      }

      metrics.endStage('savingResults');
    }

    return results;
  } catch (error) {
    console.error('Test failed:', error);

    // Record error in metrics
    metrics.recordError('workflow', error);
    const testMetrics = metrics.complete();

    // Try to save error metrics
    let metricsPath = null;
    if (options.saveResults) {
      const metricsResult = await metrics.saveMetrics(`${variantName}-error-${Date.now()}.json`);
      if (metricsResult) {
        metricsPath = metricsResult.path;
      }
    }

    return {
      success: false,
      error: error.message,
      errorDetails: error,
      testMode: useRealAPIs ? 'REAL_API' : 'MOCK',
      metrics: testMetrics,
      metricsPath
    };
  }
}

export {
  runWorkflowTest,
  initializeMockServices,
  initializeRealServices
};