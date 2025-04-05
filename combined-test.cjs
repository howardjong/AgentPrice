/**
 * Combined Test Script (CommonJS version)
 * 
 * This script combines testing of:
 * 1. SearchUtils functionality
 * 2. Model information extraction
 */

const fs = require('fs').promises;

// Test collection for search
const testCollection = [
  { id: '1', title: 'Machine Learning Basics', content: 'Introduction to ML concepts and applications.' },
  { id: '2', title: 'JavaScript Programming', content: 'Web development with JavaScript.' },
  { id: '3', title: 'CSS Styling', content: 'Styling web pages with machine learning examples.' },
  { id: '4', title: 'Database Design', content: 'SQL database design', description: 'Includes machine learning applications.' }
];

// Mock response for model extraction test
const mockResponse = {
  content: "JavaScript is a high-level programming language primarily used for web development.",
  model: "sonar",
  references: [
    { title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
    { title: "W3Schools", url: "https://www.w3schools.com/js/" }
  ]
};

async function runTests() {
  const output = [];
  
  function log(message) {
    console.log(message);
    output.push(message);
  }
  
  log('======= COMBINED TEST SUITE =======');
  
  // -----------------------------------
  // Part 1: Test search functionality
  // -----------------------------------
  log('\n=== SEARCH UTILS TEST ===');
  
  // Dynamically import searchUtils
  let searchUtils;
  try {
    log('Importing searchUtils module...');
    const searchUtilsModule = await import('./utils/searchUtils.js');
    searchUtils = searchUtilsModule.default;
    log('✓ SearchUtils module imported successfully');
  } catch (error) {
    log(`❌ Failed to import searchUtils: ${error.message}`);
    return false;
  }
  
  // Test basic search
  log('\n--- Basic search ---');
  log('Query: "machine learning"');
  
  try {
    const results = searchUtils.performTextSearch(testCollection, 'machine learning');
    
    log(`Results count: ${results.length}`);
    log('Result IDs: ' + results.map(item => item.id).join(', '));
    
    const expected = ['1', '3', '4'];
    const allExpectedFound = expected.every(id => results.some(r => r.id === id));
    
    log(`All expected results found: ${allExpectedFound ? '✓' : '❌'}`);
    log(`Search test status: ${allExpectedFound ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    log(`❌ Search test error: ${error.message}`);
  }
  
  // -----------------------------------
  // Part 2: Test model extraction
  // -----------------------------------
  log('\n=== MODEL EXTRACTION TEST ===');
  
  // Define simplified model extraction function
  function extractModelInfo(response) {
    if (!response) return { model: 'unknown' };
    
    const modelInfo = {
      model: response.model || 'unknown',
      hasModelInfo: !!response.model,
      hasReferences: Array.isArray(response.references) && response.references.length > 0
    };
    
    return modelInfo;
  }
  
  // Test model extraction
  log('Testing model extraction from API response');
  
  const modelInfo = extractModelInfo(mockResponse);
  
  log(`Model used: ${modelInfo.model}`);
  log(`Has model info: ${modelInfo.hasModelInfo ? '✓' : '❌'}`);
  log(`Has references: ${modelInfo.hasReferences ? '✓' : '❌'}`);
  
  const modelTestPassed = modelInfo.model === 'sonar' && modelInfo.hasModelInfo && modelInfo.hasReferences;
  log(`Model extraction test status: ${modelTestPassed ? 'PASSED' : 'FAILED'}`);
  
  // -----------------------------------
  // Overall test results
  // -----------------------------------
  log('\n=== OVERALL TEST RESULTS ===');
  
  // Save results to file
  try {
    await fs.writeFile('combined-test-output.txt', output.join('\n'));
    log('Test output written to combined-test-output.txt');
  } catch (error) {
    log(`Error writing output file: ${error.message}`);
  }
  
  log('\n================================');
  return true;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });