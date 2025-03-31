/**
 * Script to analyze test coverage
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Run the test with coverage, which will generate coverage in the default location
execSync('npx vitest run tests/unit/utils/redis-test-utils.vitest.js --coverage', {
  stdio: 'inherit'
});

console.log("\nExamining coverage for redis-test-utils.js...");

// Determine the target file we're looking for
const targetFile = 'utils/redis-test-utils.js';

// Search for coverage.txt in the coverage directory
try {
  const files = fs.readdirSync('coverage');
  const lcovInfo = files.find(file => file.endsWith('lcov.info'));
  
  if (lcovInfo) {
    const lcovPath = path.join('coverage', lcovInfo);
    const lcovContent = fs.readFileSync(lcovPath, 'utf8');
    
    // Split the lcov data into sections by file
    const fileSections = lcovContent.split('SF:');
    
    // Find the section for our target file
    const targetSection = fileSections.find(section => section.includes(targetFile));
    
    if (targetSection) {
      // Extract key metrics
      const lines = targetSection.split('\n');
      
      const functionCoverage = lines.find(line => line.startsWith('FN'));
      const branchCoverage = lines.find(line => line.startsWith('BRF'));
      const lineCoverage = lines.find(line => line.startsWith('LF'));
      
      console.log('File coverage metrics:');
      console.log('---------------------');
      
      // Function coverage
      const fnHit = parseInt(lines.find(line => line.startsWith('FNH:'))?.split(':')[1] || '0');
      const fnTotal = parseInt(lines.find(line => line.startsWith('FNF:'))?.split(':')[1] || '0');
      const fnPct = fnTotal > 0 ? (fnHit / fnTotal) * 100 : 0;
      console.log(`Function coverage: ${fnHit}/${fnTotal} (${fnPct.toFixed(2)}%)`);
      
      // Branch coverage
      const brHit = parseInt(lines.find(line => line.startsWith('BRH:'))?.split(':')[1] || '0');
      const brTotal = parseInt(lines.find(line => line.startsWith('BRF:'))?.split(':')[1] || '0');
      const brPct = brTotal > 0 ? (brHit / brTotal) * 100 : 0;
      console.log(`Branch coverage: ${brHit}/${brTotal} (${brPct.toFixed(2)}%)`);
      
      // Line coverage
      const lnHit = parseInt(lines.find(line => line.startsWith('LH:'))?.split(':')[1] || '0');
      const lnTotal = parseInt(lines.find(line => line.startsWith('LF:'))?.split(':')[1] || '0');
      const lnPct = lnTotal > 0 ? (lnHit / lnTotal) * 100 : 0;
      console.log(`Line coverage: ${lnHit}/${lnTotal} (${lnPct.toFixed(2)}%)`);
      
      // Find uncovered lines
      const uncoveredLines = [];
      let inDASection = false;
      
      for (const line of lines) {
        if (line.startsWith('DA:')) {
          const [_, lineNum, hitCount] = line.split(':')[1].split(',');
          if (hitCount === '0') {
            uncoveredLines.push(parseInt(lineNum));
          }
        }
      }
      
      if (uncoveredLines.length > 0) {
        console.log('\nUncovered lines:');
        console.log(uncoveredLines.join(', '));
      } else {
        console.log('\nAll lines are covered! 100% line coverage.');
      }
      
    } else {
      console.log(`Couldn't find coverage data for ${targetFile}`);
    }
    
  } else {
    console.log('No lcov.info file found in the coverage directory');
  }
} catch (error) {
  console.error('Error reading coverage data:', error);
}