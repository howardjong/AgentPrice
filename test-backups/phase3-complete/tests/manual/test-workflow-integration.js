
/**
 * Test script for the end-to-end workflow integration:
 * 1. Perform deep research with Perplexity
 * 2. Generate interactive Plotly charts with Claude
 */

import { initiateResearch, getResearchStatus } from '../../services/researchService.js';
import claudeService from '../../services/claudeService.js';
import logger from '../../utils/logger.js';

// Sample data for testing
const samplePriceQuery = `
What are the current market pricing models for subscription SaaS products in the productivity space?
Focus on tiered pricing strategies, freemium models, and enterprise pricing.
Include specific examples of successful companies and their pricing structure.
`;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWorkflowIntegration() {
  try {
    console.log('Starting end-to-end workflow integration test...');
    
    // Step 1: Initiate deep research with Perplexity
    console.log('Initiating deep research...');
    const research = await initiateResearch(samplePriceQuery, {
      generateCharts: ['van_westendorp', 'conjoint']
    });
    
    console.log(`Research job initiated with ID: ${research.jobId}`);
    
    // Step 2: Poll for job completion
    let status = await getResearchStatus(research.jobId);
    console.log(`Initial job status: ${status.status}`);
    
    while (status.status !== 'completed' && status.status !== 'failed') {
      console.log(`Job status: ${status.status}, progress: ${status.progress || 0}%`);
      await delay(5000); // Check every 5 seconds
      status = await getResearchStatus(research.jobId);
    }
    
    if (status.status === 'failed') {
      throw new Error(`Research job failed: ${status.error || 'Unknown error'}`);
    }
    
    console.log('Research job completed successfully!');
    
    // Step 3: Get the research results
    const results = status.returnvalue;
    console.log('Research results summary:');
    console.log(`- Query: ${results.query}`);
    console.log(`- Content length: ${results.content.length} characters`);
    console.log(`- Sources: ${results.sources.length} sources`);
    
    // Step 4: Check if charts were generated
    if (results.charts && Object.keys(results.charts).length > 0) {
      console.log('\nCharts generated:');
      for (const [chartType, chartData] of Object.entries(results.charts)) {
        console.log(`- ${chartType}: ${chartData.error ? 'Error: ' + chartData.error : 'Success'}`);
      }
    } else {
      console.log('\nNo charts were generated');
    }
    
    // Step 5: Generate a Plotly visualization directly from the research data
    console.log('\nGenerating Plotly visualization from research content...');
    
    const plotlyResult = await claudeService.generatePlotlyVisualization(
      { researchContent: results.content },
      'bar',
      'SaaS Pricing Analysis',
      'Analysis of pricing models in the SaaS productivity space'
    );
    
    console.log('Plotly visualization generated successfully!');
    console.log(`- Model used: ${plotlyResult.modelUsed}`);
    console.log(`- Number of insights: ${plotlyResult.insights.length}`);
    console.log('- First insight:', plotlyResult.insights[0]);
    
    console.log('\nEnd-to-end workflow integration test completed successfully!');
  } catch (error) {
    console.error('Error in workflow integration test:', error);
  }
}

// Run the test
testWorkflowIntegration();
