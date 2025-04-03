/**
 * Script to run coverage tests for searchUtils and update the coverage report
 */
import { execSync } from 'child_process';
import fs from 'fs/promises';

async function runSearchUtilsCoverage() {
  try {
    console.log('=== Running SearchUtils Coverage Tests ===');
    
    // Run the tests with coverage
    execSync('npx vitest run "tests/unit/utils/searchUtils*.vitest.js" --coverage', { stdio: 'inherit' });
    
    // Extract coverage details from the report
    const coverage = execSync('npx vitest run "tests/unit/utils/searchUtils*.vitest.js" --coverage.enabled --json | grep -A 10 "searchUtils.js"').toString();
    
    // Parse the coverage metrics
    let statementCoverage = 0;
    let branchCoverage = 0;
    let functionCoverage = 0;
    
    const coverageMatches = coverage.match(/searchUtils\.js\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)/);
    if (coverageMatches && coverageMatches.length >= 4) {
      statementCoverage = parseFloat(coverageMatches[1]);
      branchCoverage = parseFloat(coverageMatches[2]);
      functionCoverage = parseFloat(coverageMatches[3]);
    }
    
    // Save the report to searchUtils-coverage.txt
    await fs.writeFile('./searchUtils-coverage.txt', coverage);
    
    // Generate a summary report
    const summary = `
# SearchUtils Coverage Report - ${new Date().toISOString().split('T')[0]}

## Coverage Metrics
- Statement Coverage: ${statementCoverage}% (Target: 80%)
- Branch Coverage: ${branchCoverage}% (Target: 80%)
- Function Coverage: ${functionCoverage}% (Target: 80%)

## Test Files
- tests/unit/utils/searchUtils.vitest.js: Core functionality tests
- tests/unit/utils/searchUtils.private.vitest.js: Private helper function tests

## Status
${statementCoverage >= 80 && branchCoverage >= 80 && functionCoverage >= 80 ? 
  '✅ All coverage targets met!' : 
  `❌ Some coverage targets not met:
  ${statementCoverage < 80 ? `- Statement coverage needs +${(80 - statementCoverage).toFixed(2)}%` : ''}
  ${branchCoverage < 80 ? `- Branch coverage needs +${(80 - branchCoverage).toFixed(2)}%` : ''}
  ${functionCoverage < 80 ? `- Function coverage needs +${(80 - functionCoverage).toFixed(2)}%` : ''}`
}

## Recommendation
${functionCoverage < 80 ? 
  'Add more tests for exported but untested functions to increase function coverage.' : 
  'Coverage meets requirements. Maintain this level in future updates.'
}
`;
    
    await fs.writeFile('./searchUtils-coverage-summary.md', summary);
    
    console.log('\n=== SearchUtils Coverage Summary ===');
    console.log(`Statement Coverage: ${statementCoverage.toFixed(2)}%`);
    console.log(`Branch Coverage: ${branchCoverage.toFixed(2)}%`);
    console.log(`Function Coverage: ${functionCoverage.toFixed(2)}%`);
    console.log('\nDetailed report saved to: searchUtils-coverage.txt');
    console.log('Summary report saved to: searchUtils-coverage-summary.md');
    
  } catch (error) {
    console.error('Error running coverage tests:', error.message);
  }
}

runSearchUtilsCoverage();