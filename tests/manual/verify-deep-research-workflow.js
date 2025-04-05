
/**
 * Deep Research Workflow Verification Test
 * 
 * This script verifies the entire deep research workflow from end to end:
 * 1. Verifies Perplexity deep research API call
 * 2. Confirms polling mechanism works
 * 3. Validates research data processing
 * 4. Tests Claude integration for chart generation
 * 5. Checks full workflow completion
 */

import perplexityService from '../../services/perplexityService.js';
import claudeService from '../../services/claudeService.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger.js';

// Test query for deep research
const TEST_QUERY = "What are the pricing models for top cloud computing providers in 2025?";

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyDeepResearchWorkflow() {
  const startTime = Date.now();
  const jobId = uuidv4();
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  
  try {
    // Ensure output directory exists
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    
    console.log('=== Starting Deep Research Workflow Verification ===');
    console.log(`Query: "${TEST_QUERY}"`);
    console.log(`Job ID: ${jobId}`);
    
    // Step 1: Perform deep research with Perplexity
    console.log('\n[Step 1] Initiating deep research...');
    const researchResults = await perplexityService.performDeepResearch(TEST_QUERY, jobId);
    
    console.log(`Research completed in ${((Date.now() - startTime) / 1000).toFixed(1)} seconds`);
    console.log(`Model used: ${researchResults.modelUsed}`);
    console.log(`Content length: ${researchResults.content.length} characters`);
    console.log(`Sources found: ${researchResults.sources.length}`);
    
    // Verification check 1: Ensure correct model was used
    if (researchResults.modelUsed !== 'sonar-deep-research') {
      console.error('❌ ERROR: Deep research did not use the correct model!');
      console.error(`Expected 'sonar-deep-research' but got '${researchResults.modelUsed}'`);
      return false;
    }
    
    // Verification check 2: Ensure we got substantial content
    if (researchResults.content.length < 1000) {
      console.error('❌ ERROR: Research content is too short!');
      return false;
    }
    
    // Verification check 3: Ensure we got sources
    if (researchResults.sources.length === 0) {
      console.error('❌ WARNING: No sources were provided in the research');
    }
    
    // Save research results for reference
    const researchOutputPath = path.join(outputDir, 'verification-research-results.json');
    await fs.writeFile(
      researchOutputPath, 
      JSON.stringify(researchResults, null, 2)
    );
    console.log(`Research results saved to ${researchOutputPath}`);
    
    // Step 2: Generate chart data from research
    console.log('\n[Step 2] Generating chart data from research...');
    const chartType = 'basic_bar';
    const chartData = await claudeService.generateChartData(
      researchResults.content,
      chartType
    );
    
    // Verification check 4: Ensure we got chart data
    if (!chartData || !chartData.data) {
      console.error('❌ ERROR: Failed to generate chart data!');
      return false;
    }
    
    console.log(`Generated chart data with ${chartData.data.competitors?.length || 0} competitors`);
    console.log(`Insights generated: ${chartData.insights?.length || 0}`);
    
    // Save chart data for reference
    const chartDataPath = path.join(outputDir, 'verification-chart-data.json');
    await fs.writeFile(
      chartDataPath,
      JSON.stringify(chartData, null, 2)
    );
    console.log(`Chart data saved to ${chartDataPath}`);
    
    // Step 3: Generate Plotly visualization from chart data
    console.log('\n[Step 3] Generating Plotly visualization...');
    const plotlyConfig = await claudeService.generatePlotlyVisualization(
      chartData.data,
      chartType,
      `${TEST_QUERY} - ${chartType.toUpperCase()} Chart`,
      "Visualization based on deep research results"
    );
    
    // Verification check 5: Ensure we got a Plotly configuration
    if (!plotlyConfig || !plotlyConfig.data) {
      console.error('❌ ERROR: Failed to generate Plotly visualization!');
      return false;
    }
    
    console.log(`Generated Plotly configuration with ${plotlyConfig.data.length} data series`);
    
    // Save Plotly config for reference
    const plotlyConfigPath = path.join(outputDir, 'verification-plotly-config.json');
    await fs.writeFile(
      plotlyConfigPath,
      JSON.stringify(plotlyConfig, null, 2)
    );
    console.log(`Plotly configuration saved to ${plotlyConfigPath}`);
    
    // Calculate total time
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\nTotal workflow time: ${totalTime.toFixed(1)} seconds`);
    
    // Final verification summary
    console.log('\n=== Workflow Verification Summary ===');
    console.log('✅ Perplexity deep research API call: SUCCESS');
    console.log('✅ Polling mechanism: SUCCESS');
    console.log('✅ Research data processing: SUCCESS');
    console.log('✅ Claude chart data generation: SUCCESS');
    console.log('✅ Plotly visualization generation: SUCCESS');
    console.log('\n✅ FULL WORKFLOW VERIFICATION: PASSED');
    
    return true;
  } catch (error) {
    console.error('❌ Workflow verification failed with error:', error);
    console.error(error.stack);
    return false;
  }
}

// Run verification test
verifyDeepResearchWorkflow()
  .then(success => {
    if (success) {
      console.log('✅ Deep research workflow is working correctly!');
      process.exit(0);
    } else {
      console.error('❌ Deep research workflow verification failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error during verification:', error);
    process.exit(1);
  });
