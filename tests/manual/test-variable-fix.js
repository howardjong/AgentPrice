
/**
 * Test script to validate the variable fix in test-single-query-workflow.js
 * without making actual API calls
 */

import fs from 'fs/promises';
import path from 'path';

// Path to the test file we're validating
const targetFilePath = path.join(process.cwd(), 'tests/manual/test-single-query-workflow.js');

async function testVariableFix() {
  console.log('=== Testing variable consistency fix ===');
  
  try {
    // Read the file content
    const fileContent = await fs.readFile(targetFilePath, 'utf8');
    
    // Check if the file consistently uses optimizedQuery instead of enhancedQuery
    const enhancedQueryCount = (fileContent.match(/enhancedQuery/g) || []).length;
    const optimizedQueryCount = (fileContent.match(/optimizedQuery/g) || []).length;
    
    console.log(`Found ${enhancedQueryCount} instances of 'enhancedQuery'`);
    console.log(`Found ${optimizedQueryCount} instances of 'optimizedQuery'`);
    
    if (enhancedQueryCount > 0) {
      console.log('\n❌ Error: Inconsistent variable naming detected');
      
      // Find line numbers where enhancedQuery appears
      const lines = fileContent.split('\n');
      const problematicLines = lines
        .map((line, index) => ({ line, index: index + 1 }))
        .filter(({ line }) => line.includes('enhancedQuery'))
        .map(({ index, line }) => `Line ${index}: ${line.trim()}`);
      
      console.log('\nProblematic lines:');
      problematicLines.forEach(line => console.log(line));
      
      console.log('\nThese should be changed to use "optimizedQuery" instead.');
    } else {
      console.log('\n✅ Success: Variable naming is consistent!');
    }
    
  } catch (error) {
    console.error('Error running test:', error.message);
  }
}

// Run the test
testVariableFix();
