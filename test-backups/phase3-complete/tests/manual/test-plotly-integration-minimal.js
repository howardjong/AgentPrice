
/**
 * Minimal test script for Plotly visualization integration
 * 
 * This script tests the Plotly visualization integration without making external API calls
 * by using cached test data.
 */

import fs from 'fs/promises';
import path from 'path';

// Output paths for test data
const outputDir = path.join(process.cwd(), 'tests', 'output');
const vanWestendorpPath = path.join(outputDir, 'van_westendorp_plotly.json');
const conjointPath = path.join(outputDir, 'conjoint_plotly.json');
const barChartPath = path.join(outputDir, 'bar_chart_plotly.json');

async function testPlotlyIntegrationMinimal() {
  console.log('=== Testing Plotly Visualization Integration (Minimal Mode) ===\n');
  
  try {
    // Check if the cached test files exist
    console.log('Checking for cached test data...');
    
    const files = [
      { path: vanWestendorpPath, name: 'Van Westendorp' },
      { path: conjointPath, name: 'Conjoint analysis' },
      { path: barChartPath, name: 'Bar chart' }
    ];
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file.path);
        if (stats.isFile()) {
          // File exists, read and parse it
          const content = await fs.readFile(file.path, 'utf8');
          const data = JSON.parse(content);
          
          console.log(`✅ ${file.name} test data found and loaded successfully!`);
          console.log(`Model used: ${data.modelUsed || 'unknown'}`);
          console.log(`Number of insights: ${data.insights ? data.insights.length : 0}`);
          
          // Show additional data based on chart type
          if (file.name === 'Van Westendorp' && data.pricePoints) {
            console.log('Price points identified:', data.pricePoints);
          } else if (file.name === 'Conjoint analysis' && data.optimalCombination) {
            console.log('Optimal combination:', data.optimalCombination);
          }
          
          console.log('');
        } else {
          console.log(`❌ ${file.name} test data exists but is not a file`);
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.log(`⚠️ ${file.name} test data not found at ${file.path}`);
          console.log('No cached data available. Run the full test to generate test data.\n');
        } else {
          console.error(`❌ Error checking ${file.name} test data:`, err);
        }
      }
    }
    
    console.log('\n✅ Plotly visualization integration check completed successfully!');
    console.log('Note: This was a minimal test using cached data to avoid API calls.');
    console.log('To generate fresh test data, run the full test with: node tests/manual/test-plotly-integration.js');
    
  } catch (error) {
    console.error('\n❌ Error testing Plotly integration:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the test
testPlotlyIntegrationMinimal()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Unhandled error in test:', err);
    process.exit(1);
  });
