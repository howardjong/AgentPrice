/**
 * Find uncovered functions in redis-test-utils.js
 */
import fs from 'fs';
import path from 'path';

// Path to the file
const filePath = 'utils/redis-test-utils.js';
const fileContent = fs.readFileSync(filePath, 'utf8');

// Extract all functions from the file
const functionPattern = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
const exportedFunctions = [];
let match;

while ((match = functionPattern.exec(fileContent)) !== null) {
  exportedFunctions.push(match[1]);
}

// Find all inner functions and anonymous functions
const allFunctionsPattern = /(?:function\s+(\w+)\s*\([^)]*\)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:const|let|var)\s+(\w+)\s*=\s*function\s*\([^)]*\)|(\([^)]*\))\s*=>\s*{)/g;
const allFunctions = [];
let namedInnerFuncCount = 0;
let anonymousFuncCount = 0;

while ((match = allFunctionsPattern.exec(fileContent)) !== null) {
  if (match[1]) {
    // Named function declarations
    allFunctions.push({name: match[1], type: 'named'});
    namedInnerFuncCount++;
  } else if (match[2]) {
    // Arrow function assigned to variable
    allFunctions.push({name: match[2], type: 'arrow-var'});
    namedInnerFuncCount++;
  } else if (match[3]) {
    // Function expression assigned to variable
    allFunctions.push({name: match[3], type: 'func-expr'});
    namedInnerFuncCount++;
  } else if (match[4]) {
    // Anonymous arrow function
    allFunctions.push({name: `anonymous_${anonymousFuncCount++}`, type: 'anon-arrow'});
  }
}

// Read current coverage data
const coverageSummary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
const targetFile = '/home/runner/workspace/utils/redis-test-utils.js';
const fileData = coverageSummary[targetFile];

// Read the detailed HTML to locate uncovered functions
const htmlFile = 'coverage/workspace/utils/redis-test-utils.js.html';
const htmlContent = fs.readFileSync(htmlFile, 'utf8');

// Helper function to count spans with cline-no class
function countUncoveredLines(html) {
  const lineNoPattern = /<span class="cline-any cline-no">/g;
  return (html.match(lineNoPattern) || []).length;
}

// Find function definitions in the HTML file
const functionBlocksPattern = /<span class="fstat-no" title="function not covered">(.*?)<\/span>/g;
const uncoveredFunctions = [];

while ((match = functionBlocksPattern.exec(htmlContent)) !== null) {
  uncoveredFunctions.push(match[1].trim());
}

// Look for areas with uncovered code
const codeBlocks = htmlContent.split('<span class="cline-any');
const uncoveredRegions = [];

for (let i = 0; i < codeBlocks.length; i++) {
  if (codeBlocks[i].includes('cline-no')) {
    // Look for function-like patterns in the previous block
    const previousBlock = i > 0 ? codeBlocks[i-1] : '';
    
    // Capture function-like patterns
    let functionContext = '';
    
    if (previousBlock.includes('function') || 
        previousBlock.includes('=>') ||
        (i > 1 && codeBlocks[i-2].includes('function'))) {
      
      // Try to get some context
      const start = Math.max(0, i-3);
      const end = Math.min(codeBlocks.length-1, i+3);
      
      for (let j = start; j <= end; j++) {
        const relevantPart = codeBlocks[j].replace(/<[^>]*>/g, ' ').trim();
        if (relevantPart) {
          functionContext += relevantPart + '\n';
        }
      }
      
      uncoveredRegions.push({
        approximateLocation: i, 
        context: functionContext
      });
    }
  }
}

// Helper function to find unique regions
function uniqueRegions(regions) {
  const seen = new Set();
  return regions.filter(region => {
    // Create a key from the context by removing whitespace and using just the first 50 chars
    const key = region.context.replace(/\s+/g, '').substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Summary
console.log('=== Uncovered Functions Analysis ===\n');
console.log('Exported functions in redis-test-utils.js:', exportedFunctions.length);
console.log('Inner named functions/variables:', namedInnerFuncCount);
console.log('Anonymous functions:', anonymousFuncCount);
console.log(`Total functions: ${fileData.functions.total}`);
console.log(`Covered functions: ${fileData.functions.covered}/${fileData.functions.total} (${fileData.functions.pct}%)\n`);

console.log('Uncovered function spans in HTML report:');
if (uncoveredFunctions.length > 0) {
  for (const func of uncoveredFunctions) {
    console.log(`- ${func}`);
  }
} else {
  console.log('None detected from function spans');
}

console.log('\nPotential uncovered function regions:');
const uniqueUncoveredRegions = uniqueRegions(uncoveredRegions);
if (uniqueUncoveredRegions.length > 0) {
  for (let i = 0; i < Math.min(uniqueUncoveredRegions.length, 10); i++) {
    console.log(`\nRegion ${i+1}:`);
    console.log(uniqueUncoveredRegions[i].context);
  }
} else {
  console.log('None - no code regions with uncovered functions detected');
}

// Suggestions
console.log('\n=== Required Actions ===');
console.log(`Current function coverage: ${fileData.functions.covered}/${fileData.functions.total} (${fileData.functions.pct}%)`);
console.log(`Need ${Math.ceil(fileData.functions.total * 0.8) - fileData.functions.covered} more functions covered to reach 80% coverage`);

// Hint areas to focus on
console.log('\nAreas to focus on:');
console.log('1. Anonymous callbacks in timeout/error simulation functions');
console.log('2. Inner methods of the mock Redis service object');
console.log('3. Constructor functions and their initialization logic');
console.log('4. Error handling blocks and condition branches');