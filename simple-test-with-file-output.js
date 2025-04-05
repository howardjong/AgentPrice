/**
 * Simple Test with File Output
 * 
 * This script runs the tests and writes results to a file
 */

import fs from 'fs/promises';
import searchUtils from './utils/searchUtils.js';

async function runTest() {
  const output = [];
  
  function log(message) {
    console.log(message);
    output.push(message);
  }
  
  log('======= COMBINED TEST WITH FILE OUTPUT =======');
  
  // 1. Run Search Utils Test
  log('\n--- SEARCH UTILS TEST ---');
  
  const testCollection = [
    { id: '1', title: 'Machine Learning Basics', content: 'Introduction to ML' },
    { id: '2', title: 'JavaScript', content: 'Programming language' },
    { id: '3', title: 'CSS Styling', content: 'Machine learning concepts' },
    { id: '4', title: 'Database', content: 'SQL', description: 'Machine learning applications' }
  ];
  
  log('Searching for: "machine learning"');
  const results = searchUtils.performTextSearch(testCollection, 'machine learning');
  
  log(`Results count: ${results.length}`);
  log('Result IDs: ' + results.map(item => item.id).join(', '));
  
  const expected = ['1', '3', '4'];
  const allExpectedFound = expected.every(id => results.map(r => r.id).includes(id));
  
  log(`All expected results found: ${allExpectedFound ? '✓' : '❌'}`);
  
  // Save results to file
  try {
    await fs.writeFile('test-output.txt', output.join('\n'));
    log('\nTest output written to test-output.txt');
  } catch (error) {
    log(`Error writing output file: ${error.message}`);
  }
}

runTest().catch(console.error);