
/**
 * This script compares previously run test results and generates scorecards
 * 
 * Usage: node tests/manual/compare-test-results.js [resultFile1] [resultFile2] ...
 * Example: node tests/manual/compare-test-results.js tests/output/deep-research-results.json tests/output/pricing-research-results.json
 */

import promptScorecard from '../../utils/promptScorecard.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directory for scorecards
const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'scorecards');

async function compareTestResults() {
  console.log("\n==== COMPARING TEST RESULTS ====\n");
  
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Get input files from command line args or find recent results
    let files = process.argv.slice(2);
    
    if (files.length === 0) {
      console.log("No input files specified, searching for recent test results...");
      
      // Find result files in the output directory
      const searchPattern = path.join(__dirname, '..', 'output', '**', '*-research-results.json');
      files = await glob(searchPattern);
      
      if (files.length === 0) {
        console.log("No test result files found. Please run tests first or specify file paths.");
        return;
      }
      
      // Sort by modification time (newest first)
      const fileStats = await Promise.all(
        files.map(async file => ({
          path: file,
          stat: await fs.stat(file)
        }))
      );
      
      fileStats.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
      
      // Take the 5 most recent files
      files = fileStats.slice(0, 5).map(file => file.path);
    }
    
    console.log(`Found ${files.length} test result files to compare:\n`);
    files.forEach(file => console.log(`- ${path.basename(file)}`));
    console.log();
    
    // Generate scorecards from each file
    const scorecards = [];
    for (const file of files) {
      console.log(`Processing: ${path.basename(file)}`);
      
      try {
        const scorecard = await promptScorecard.generateScorecardFromFile(file);
        
        if (scorecard.valid) {
          // Extract version from filename if not in the data
          if (scorecard.version === 'unknown') {
            const filename = path.basename(file);
            const match = filename.match(/(\w+)-research-results/);
            if (match) {
              scorecard.version = match[1];
            }
          }
          
          scorecards.push(scorecard);
          console.log(`  ✓ Generated scorecard for version: ${scorecard.version}`);
        } else {
          console.log(`  ✗ Failed to generate scorecard: ${scorecard.error}`);
        }
      } catch (error) {
        console.error(`  ✗ Error processing file: ${error.message}`);
      }
    }
    
    // Compare scorecards
    if (scorecards.length < 2) {
      console.log("\nNeed at least two valid test results to compare. Please run more tests.");
      return;
    }
    
    console.log(`\nComparing ${scorecards.length} scorecards...`);
    
    // Generate comparison
    const comparison = promptScorecard.compareScorecards(scorecards);
    
    // Generate HTML report
    const html = promptScorecard.generateHtmlReport(comparison);
    const reportPath = path.join(OUTPUT_DIR, 'scorecard-comparison.html');
    await fs.writeFile(reportPath, html);
    
    console.log("\n=== COMPARISON SUMMARY ===");
    console.log(`Best performing version: ${comparison.bestVersion} (${comparison.bestScore}/100)`);
    
    // Print versions ranked by score
    console.log("\nVersions ranked by quality score:");
    comparison.comparisons.forEach((comp, index) => {
      console.log(`${index + 1}. ${comp.version}: ${comp.metrics.quality.totalScore}/100 (${comp.metrics.quality.qualityRating})`);
    });
    
    console.log(`\nDetailed scorecard saved to: ${reportPath}`);
    console.log(`\nOpen this file in your browser to view the complete scorecard comparison.`);
    
  } catch (error) {
    console.error(`Error comparing test results: ${error.message}`);
  }
}

// Run the comparison
compareTestResults();
