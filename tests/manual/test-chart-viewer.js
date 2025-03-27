
/**
 * Test script for Chart Viewer
 * 
 * This script verifies that the chart viewer page can properly load and display
 * charts from the test output directory.
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger.js';

async function testChartViewer() {
  console.log('=== Testing Chart Viewer ===\n');
  
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  
  try {
    // Check if output directory exists
    try {
      await fs.access(outputDir);
      console.log(`✅ Output directory found: ${outputDir}`);
    } catch (err) {
      console.log(`❌ Output directory not found. Creating it now...`);
      await fs.mkdir(outputDir, { recursive: true });
      console.log(`✅ Output directory created: ${outputDir}`);
    }
    
    // Check for each required chart file
    const requiredFiles = [
      'van_westendorp_plotly.json',
      'conjoint_plotly.json',
      'bar_chart_plotly.json'
    ];
    
    let allFilesExist = true;
    for (const file of requiredFiles) {
      const filePath = path.join(outputDir, file);
      try {
        await fs.access(filePath);
        const stats = await fs.stat(filePath);
        console.log(`✅ Found ${file} (${stats.size} bytes)`);
      } catch (err) {
        console.log(`❌ Missing required file: ${file}`);
        allFilesExist = false;
      }
    }
    
    // Check public directory for chart viewer
    const chartViewerPath = path.join(process.cwd(), 'public', 'chart-viewer.html');
    try {
      await fs.access(chartViewerPath);
      console.log(`✅ Chart viewer found: ${chartViewerPath}`);
    } catch (err) {
      console.log(`❌ Chart viewer not found at ${chartViewerPath}`);
      return;
    }
    
    if (allFilesExist) {
      console.log('\n✅ All required files found. Chart viewer is ready!');
      console.log('\nTo view charts, run the following command:');
      console.log('  npx serve . -l 3000');
      console.log('\nThen open your browser and navigate to:');
      console.log('  http://<your-repl-url>/public/chart-viewer.html');
    } else {
      console.log('\n❌ Some required files are missing. Please run the Plotly integration test first:');
      console.log('  node tests/manual/test-plotly-integration-minimal.js');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing chart viewer:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the test
testChartViewer();
