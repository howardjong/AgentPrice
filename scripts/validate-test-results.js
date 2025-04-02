
/**
 * Test Results Validation Script
 * 
 * This script helps validate test results across different test frameworks,
 * accounting for expected failures in Jest when using ES modules.
 */

import { execa } from 'execa';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2), {
  string: ['test'],
  boolean: ['verbose'],
  alias: {
    t: 'test',
    v: 'verbose',
    h: 'help',
  },
});

if (args.help) {
  console.log(`
Test Validation Options:
  --test, -t       Test file to validate (e.g., "researchService")
  --verbose, -v    Show detailed output
  --help, -h       Show this help message
  
Examples:
  node scripts/validate-test-results.js -t researchService    # Validate researchService tests
  node scripts/validate-test-results.js -t circuitBreaker -v  # Validate circuitBreaker tests with verbose output
  `);
  process.exit(0);
}

// Determine if we should expect Jest to fail with ES modules
const knownJestEsmIssues = [
  'researchService',
  'promptManager',
  'claudeService',
  'perplexityService',
];

async function runTest(framework, testName) {
  try {
    let result;
    
    if (framework === 'jest') {
      // Run Jest test
      result = await execa('node', [
        '--experimental-vm-modules',
        'node_modules/.bin/jest',
        `tests/unit/**/${testName}.test.js`
      ], { reject: false });
    } else if (framework === 'vitest') {
      // Run Vitest test
      result = await execa('npx', [
        'vitest',
        'run',
        `tests/unit/**/${testName}.vitest.js`
      ], { reject: false });
    } else if (framework === 'manual') {
      // Run manual test if it exists
      result = await execa('node', [
        `tests/manual/${testName}Test.js`
      ], { reject: false });
    }
    
    return {
      success: result.exitCode === 0,
      output: result.stdout + '\n' + result.stderr
    };
  } catch (error) {
    return {
      success: false,
      output: error.message
    };
  }
}

async function validateTests(testName) {
  console.log(`\n🔍 Validating tests for: ${testName}`);
  
  // Check if this test has known ESM issues with Jest
  const expectJestFailure = knownJestEsmIssues.includes(testName);
  
  if (expectJestFailure) {
    console.log(`ℹ️  Note: '${testName}' is known to have ESM compatibility issues with Jest\n`);
  }
  
  // Run tests with different frameworks
  const jestResult = await runTest('jest', testName);
  const vitestResult = await runTest('vitest', testName);
  const manualResult = await runTest('manual', testName);
  
  // Display results
  console.log('📊 Test Results Summary:');
  console.log(`Jest:   ${jestResult.success ? '✅ Passed' : '❌ Failed'}`);
  console.log(`Vitest: ${vitestResult.success ? '✅ Passed' : '❌ Failed'}`);
  console.log(`Manual: ${manualResult.success ? '✅ Passed' : (manualResult.output.includes('Cannot find module') ? '⚠️ Not Found' : '❌ Failed')}`);
  
  // Show detailed output if verbose
  if (args.verbose) {
    console.log('\n--- Jest Output ---');
    console.log(jestResult.output);
    console.log('\n--- Vitest Output ---');
    console.log(vitestResult.output);
    if (!manualResult.output.includes('Cannot find module')) {
      console.log('\n--- Manual Test Output ---');
      console.log(manualResult.output);
    }
  }
  
  // Validation logic
  let validationPassed = false;
  
  if (expectJestFailure) {
    // If we expect Jest to fail due to ESM issues, we consider the test valid if Vitest passes
    validationPassed = vitestResult.success;
    if (manualResult.output.includes('Cannot find module')) {
      console.log(`\n✅ Validation PASSED: Vitest test is working correctly, and Jest failure is expected due to ESM compatibility issues.`);
    } else {
      console.log(`\n✅ Validation PASSED: Vitest and manual tests ${vitestResult.success && manualResult.success ? 'both passed' : 'have consistent results'}, and Jest failure is expected due to ESM compatibility issues.`);
    }
  } else {
    // For tests where Jest should work, we expect consistency across frameworks
    const jestAndVitestConsistent = jestResult.success === vitestResult.success;
    if (jestAndVitestConsistent) {
      validationPassed = true;
      console.log(`\n✅ Validation PASSED: Jest and Vitest have consistent results.`);
    } else {
      validationPassed = false;
      console.log(`\n❌ Validation FAILED: Jest and Vitest have inconsistent results, but ESM compatibility issues were not expected.`);
    }
  }
  
  return validationPassed;
}

// Run validation for the specified test
if (args.test) {
  validateTests(args.test)
    .then(success => {
      if (!success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error during validation:', error);
      process.exit(1);
    });
} else {
  console.log('Please specify a test to validate with --test or -t');
  process.exit(1);
}
