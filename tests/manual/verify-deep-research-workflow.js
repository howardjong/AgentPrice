
// Verification test for deep research workflow
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import services properly for ES modules
import * as perplexityService from '../../services/perplexityService.js';
import * as claudeService from '../../services/claudeService.js';

// Configure environment
dotenv.config();

// Get current directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'output');

async function ensureOutputDirExists() {
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Output directory ensured at ${outputDir}`);
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
  }
}

async function saveResults(filename, data) {
  try {
    const filePath = path.join(outputDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Results saved to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving results: ${error.message}`);
    return null;
  }
}

async function verifyDeepResearchWorkflow() {
  console.log('\n=== DEEP RESEARCH WORKFLOW VERIFICATION TEST ===\n');
  
  try {
    const metrics = {
      startTime: Date.now(),
      stages: {}
    };
    
    // Test query
    const query = "What are the current pricing strategies and models used by commercial day camps for elementary school children in Vancouver?";
    const jobId = uuidv4();
    
    console.log(`Test query: "${query}"`);
    console.log(`Job ID: ${jobId}`);
    
    // STAGE 1: Call Perplexity API with deep research model
    console.log('\n--- STAGE 1: Deep Research API Call ---\n');
    metrics.stages.research = { start: Date.now() };
    
    try {
      console.log('Calling Perplexity API with sonar-deep-research model...');
      const researchResults = await perplexityService.performDeepResearch(query, jobId);
      metrics.stages.research.end = Date.now();
      metrics.stages.research.duration = metrics.stages.research.end - metrics.stages.research.start;
      
      console.log(`\nResearch completed in ${(metrics.stages.research.duration / 1000).toFixed(2)} seconds`);
      console.log(`Content length: ${researchResults.content.length} characters`);
      console.log(`Number of sources: ${researchResults.sources.length}`);
      console.log(`Model used: ${researchResults.modelUsed}`);
      
      // Save research results
      const researchFilePath = await saveResults('deep-research-results.json', {
        query,
        content: researchResults.content,
        sources: researchResults.sources,
        modelUsed: researchResults.modelUsed,
        duration: metrics.stages.research.duration
      });
      
      // STAGE 2: Data Extraction for Visualization
      console.log('\n--- STAGE 2: Data Extraction for Visualization ---\n');
      metrics.stages.dataExtraction = { start: Date.now() };
      
      try {
        console.log('Generating chart data from research content...');
        const chartData = await claudeService.generateChartData(
          researchResults.content,
          'van_westendorp'
        );
        
        metrics.stages.dataExtraction.end = Date.now();
        metrics.stages.dataExtraction.duration = metrics.stages.dataExtraction.end - metrics.stages.dataExtraction.start;
        
        console.log(`\nData extraction completed in ${(metrics.stages.dataExtraction.duration / 1000).toFixed(2)} seconds`);
        console.log(`Chart type: van_westendorp`);
        console.log(`Number of insights: ${chartData.insights.length}`);
        
        // Save chart data
        const chartDataFilePath = await saveResults('van_westendorp-chart.json', chartData);
        
        // STAGE 3: Chart Generation
        console.log('\n--- STAGE 3: Chart Generation ---\n');
        metrics.stages.chartGeneration = { start: Date.now() };
        
        try {
          console.log('Generating Plotly visualization...');
          const plotlyConfig = await claudeService.generatePlotlyVisualization(
            chartData.data,
            'van_westendorp',
            `Pricing Strategy Analysis - Van Westendorp Chart`,
            "Visualization based on deep research results"
          );
          
          metrics.stages.chartGeneration.end = Date.now();
          metrics.stages.chartGeneration.duration = metrics.stages.chartGeneration.end - metrics.stages.chartGeneration.start;
          
          console.log(`\nChart generation completed in ${(metrics.stages.chartGeneration.duration / 1000).toFixed(2)} seconds`);
          
          // Save Plotly config
          const plotlyFilePath = await saveResults('van_westendorp_plotly.json', {
            plotlyConfig,
            insights: chartData.insights
          });
          
          // Calculate overall metrics
          metrics.endTime = Date.now();
          metrics.totalDuration = metrics.endTime - metrics.startTime;
          
          console.log('\n--- WORKFLOW VERIFICATION SUMMARY ---\n');
          console.log(`Total workflow duration: ${(metrics.totalDuration / 1000).toFixed(2)} seconds`);
          console.log(`Research: ${(metrics.stages.research.duration / 1000).toFixed(2)} seconds`);
          console.log(`Data extraction: ${(metrics.stages.dataExtraction.duration / 1000).toFixed(2)} seconds`);
          console.log(`Chart generation: ${(metrics.stages.chartGeneration.duration / 1000).toFixed(2)} seconds`);
          
          console.log('\nArtifacts generated:');
          console.log(`- Research results: ${researchFilePath}`);
          console.log(`- Chart data: ${chartDataFilePath}`);
          console.log(`- Plotly visualization: ${plotlyFilePath}`);
          
          console.log('\n=== DEEP RESEARCH WORKFLOW VERIFICATION COMPLETED SUCCESSFULLY ===\n');
          return true;
        } catch (error) {
          console.error('Error in Stage 3 (Chart Generation):', error.message);
          return false;
        }
      } catch (error) {
        console.error('Error in Stage 2 (Data Extraction):', error.message);
        return false;
      }
    } catch (error) {
      console.error('Error in Stage 1 (Deep Research):', error.message);
      console.error('Full error:', error);
      return false;
    }
  } catch (error) {
    console.error('Test script error:', error);
    return false;
  }
}

// Create a workflow to run the test
async function runTest() {
  try {
    // Ensure output directory exists
    await ensureOutputDirExists();
    
    // Run the workflow verification
    const success = await verifyDeepResearchWorkflow();
    
    if (success) {
      console.log('Verification test completed successfully!');
      process.exit(0);
    } else {
      console.error('Verification test failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error in test script:', error);
    process.exit(1);
  }
}

// Run the test
runTest();
