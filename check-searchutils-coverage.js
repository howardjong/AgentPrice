/**
 * Simple script to check searchUtils.js coverage
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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
    
    // Check coverage summary from the output
    const coverageSummary = fs.readFileSync('coverage/coverage-summary.json', 'utf8');
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
    }
  }
);