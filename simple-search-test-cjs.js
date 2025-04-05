/**
 * Simple Search Test (CommonJS version)
 * 
 * A straightforward test for the searchUtils functionality
 */

const fs = require('fs').promises;
const searchUtils = require('./utils/searchUtils');

async function runSearchTest() {
  const output = [];
  
  function log(message) {
    console.log(message);
    output.push(message);
  }
  
  log('======= SEARCH UTILS TEST (CJS) =======');
  
  const testCollection = [
    { id: '1', title: 'Machine Learning Basics', content: 'Introduction to ML concepts and applications.' },
    { id: '2', title: 'JavaScript Programming', content: 'Web development with JavaScript.' },
    { id: '3', title: 'CSS Styling', content: 'Styling web pages with machine learning examples.' },
    { id: '4', title: 'Database Design', content: 'SQL database design', description: 'Includes machine learning applications.' }
  ];
  
  // Test 1: Basic search with multiple results
  log('\n--- Test 1: Basic search ---');
  log('Query: "machine learning"');
  const results1 = searchUtils.performTextSearch(testCollection, 'machine learning');
  
  log(`Results count: ${results1.length}`);
  log('Result IDs: ' + results1.map(item => item.id).join(', '));
  
  const expected1 = ['1', '3', '4'];
  const allExpectedFound1 = expected1.every(id => results1.some(r => r.id === id));
  
  log(`All expected results found: ${allExpectedFound1 ? '✓' : '❌'}`);
  
  // Test 2: Search with no results
  log('\n--- Test 2: Search with no results ---');
  log('Query: "blockchain technology"');
  const results2 = searchUtils.performTextSearch(testCollection, 'blockchain technology');
  
  log(`Results count: ${results2.length}`);
  log(`No results returned: ${results2.length === 0 ? '✓' : '❌'}`);
  
  // Overall test results
  const allTestsPassed = allExpectedFound1 && results2.length === 0;
  
  log('\n--- Overall Results ---');
  log(`Test passed: ${allTestsPassed ? '✓' : '❌'}`);
  
  // Save results to file
  try {
    await fs.writeFile('search-test-output.txt', output.join('\n'));
    log('\nTest output written to search-test-output.txt');
  } catch (error) {
    log(`Error writing output file: ${error.message}`);
  }
  
  return allTestsPassed;
}

// Run the test
runSearchTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });