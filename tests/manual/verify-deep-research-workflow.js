
import { performance } from 'node:perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import services
import perplexityService from '../../services/perplexityService.js';
import claudeService from '../../services/claudeService.js';

const outputDir = path.join(__dirname, '..', 'output');

async function ensureOutputDirectory() {
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Ensured output directory exists: ${outputDir}`);
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
  }
}

async function saveOutput(filename, data) {
  try {
    const filePath = path.join(outputDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved output to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving output: ${error.message}`);
    return null;
  }
}

async function verifyDeepResearchWorkflow() {
  console.log("\n=== Deep Research Workflow Verification ===\n");
  const results = {
    success: false,
    steps: {},
    timing: {},
    errors: []
  };
  
  try {
    // Step 1: Make sure output directory exists
    await ensureOutputDirectory();
    
    // Step 2: Perform deep research with Perplexity API
    console.log("\n[Step 1] Performing deep research with Perplexity API...");
    results.timing.researchStart = performance.now();
    
    const query = "What are the latest developments in quantum computing in 2025?";
    console.log(`Query: "${query}"`);
    
    try {
      const researchResults = await perplexityService.performDeepResearch(query);
      results.timing.researchEnd = performance.now();
      results.timing.researchDuration = results.timing.researchEnd - results.timing.researchStart;
      
      console.log(`✓ Research completed in ${(results.timing.researchDuration / 1000).toFixed(2)} seconds`);
      console.log(`✓ Research content length: ${researchResults.content.length} characters`);
      console.log(`✓ Number of sources: ${researchResults.sources.length}`);
      
      results.steps.research = {
        success: true,
        content: researchResults.content.substring(0, 300) + "...", // Just store preview in results
        contentLength: researchResults.content.length,
        sourcesCount: researchResults.sources.length,
        model: researchResults.modelUsed
      };
      
      // Save full research results
      const researchFilePath = await saveOutput("deep-research-results.json", {
        query,
        results: researchResults
      });
      
      // Step 3: Generate chart data with Claude API
      console.log("\n[Step 2] Generating chart data with Claude API...");
      results.timing.chartDataStart = performance.now();
      
      try {
        const chartType = "basic_bar";
        const chartData = await claudeService.generateChartData(
          researchResults.content,
          chartType
        );
        
        results.timing.chartDataEnd = performance.now();
        results.timing.chartDataDuration = results.timing.chartDataEnd - results.timing.chartDataStart;
        
        console.log(`✓ Chart data generation completed in ${(results.timing.chartDataDuration / 1000).toFixed(2)} seconds`);
        console.log(`✓ Generated data for chart type: ${chartType}`);
        console.log(`✓ Number of insights: ${chartData.insights.length}`);
        
        results.steps.chartData = {
          success: true,
          chartType,
          insightsCount: chartData.insights.length,
          data: chartData.data
        };
        
        // Save chart data
        const chartFilePath = await saveOutput(`${chartType}-chart.json`, chartData);
        
        // Step 4: Generate Plotly visualization with Claude API
        console.log("\n[Step 3] Generating Plotly visualization with Claude API...");
        results.timing.plotlyStart = performance.now();
        
        try {
          const plotlyConfig = await claudeService.generatePlotlyVisualization(
            chartData.data,
            chartType,
            `${query} - Chart`,
            "Visualization based on deep research results"
          );
          
          results.timing.plotlyEnd = performance.now();
          results.timing.plotlyDuration = results.timing.plotlyEnd - results.timing.plotlyStart;
          
          console.log(`✓ Plotly visualization completed in ${(results.timing.plotlyDuration / 1000).toFixed(2)} seconds`);
          
          results.steps.plotly = {
            success: true,
            config: {
              hasData: !!plotlyConfig.data,
              hasLayout: !!plotlyConfig.layout,
              dataLength: plotlyConfig.data ? plotlyConfig.data.length : 0
            }
          };
          
          // Save Plotly configuration
          const plotlyFilePath = await saveOutput(`${chartType}_plotly.json`, {
            plotlyConfig,
            insights: chartData.insights
          });
          
          results.success = true;
        } catch (error) {
          console.error("❌ Error generating Plotly visualization:", error.message);
          results.steps.plotly = {
            success: false,
            error: error.message
          };
          results.errors.push({
            step: "plotly",
            message: error.message,
            stack: error.stack
          });
        }
      } catch (error) {
        console.error("❌ Error generating chart data:", error.message);
        results.steps.chartData = {
          success: false,
          error: error.message
        };
        results.errors.push({
          step: "chartData",
          message: error.message,
          stack: error.stack
        });
      }
    } catch (error) {
      console.error("❌ Error performing deep research:", error.message);
      results.steps.research = {
        success: false,
        error: error.message
      };
      results.errors.push({
        step: "research",
        message: error.message,
        stack: error.stack
      });
    }
    
    // Calculate overall timing
    results.timing.totalDuration = 
      (results.timing.researchDuration || 0) + 
      (results.timing.chartDataDuration || 0) +
      (results.timing.plotlyDuration || 0);
    
    console.log("\n=== Verification Summary ===");
    console.log(`Overall success: ${results.success ? "✅ YES" : "❌ NO"}`);
    console.log(`Research step: ${results.steps.research?.success ? "✅ Success" : "❌ Failed"}`);
    console.log(`Chart data step: ${results.steps.chartData?.success ? "✅ Success" : "❌ Failed"}`);
    console.log(`Plotly visualization step: ${results.steps.plotly?.success ? "✅ Success" : "❌ Failed"}`);
    console.log(`Total duration: ${(results.timing.totalDuration / 1000).toFixed(2)} seconds`);
    
    // Save verification results
    const verificationFilePath = await saveOutput(
      `deep-research-workflow-verification-${new Date().toISOString().replace(/:/g, '-')}.json`,
      results
    );
    
    return results;
  } catch (error) {
    console.error("Verification process error:", error);
    results.success = false;
    results.errors.push({
      step: "overall",
      message: error.message,
      stack: error.stack
    });
    
    // Try to save error results
    try {
      const errorFilePath = await saveOutput(
        `deep-research-workflow-error-${new Date().toISOString().replace(/:/g, '-')}.json`,
        results
      );
    } catch (saveError) {
      console.error("Could not save error results:", saveError.message);
    }
    
    return results;
  }
}

// Run the verification if this file is being executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyDeepResearchWorkflow()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export default verifyDeepResearchWorkflow;
