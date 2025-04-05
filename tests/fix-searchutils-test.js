/**
 * Fix SearchUtils Tests
 * 
 * This script demonstrates how to fix the failing tests in searchUtils.vitest.js
 * by properly aligning test data with expectations.
 */

import searchUtils from '../utils/searchUtils.js';

// Create a proper test collection that will match our search expectations
const testCollection = [
  { id: '1', title: 'Machine Learning Basics', content: 'Introduction to machine learning and AI.' },
  { id: '2', title: 'Deep Learning', content: 'Advanced neural networks for complex tasks.' },
  { id: '3', title: 'AI Ethics', content: 'Ethical considerations in artificial intelligence.' },
  { id: '4', title: 'Machine Learning Applications', content: 'Real-world machine learning use cases.' },
  { id: '5', title: 'Python for Data Science', content: 'Using Python for data analysis.' }
];

function basicSearchTest() {
  console.log('Testing basic search with all defaults...');
  
  // Original test had issues because of misalignment between text search and mock
  // The key is to ensure test data contains items that would naturally pass the search
  const result = searchUtils.performTextSearch(testCollection, 'machine learning');
  
  console.log('Search results:', result.map(item => item.id));
  
  // Verify the correct items are returned (items 1 and 4)
  const containsItem1 = result.some(item => item.id === '1');
  const containsItem4 = result.some(item => item.id === '4');
  const resultCount = result.length;
  
  console.log('Results contain item 1:', containsItem1 ? '✓' : '❌');
  console.log('Results contain item 4:', containsItem4 ? '✓' : '❌');
  console.log('Result count is 2:', resultCount === 2 ? '✓' : '❌');
  
  // Return true if all conditions are met
  return containsItem1 && containsItem4 && resultCount === 2;
}

function runTests() {
  console.log('=== Testing SearchUtils Fix ===');
  
  const tests = [
    { name: 'Basic Search Test', fn: basicSearchTest }
  ];
  
  let passCount = 0;
  
  // Run all tests
  for (const test of tests) {
    console.log(`\n🧪 Running: ${test.name}`);
    try {
      const passed = test.fn();
      if (passed) {
        console.log(`✅ ${test.name} passed!`);
        passCount++;
      } else {
        console.log(`❌ ${test.name} failed!`);
      }
    } catch (error) {
      console.error(`❌ ${test.name} failed with error:`, error.message);
    }
  }
  
  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passCount}/${tests.length}`);
  console.log(`Failed: ${tests.length - passCount}/${tests.length}`);
  
  return passCount === tests.length;
}

// Run tests if executed directly
if (process.argv[1] === import.meta.url) {
  console.log('Starting searchUtils tests...');
  const success = runTests();
  console.log('Tests completed with status:', success ? 'SUCCESS' : 'FAILURE');
  process.exit(success ? 0 : 1);
}

export { runTests, basicSearchTest };