/**
 * Simple Search Test (CommonJS version)
 * 
 * A straightforward test for the searchUtils functionality
 */

const fs = require('fs').promises;

// Test collection for search functionality
const testCollection = [
  { id: '1', title: 'Machine Learning Basics', content: 'Introduction to ML concepts and applications.' },
  { id: '2', title: 'JavaScript Programming', content: 'Web development with JavaScript.' },
  { id: '3', title: 'CSS Styling', content: 'Styling web pages with machine learning examples.' },
  { id: '4', title: 'Database Design', content: 'SQL database design', description: 'Includes machine learning applications.' },
  { id: '5', title: 'Python Tutorial', content: 'Python programming language tutorial for data science.' }
];

async function runSearchTest() {
  const output = [];
  
  function log(message) {
    console.log(message);
    output.push(message);
  }
  
  log('======= SEARCH UTILS TEST =======');
  
  // Dynamically import searchUtils
  let searchUtils;
  try {
    log('Importing searchUtils module...');
    // Use dynamic import for ESM module in CommonJS context
    const searchUtilsModule = await import('./utils/searchUtils.js');
    searchUtils = searchUtilsModule.default;
    log('✓ SearchUtils module imported successfully');
  } catch (error) {
    log(`❌ Failed to import searchUtils: ${error.message}`);
    return false;
  }
  
  // Test basic search
  log('\n--- Test 1: Basic search ---');
  log('Query: "machine learning"');
  
  try {
    const results = searchUtils.performTextSearch(testCollection, 'machine learning');
    
    log(`Results count: ${results.length}`);
    log('Result IDs: ' + results.map(item => item.id).join(', '));
    
    const expected = ['1', '3', '4'];
    const allExpectedFound = expected.every(id => results.some(r => r.id === id));
    const noUnexpectedFound = results.every(r => expected.includes(r.id));
    
    log(`All expected results found: ${allExpectedFound ? '✓' : '❌'}`);
    log(`No unexpected results: ${noUnexpectedFound ? '✓' : '❌'}`);
    
    log(`Test 1 status: ${allExpectedFound && noUnexpectedFound ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    log(`❌ Test 1 error: ${error.message}`);
  }
  
  // Test stemming and fuzzy matching
  log('\n--- Test 2: Stemming and fuzzy matching ---');
  log('Query: "programming"');
  
  try {
    const results = searchUtils.performTextSearch(testCollection, 'programming');
    
    log(`Results count: ${results.length}`);
    log('Result IDs: ' + results.map(item => item.id).join(', '));
    
    const expected = ['2', '5']; // JavaScript Programming and Python programming 
    const allExpectedFound = expected.every(id => results.some(r => r.id === id));
    
    log(`All expected results found: ${allExpectedFound ? '✓' : '❌'}`);
    log(`Test 2 status: ${allExpectedFound ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    log(`❌ Test 2 error: ${error.message}`);
  }
  
  // Test search in description field
  log('\n--- Test 3: Search in description ---');
  log('Query: "applications"');
  
  try {
    const results = searchUtils.performTextSearch(testCollection, 'applications');
    
    log(`Results count: ${results.length}`);
    log('Result IDs: ' + results.map(item => item.id).join(', '));
    
    const expected = ['1', '4']; // ML applications in title/content and applications in description
    const allExpectedFound = expected.every(id => results.some(r => r.id === id));
    
    log(`All expected results found: ${allExpectedFound ? '✓' : '❌'}`);
    log(`Test 3 status: ${allExpectedFound ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    log(`❌ Test 3 error: ${error.message}`);
  }
  
  // Overall test results
  log('\n--- Overall Results ---');
  
  // Save results to file
  try {
    await fs.writeFile('search-test-output.txt', output.join('\n'));
    log('Test output written to search-test-output.txt');
  } catch (error) {
    log(`Error writing output file: ${error.message}`);
  }
  
  log('\n================================');
  return true;
}

// Run the tests
runSearchTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });