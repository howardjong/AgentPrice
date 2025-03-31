/**
 * Script to extract Redis test utils coverage information
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Run the test with coverage
execSync('npx vitest run tests/unit/utils/redis-test-utils.vitest.js --coverage --json --outputFile=coverage.json', {
  stdio: 'inherit'
});

// Read the coverage data
try {
  const coverageData = JSON.parse(fs.readFileSync('coverage.json', 'utf8'));
  
  // Find redis-test-utils.js in the coverage data
  const allFiles = coverageData.result?.coverage?.files || [];
  
  const redisUtilsFile = allFiles.find(file => file.path.includes('redis-test-utils.js'));
  
  if (redisUtilsFile) {
    console.log('Coverage for redis-test-utils.js:');
    console.log('----------------------------------');
    console.log(`Path: ${redisUtilsFile.path}`);
    console.log(`Lines: ${redisUtilsFile.lines.pct}%`);
    console.log(`Statements: ${redisUtilsFile.statements.pct}%`);
    console.log(`Functions: ${redisUtilsFile.functions.pct}%`);
    console.log(`Branches: ${redisUtilsFile.branches.pct}%`);
    
    // Identify uncovered lines
    const uncoveredLines = [];
    for (const lineNum in redisUtilsFile.lines.details) {
      const detail = redisUtilsFile.lines.details[lineNum];
      if (detail.hit === 0) {
        uncoveredLines.push(parseInt(lineNum));
      }
    }
    
    console.log('\nUncovered lines:');
    if (uncoveredLines.length === 0) {
      console.log('None - 100% coverage!');
    } else {
      console.log(uncoveredLines.join(', '));
    }
    
  } else {
    console.log('Could not find redis-test-utils.js in coverage data');
    // Log the available files for debugging
    console.log('Available files in coverage data:');
    allFiles.forEach(file => console.log(file.path));
  }
  
} catch (error) {
  console.error('Error reading coverage data:', error);
}

// Clean up
try {
  fs.unlinkSync('coverage.json');
} catch (err) {
  // Ignore errors on cleanup
}