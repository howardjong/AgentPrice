/**
 * Simple script to check searchUtils.js coverage
 * 
 * This ESM script runs the tests for searchUtils and generates a coverage report.
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';

const execAsync = promisify(exec);

const testsToRun = [
  'simple-search-test.cjs'
];

// Main function to run tests with coverage
async function runCoverageTests() {
  console.log('Running coverage tests for searchUtils.js...');
  
  const results = [];
  
  // Run each test with coverage instrumentation
  for (const test of testsToRun) {
    console.log(`\nRunning test: ${test}`);
    
    try {
      // Use c8 to run the test with coverage
      const command = `npx c8 --include=utils/searchUtils.js node ${test}`;
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error(`Error running test ${test}:`, stderr);
      }
      
      console.log(`Test output: ${stdout.slice(0, 500)}${stdout.length > 500 ? '...' : ''}`);
      results.push({ test, success: true, output: stdout });
    } catch (error) {
      console.error(`Failed to run test ${test}:`, error.message);
      results.push({ test, success: false, error: error.message });
    }
  }
  
  // Generate coverage summary
  try {
    console.log('\nGenerating coverage summary...');
    
    const { stdout: coverageOutput } = await execAsync('npx c8 report --reporter=text-summary');
    console.log('\nCoverage Summary:');
    console.log(coverageOutput);
    
    // Save coverage data to file
    await fs.writeFile('searchUtils-coverage.txt', coverageOutput);
    console.log('Coverage data saved to searchUtils-coverage.txt');
    
    // Generate a more detailed report as markdown
    const { stdout: detailedCoverage } = await execAsync('npx c8 report --reporter=text');
    
    const markdown = `# SearchUtils Coverage Report

## Summary
\`\`\`
${coverageOutput}
\`\`\`

## Detailed Coverage
\`\`\`
${detailedCoverage}
\`\`\`

## Tests Run
${testsToRun.map(test => `- ${test}`).join('\n')}
`;

    await fs.writeFile('searchUtils-coverage-summary.md', markdown);
    console.log('Detailed coverage report saved to searchUtils-coverage-summary.md');
  } catch (error) {
    console.error('Error generating coverage report:', error.message);
  }
  
  return results;
}

// Run the coverage tests
runCoverageTests()
  .then(() => {
    console.log('\nCoverage tests completed.');
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });