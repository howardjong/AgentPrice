/**
 * Run Vitest Tests
 * 
 * This script runs Vitest tests for utility functions that have been
 * migrated from Jest to Vitest
 */

import { execSync } from 'child_process';

// Run the utility tests
console.log('Running utility tests with Vitest...');

try {
  // Run specific utility tests that have been migrated
  const testFiles = [
    'tests/unit/utils/*.vitest.js',
  ];

  // Execute the tests
  execSync(`npx vitest run ${testFiles.join(' ')}`, { stdio: 'inherit' });
  
  console.log('\n✅ Utility tests completed successfully');
} catch (error) {
  console.error('\n❌ Some tests failed', error.message);
  process.exit(1);
}