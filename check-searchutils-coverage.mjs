/**
 * Simple script to check searchUtils.js coverage
 */
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

console.log('=== Checking SearchUtils Coverage ===');

// Run the tests with coverage
exec('npx vitest run tests/unit/utils/searchUtils.vitest.js tests/unit/utils/searchUtils.private.vitest.js --coverage', 
  (error, stdout, stderr) => {
    if (error) {
      console.error(`Error running tests: ${error.message}`);
      return;
    }
    
    if (stderr) {
      console.error(`Test stderr: ${stderr}`);
    }
    
    console.log(stdout);
    
    try {
      // Check if the coverage directory exists
      if (!fs.existsSync('coverage')) {
        console.error('Coverage directory not found!');
        return;
      }
      
      // Check if the coverage summary file exists
      const summaryPath = 'coverage/coverage-summary.json';
      if (!fs.existsSync(summaryPath)) {
        console.error('Coverage summary file not found!');
        // List all files/dirs in coverage
        console.log('Files in coverage directory:');
        const files = fs.readdirSync('coverage');
        console.log(files);
        return;
      }
      
      // Check coverage summary from the output
      const coverageSummary = fs.readFileSync(summaryPath, 'utf8');
      const coverage = JSON.parse(coverageSummary);
      
      // Look for searchUtils.js coverage
      let searchUtilsCoverage = null;
      
      for (const file in coverage) {
        if (file.includes('utils/searchUtils.js')) {
          searchUtilsCoverage = coverage[file];
          break;
        }
      }
      
      if (searchUtilsCoverage) {
        console.log('\n=== SearchUtils.js Coverage Summary ===');
        console.log(`Statements: ${searchUtilsCoverage.statements.pct}%`);
        console.log(`Branches: ${searchUtilsCoverage.branches.pct}%`);
        console.log(`Functions: ${searchUtilsCoverage.functions.pct}%`);
        console.log(`Lines: ${searchUtilsCoverage.lines.pct}%`);
        
        // Save the coverage to a file for reference
        fs.writeFileSync('searchUtils-coverage.txt', 
          `SearchUtils.js Coverage Summary:
Statements: ${searchUtilsCoverage.statements.pct}%
Branches: ${searchUtilsCoverage.branches.pct}%
Functions: ${searchUtilsCoverage.functions.pct}%
Lines: ${searchUtilsCoverage.lines.pct}%
          `);
        
        console.log('\nCoverage saved to searchUtils-coverage.txt');
      } else {
        console.error('Could not find searchUtils.js coverage data');
        
        // List all files in coverage
        console.log('Available files in coverage:');
        for (const file in coverage) {
          if (file !== 'total') {
            console.log(file);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing coverage data: ${err.message}`);
    }
  });