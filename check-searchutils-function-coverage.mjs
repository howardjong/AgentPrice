/**
 * Script to analyze function coverage in searchUtils.js
 * Using ESM syntax
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Extract exported functions from the searchUtils module
async function extractExportedFunctions() {
  try {
    const searchUtilsPath = path.resolve('./utils/searchUtils.js');
    const content = await fs.readFile(searchUtilsPath, 'utf-8');
    
    // Find exported functions
    const exportedFunctions = [];
    
    // Regular expression to find exported functions in the default export object
    const defaultExportRegex = /export\s+default\s*{([^}]*)}/s;
    const match = content.match(defaultExportRegex);
    
    if (match && match[1]) {
      // Extract function names from the export object
      const exportedNames = match[1].split(',')
        .map(item => item.trim())
        .filter(item => item !== '');
      
      exportedFunctions.push(...exportedNames);
    }
    
    return exportedFunctions;
  } catch (error) {
    console.error('Error extracting exported functions:', error);
    return [];
  }
}

// Extract private functions (non-exported) from the searchUtils module
async function extractPrivateFunctions() {
  try {
    const searchUtilsPath = path.resolve('./utils/searchUtils.js');
    const content = await fs.readFile(searchUtilsPath, 'utf-8');
    
    // Find private function declarations
    const privateFunctions = [];
    
    // Regular expression to find function declarations
    const functionRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      privateFunctions.push(match[1]);
    }
    
    // Regular expression to find arrow function declarations
    const arrowFunctionRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/g;
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      privateFunctions.push(match[1]);
    }
    
    return privateFunctions;
  } catch (error) {
    console.error('Error extracting private functions:', error);
    return [];
  }
}

// Main function to check function coverage
async function checkFunctionCoverage() {
  console.log('Analyzing function coverage for searchUtils.js...');
  
  // Extract functions
  const exportedFunctions = await extractExportedFunctions();
  console.log(`\nExported functions (${exportedFunctions.length}):`);
  console.log(exportedFunctions.join(', '));
  
  const privateFunctions = await extractPrivateFunctions();
  console.log(`\nPrivate functions (${privateFunctions.length}):`);
  console.log(privateFunctions.join(', '));
  
  // Run test with coverage
  try {
    console.log('\nRunning coverage test...');
    
    // Use c8 to run the test with coverage
    const command = 'npx c8 --include=utils/searchUtils.js node simple-search-test.cjs';
    await execAsync(command);
    
    // Generate coverage report
    const { stdout: coverageOutput } = await execAsync('npx c8 report --reporter=text');
    
    // Analyze the coverage report
    console.log('\nAnalyzing coverage results...');
    
    // Save detailed coverage data
    await fs.writeFile('searchUtils-detailed-coverage.txt', coverageOutput);
    
    // Generate function coverage report
    const allFunctions = [...new Set([...exportedFunctions, ...privateFunctions])];
    
    // Simple detection of called functions (this is a simplified approach)
    const testOutput = await fs.readFile('search-test-output.txt', 'utf8');
    
    // Check which functions were likely used during the test
    const functionCoverage = allFunctions.map(func => {
      // For exported functions, we look for usage as searchUtils.funcName
      const isExported = exportedFunctions.includes(func);
      const pattern = isExported ? `searchUtils.${func}` : func;
      
      // Simple detection (note: this is not foolproof - a proper coverage tool should be used)
      const wasCalled = testOutput.includes(pattern);
      
      return {
        name: func,
        type: isExported ? 'exported' : 'private',
        covered: wasCalled
      };
    });
    
    // Generate markdown report
    const coveredCount = functionCoverage.filter(f => f.covered).length;
    const coveragePercent = Math.round((coveredCount / allFunctions.length) * 100);
    
    const markdown = `# SearchUtils Function Coverage Report

## Summary
- **Total Functions**: ${allFunctions.length}
- **Covered Functions**: ${coveredCount}
- **Coverage Percentage**: ${coveragePercent}%

## Function Coverage Details

| Function Name | Type | Covered |
|--------------|------|---------|
${functionCoverage.map(f => `| ${f.name} | ${f.type} | ${f.covered ? '✅' : '❌'} |`).join('\n')}

## Notes
- This is a simplified function coverage report
- A true coverage report should use proper instrumentation tools
- Private functions may be incorrectly detected
`;

    await fs.writeFile('searchUtils-function-coverage.md', markdown);
    console.log('Function coverage report generated: searchUtils-function-coverage.md');
    
  } catch (error) {
    console.error('Error checking function coverage:', error);
  }
}

// Run the function coverage check
checkFunctionCoverage()
  .then(() => {
    console.log('\nFunction coverage analysis completed.');
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });