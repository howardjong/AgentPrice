/**
 * Enhanced script to analyze function coverage in redis-test-utils.js
 */
import fs from 'fs';
import path from 'path';

// Read the coverage summary
const coverageSummary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));

// File paths
const redisUtilsPath = '/home/runner/workspace/utils/redis-test-utils.js';

// Read the source file directly
const sourceFilePath = 'utils/redis-test-utils.js';
const sourceCode = fs.readFileSync(sourceFilePath, 'utf8');

// Read the HTML coverage report for detailed function coverage
const htmlReportPath = 'coverage/workspace/utils/redis-test-utils.js.html';
let htmlReport = '';
try {
  htmlReport = fs.readFileSync(htmlReportPath, 'utf8');
} catch (err) {
  console.error('Could not read HTML coverage report:', err.message);
}

// Get basic coverage data
const fileData = coverageSummary[redisUtilsPath] || {
  lines: { total: 0, covered: 0, pct: 0 },
  functions: { total: 0, covered: 0, pct: 0 },
  statements: { total: 0, covered: 0, pct: 0 },
  branches: { total: 0, covered: 0, pct: 0 }
};

// Pattern for exported functions
const exportedFnPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
const exportedFunctions = [];
let match;

while ((match = exportedFnPattern.exec(sourceCode)) !== null) {
  exportedFunctions.push(match[1]);
}

// Pattern for various function types
const patterns = [
  // Function pattern 1: Standard function declarations
  { regex: /function\s+(\w+)\s*\([^)]*\)/g, type: 'named function declaration' },
  
  // Function pattern 2: Arrow functions assigned to variables
  { regex: /const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g, type: 'arrow function' },
  
  // Function pattern 3: Function expressions assigned to variables
  { regex: /const\s+(\w+)\s*=\s*function\s*\([^)]*\)/g, type: 'function expression' },
  
  // Function pattern 4: Object methods in Redis service mock
  { regex: /(\w+)\s*:\s*(?:async\s+)?function\s*\([^)]*\)/g, type: 'object method' },
  
  // Function pattern 5: Anonymous arrow functions
  { regex: /setTimeout\(\(\)\s*=>\s*{/g, type: 'anonymous arrow function' }
];

// Collect all function-like patterns
const allFunctions = [];

for (const pattern of patterns) {
  let match;
  
  while ((match = pattern.regex.exec(sourceCode)) !== null) {
    // Some patterns don't have a capture group for the function name
    const name = match[1] || `anonymous_${allFunctions.length + 1}`;
    
    allFunctions.push({
      name,
      type: pattern.type,
      location: match.index
    });
  }
}

// Find uncovered functions from HTML report
const uncoveredFunctions = [];

if (htmlReport) {
  // Pattern for uncovered function spans
  const uncoveredPattern = /<span class="fstat-no" title="function not covered"[^>]*>(.*?)<\/span>/g;
  
  while ((match = uncoveredPattern.exec(htmlReport)) !== null) {
    uncoveredFunctions.push(match[1].trim());
  }
}

// Display summary
console.log('=== Function Coverage Analysis ===\n');
console.log(`Total Functions: ${fileData.functions.total}`);
console.log(`Covered Functions: ${fileData.functions.covered}`);
console.log(`Uncovered Functions: ${fileData.functions.total - fileData.functions.covered}`);
console.log(`Coverage Percentage: ${fileData.functions.pct}%`);

// Display exported functions
console.log('\nExported Functions:');
exportedFunctions.forEach(fn => console.log(`- ${fn}`));

// Display all detected function-like patterns
console.log('\nAll Detected Function Patterns:');
allFunctions.forEach(fn => console.log(`- ${fn.name} (${fn.type})`));

// If we have data from HTML report, show uncovered functions
if (uncoveredFunctions.length > 0) {
  console.log('\nUncovered Functions from HTML Report:');
  uncoveredFunctions.forEach(fn => console.log(`- ${fn}`));
}

// Show examples where the timeout callback function may be uncovered
const timeoutExamples = sourceCode.match(/setTimeout\(\(\)\s*=>\s*{[^}]*}/g) || [];
if (timeoutExamples.length > 0) {
  console.log('\nTimeout Callback Examples (potentially uncovered):');
  timeoutExamples.forEach((example, i) => {
    const shortExample = example.substring(0, 100) + (example.length > 100 ? '...' : '');
    console.log(`- Example ${i+1}: ${shortExample}`);
  });
}

// Calculate required improvement
const targetCoverage = 80;
const neededFunctions = Math.ceil(fileData.functions.total * (targetCoverage / 100)) - fileData.functions.covered;

console.log('\n=== Goal Analysis ===');
console.log(`Current function coverage: ${fileData.functions.covered}/${fileData.functions.total} (${fileData.functions.pct}%)`);
console.log(`Target function coverage: ${targetCoverage}%`);

if (fileData.functions.pct >= targetCoverage) {
  console.log('✅ Function coverage target achieved!');
} else {
  console.log(`❌ Need to cover ${neededFunctions} more functions to reach ${targetCoverage}% coverage`);
}

// Provide suggestions for improvement
console.log('\n=== Suggestions for Improvement ===');
console.log('1. Focus on covering timeout callbacks by triggering the timeout condition');
console.log('2. Test constructor functions directly by instantiating with various options');
console.log('3. Test object methods in Redis service mock by accessing them directly');
console.log('4. Cover default and edge cases in conditional branches');