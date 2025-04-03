/**
 * Script to analyze function coverage in searchUtils.js
 * Using ESM syntax
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all exported functions from searchUtils.js
function extractExportedFunctions() {
  try {
    const content = fs.readFileSync(path.join(__dirname, 'utils', 'searchUtils.js'), 'utf8');
    
    // Extract exported function names
    const exportMatches = content.match(/export (async )?function (\w+)/g) || [];
    const functionNames = exportMatches.map(match => {
      const nameMatch = match.match(/function (\w+)/);
      return nameMatch ? nameMatch[1] : null;
    }).filter(Boolean);
    
    console.log('Exported functions:', functionNames);
    return functionNames;
  } catch (error) {
    console.error('Error extracting function names:', error.message);
    return [];
  }
}

// Extract private helper functions
function extractPrivateFunctions() {
  try {
    const content = fs.readFileSync(path.join(__dirname, 'utils', 'searchUtils.js'), 'utf8');
    
    // Find function declarations that aren't exported
    const functionMatches = content.match(/^function (\w+)/gm) || [];
    const functionNames = functionMatches.map(match => {
      const nameMatch = match.match(/function (\w+)/);
      return nameMatch ? nameMatch[1] : null;
    }).filter(Boolean);
    
    console.log('Private functions:', functionNames);
    return functionNames;
  } catch (error) {
    console.error('Error extracting private function names:', error.message);
    return [];
  }
}

// Run the tests and check for references to functions in test output
function checkFunctionCoverage() {
  const exportedFunctions = extractExportedFunctions();
  const privateFunctions = extractPrivateFunctions();
  const allFunctions = [...exportedFunctions, ...privateFunctions];
  
  console.log(`\nAnalyzing coverage for ${allFunctions.length} functions in searchUtils.js`);
  
  try {
    // Run tests and look for function references in test output
    const testOutput = execSync('npx vitest run tests/unit/utils/searchUtils.vitest.js tests/unit/utils/searchUtils.private-functions.vitest.js --reporter verbose', { encoding: 'utf8' });
    
    let coveredCount = 0;
    const uncoveredFunctions = [];
    
    allFunctions.forEach(funcName => {
      // Check if the function name appears in test assertions or descriptions
      const functionPattern = new RegExp(`(describe|it|test).*${funcName}|expect\\(${funcName}\\)|${funcName}\\(`);
      
      if (testOutput.match(functionPattern)) {
        console.log(`✅ ${funcName}: Covered`);
        coveredCount++;
      } else {
        console.log(`❌ ${funcName}: Not covered`);
        uncoveredFunctions.push(funcName);
      }
    });
    
    // Calculate coverage percentage
    const coveragePercentage = (coveredCount / allFunctions.length) * 100;
    
    console.log(`\n=== Function Coverage Analysis ===`);
    console.log(`Total functions: ${allFunctions.length}`);
    console.log(`Covered functions: ${coveredCount}`);
    console.log(`Uncovered functions: ${allFunctions.length - coveredCount}`);
    console.log(`Function coverage: ${coveragePercentage.toFixed(2)}%`);
    
    if (uncoveredFunctions.length > 0) {
      console.log(`\nFunctions that need test coverage:`);
      uncoveredFunctions.forEach(func => console.log(`- ${func}`));
    }
    
    // Determine if coverage target is met
    const targetMet = coveragePercentage >= 80;
    console.log(`\nCoverage target (80%): ${targetMet ? '✅ MET' : '❌ NOT MET'}`);
    
    // Save coverage report to a file
    const report = `
# SearchUtils Function Coverage Report

- Date: ${new Date().toISOString().split('T')[0]}
- Total Functions: ${allFunctions.length}
- Covered Functions: ${coveredCount}
- Function Coverage: ${coveragePercentage.toFixed(2)}%
- Coverage Target (80%): ${targetMet ? 'MET ✓' : 'NOT MET ✗'}

## Function Coverage Details

${allFunctions.map(func => {
  const covered = !uncoveredFunctions.includes(func);
  return `- ${covered ? '✓' : '✗'} ${func}`;
}).join('\n')}

${uncoveredFunctions.length > 0 ? `
## Recommendation

Add tests for the following functions to improve coverage:
${uncoveredFunctions.map(func => `- ${func}`).join('\n')}
` : '## Recommendation\n\nCoverage target is met. Maintain this level with future updates.'}
`;
    
    fs.writeFileSync('searchUtils-function-coverage.md', report);
    console.log('\nDetailed report saved to: searchUtils-function-coverage.md');
    
    return coveragePercentage;
  } catch (error) {
    console.error('Error running coverage analysis:', error.message);
    return 0;
  }
}

checkFunctionCoverage();