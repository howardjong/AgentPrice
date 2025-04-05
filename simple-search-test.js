/**
 * Simple Search Test
 * 
 * A straightforward test for the searchUtils functionality
 */

import fs from 'fs/promises';
import searchUtils from './utils/searchUtils.js';

async function runSearchTest() {
  const output = [];
  
  function log(message) {
    console.log(message);
    output.push(message);
  }
  
  log('======= SEARCH UTILS TEST =======');
  
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
  
  // Test 3: Search with exact match in title
  log('\n--- Test 3: Exact match in title ---');
  log('Query: "JavaScript Programming"');
  const results3 = searchUtils.performTextSearch(testCollection, 'JavaScript Programming');
  
  log(`Results count: ${results3.length}`);
  log('Result IDs: ' + results3.map(item => item.id).join(', '));
  log(`Exact title match found: ${results3.some(r => r.id === '2') ? '✓' : '❌'}`);
  
  // Test 4: Case insensitive search
  log('\n--- Test 4: Case insensitive search ---');
  log('Query: "javascript"');
  const results4 = searchUtils.performTextSearch(testCollection, 'javascript');
  
  log(`Results count: ${results4.length}`);
  log('Result IDs: ' + results4.map(item => item.id).join(', '));
  log(`Case-insensitive match found: ${results4.some(r => r.id === '2') ? '✓' : '❌'}`);
  
  // Test 5: Testing with options
  if (typeof searchUtils.performTextSearch === 'function' && 
      searchUtils.performTextSearch.length >= 3) {
    log('\n--- Test 5: Search with options ---');
    log('Query: "machine" with matchThreshold: 0.3');
    
    const results5 = searchUtils.performTextSearch(testCollection, 'machine', { 
      matchThreshold: 0.3,
      fields: ['title', 'content', 'description'] 
    });
    
    log(`Results count: ${results5.length}`);
    log('Result IDs: ' + results5.map(item => item.id).join(', '));
    
    const expected5 = ['1', '3', '4'];
    const allExpectedFound5 = expected5.every(id => results5.some(r => r.id === id));
    
    log(`All expected results found: ${allExpectedFound5 ? '✓' : '❌'}`);
  } else {
    log('\n--- Test 5: Search with options ---');
    log('SKIPPED: performTextSearch does not support options parameter');
  }
  
  // Overall test results
  const allTestsPassed = allExpectedFound1 && 
                         results2.length === 0 && 
                         results3.some(r => r.id === '2') && 
                         results4.some(r => r.id === '2');
  
  log('\n--- Overall Results ---');
  log(`All tests passed: ${allTestsPassed ? '✓' : '❌'}`);
  
  // Save results to file
  try {
    await fs.writeFile('search-test-output.txt', output.join('\n'));
    log('\nTest output written to search-test-output.txt');
  } catch (error) {
    log(`Error writing output file: ${error.message}`);
  }
  
  return allTestsPassed;
}

// Run the test if executed directly
if (process.argv[1] === import.meta.url) {
  runSearchTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { runSearchTest };