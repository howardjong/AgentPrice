
/**
 * Test script for Plotly visualization integration
 * 
 * This script tests Claude's ability to generate Plotly configurations
 * for different chart types.
 */

import claudeService from '../../services/claudeService.js';
import logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

// Sample data for testing
const samplePriceData = {
  "prices": [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  "tooExpensive": [0.05, 0.10, 0.20, 0.35, 0.48, 0.65, 0.75, 0.85, 0.92, 0.96],
  "expensiveButReasonable": [0.12, 0.25, 0.45, 0.58, 0.72, 0.65, 0.55, 0.42, 0.30, 0.20],
  "goodValue": [0.80, 0.72, 0.60, 0.48, 0.40, 0.30, 0.25, 0.18, 0.12, 0.05],
  "tooCheap": [0.85, 0.65, 0.45, 0.30, 0.18, 0.12, 0.08, 0.05, 0.03, 0.01]
};

const sampleConjointData = {
  "attributes": [
    {
      "name": "Brand",
      "levels": ["Brand A", "Brand B", "Brand C"],
      "importanceScore": 35,
      "utilityScores": {
        "Brand A": 0.8,
        "Brand B": 0.3,
        "Brand C": -1.1
      }
    },
    {
      "name": "Price",
      "levels": ["$10", "$15", "$20"],
      "importanceScore": 40,
      "utilityScores": {
        "$10": 1.2,
        "$15": 0.1,
        "$20": -1.3
      }
    },
    {
      "name": "Features",
      "levels": ["Basic", "Standard", "Premium"],
      "importanceScore": 25,
      "utilityScores": {
        "Basic": -0.9,
        "Standard": 0.2,
        "Premium": 0.7
      }
    }
  ]
};

const sampleBarData = {
  "categories": ["Category A", "Category B", "Category C", "Category D", "Category E"],
  "values": [23, 45, 32, 15, 37]
};

// Test function to generate Plotly configuration for each chart type
async function testPlotlyIntegration() {
  console.log('=== Testing Plotly Visualization Integration ===\n');

  try {
    // Test Van Westendorp price sensitivity analysis
    console.log('Testing Van Westendorp price sensitivity analysis...');
    const vanWestendorpResult = await claudeService.generatePlotlyVisualization(
      samplePriceData,
      'van_westendorp',
      'Price Sensitivity Analysis',
      'Analysis of price sensitivity for our new product line'
    );
    
    console.log('✅ Van Westendorp visualization generated successfully!');
    console.log(`Model used: ${vanWestendorpResult.modelUsed}`);
    console.log(`Number of insights: ${vanWestendorpResult.insights.length}`);
    console.log('Price points identified:', vanWestendorpResult.pricePoints);
    
    // Test Conjoint analysis
    console.log('\nTesting Conjoint analysis...');
    const conjointResult = await claudeService.generatePlotlyVisualization(
      sampleConjointData,
      'conjoint',
      'Conjoint Analysis Results',
      'Analysis of consumer preferences and tradeoffs'
    );
    
    console.log('✅ Conjoint analysis visualization generated successfully!');
    console.log(`Model used: ${conjointResult.modelUsed}`);
    console.log(`Number of insights: ${conjointResult.insights.length}`);
    console.log('Optimal combination:', conjointResult.optimalCombination);
    
    // Test basic bar chart
    console.log('\nTesting basic bar chart...');
    const barChartResult = await claudeService.generatePlotlyVisualization(
      sampleBarData,
      'bar',
      'Sample Bar Chart',
      'Visualization of category performance'
    );
    
    console.log('✅ Bar chart visualization generated successfully!');
    console.log(`Model used: ${barChartResult.modelUsed}`);
    console.log(`Number of insights: ${barChartResult.insights.length}`);
    
    // Save the results to files for inspection
    const outputDir = path.join(process.cwd(), 'tests', 'output');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      // Directory already exists, continue
    }
    
    await fs.writeFile(
      path.join(outputDir, 'van_westendorp_plotly.json'),
      JSON.stringify(vanWestendorpResult, null, 2)
    );
    
    await fs.writeFile(
      path.join(outputDir, 'conjoint_plotly.json'),
      JSON.stringify(conjointResult, null, 2)
    );
    
    await fs.writeFile(
      path.join(outputDir, 'bar_chart_plotly.json'),
      JSON.stringify(barChartResult, null, 2)
    );
    
    console.log('\n✅ All Plotly visualizations generated successfully!');
    console.log(`Output saved to ${outputDir}`);
    
  } catch (error) {
    console.error('\n❌ Error testing Plotly integration:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the test
testPlotlyIntegration()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Unhandled error in test:', err);
    process.exit(1);
  });
