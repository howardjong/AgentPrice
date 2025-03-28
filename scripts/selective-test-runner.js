
#!/usr/bin/env node

/**
 * Selective Test Runner
 * 
 * A utility to selectively run tests across different frameworks
 * with resource management to prevent overloading the system.
 */

import { execa } from 'execa';
import minimist from 'minimist';
import os from 'os';
import { setTimeout } from 'timers/promises';

const args = minimist(process.argv.slice(2), {
  string: ['test', 'framework'],
  boolean: ['verbose', 'help', 'compare', 'optimize'],
  alias: {
    t: 'test',
    f: 'framework',
    v: 'verbose',
    c: 'compare',
    o: 'optimize',
    h: 'help'
  },
  default: {
    framework: 'vitest',
    optimize: true
  }
});

if (args.help) {
  console.log(`
Selective Test Runner - Run tests efficiently during migration

Usage:
  node scripts/selective-test-runner.js [options]

Options:
  --test, -t       Test module to run (e.g., "circuitBreaker", "logger")
  --framework, -f  Framework to use: "jest", "vitest", or "both" (default: "vitest")
  --compare, -c    Compare results between Jest and Vitest (implies --framework=both)
  --optimize, -o   Apply resource optimization (default: true)
  --verbose, -v    Show detailed output
  --help, -h       Show this help

Examples:
  # Run a single test with vitest
  node scripts/selective-test-runner.js -t circuitBreaker

  # Run and compare a test in both frameworks
  node scripts/selective-test-runner.js -t circuitBreaker -c

  # Run all tests with jest without resource optimization
  node scripts/selective-test-runner.js -f jest --no-optimize
  `);
  process.exit(0);
}

// If compare is requested, force framework to "both"
if (args.compare) {
  args.framework = 'both';
}

// Resource limits
const NUM_CPUS = os.cpus().length;
const MEM_LIMIT = Math.floor(os.totalmem() / (1024 * 1024) * 0.7); // 70% of total memory

// Optimize for available resources
async function optimizeResources() {
  if (args.verbose) {
    console.log(`\n🔧 Optimizing resources for testing...`);
    console.log(`   Available CPUs: ${NUM_CPUS}`);
    console.log(`   Memory limit: ${MEM_LIMIT}MB (70% of total)\n`);
  }

  // Force garbage collection if possible
  if (global.gc) {
    global.gc();
  }
  
  // Small delay to allow GC to complete
  await setTimeout(500);
}

// Function to run a test with the specified framework
async function runTest(framework, testName) {
  console.log(`\n🧪 Running ${testName} with ${framework}...`);
  
  try {
    let result;
    
    if (framework === 'jest') {
      // Run Jest test
      result = await execa('node', [
        '--experimental-vm-modules',
        'node_modules/.bin/jest',
        `tests/unit/**/${testName}.test.js`,
        '--detectOpenHandles'
      ], { 
        reject: false,
        env: { 
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=256' // Lower memory for Jest
        }
      });
    } else if (framework === 'vitest') {
      // Run Vitest test
      result = await execa('npx', [
        'vitest',
        'run',
        `tests/unit/**/${testName}.vitest.js`
      ], { 
        reject: false,
        env: { 
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=256' // Lower memory for Vitest
        }
      });
    }
    
    const success = result.exitCode === 0;
    
    // Output results
    if (args.verbose) {
      console.log(`\n--- ${framework} Output ---`);
      console.log(result.stdout);
      if (result.stderr) console.log(result.stderr);
    }
    
    console.log(`${success ? '✅' : '❌'} ${framework}: ${success ? 'Pass' : 'Fail'}`);
    
    return {
      success,
      output: result.stdout + '\n' + result.stderr
    };
  } catch (error) {
    console.error(`❌ Error running ${framework} test:`, error.message);
    return {
      success: false,
      output: error.message
    };
  }
}

// Function to compare test results
async function compareTestResults(testName) {
  console.log(`\n🔍 Comparing test results for: ${testName}`);
  
  if (args.optimize) await optimizeResources();
  
  // Run Jest test
  const jestResult = await runTest('jest', testName);
  
  // Force cleanup before running next test
  if (args.optimize) await optimizeResources();
  
  // Run Vitest test
  const vitestResult = await runTest('vitest', testName);
  
  // Compare results
  const consistentResults = jestResult.success === vitestResult.success;
  
  console.log(`\n📊 Comparison Results:`);
  console.log(`   Jest:   ${jestResult.success ? '✅ Pass' : '❌ Fail'}`);
  console.log(`   Vitest: ${vitestResult.success ? '✅ Pass' : '❌ Fail'}`);
  console.log(`   Consistency: ${consistentResults ? '✅ Results match' : '❓ Results differ'}`);
  
  return consistentResults;
}

// Main function
async function main() {
  // Validate arguments
  if (!['jest', 'vitest', 'both'].includes(args.framework)) {
    console.error(`❌ Invalid framework: ${args.framework}. Use "jest", "vitest", or "both".`);
    process.exit(1);
  }
  
  // Get test modules to run
  let testModules = [];
  if (args.test) {
    testModules = [args.test];
  } else {
    console.error('❌ Please specify a test module with --test or -t');
    process.exit(1);
  }
  
  console.log(`\n🚀 Selective Test Runner`);
  console.log(`   Test modules: ${testModules.join(', ')}`);
  console.log(`   Framework: ${args.framework}`);
  console.log(`   Resource optimization: ${args.optimize ? 'enabled' : 'disabled'}`);
  
  // Optimize resources before starting
  if (args.optimize) await optimizeResources();
  
  // Run tests for each module
  for (const testModule of testModules) {
    if (args.compare) {
      // Compare test results
      await compareTestResults(testModule);
    } else {
      // Run with selected framework
      if (args.framework === 'both') {
        await runTest('jest', testModule);
        if (args.optimize) await optimizeResources();
        await runTest('vitest', testModule);
      } else {
        await runTest(args.framework, testModule);
      }
    }
    
    // Cleanup between test modules
    if (args.optimize && testModules.length > 1) {
      await optimizeResources();
    }
  }
  
  console.log('\n✅ Testing complete');
}

// Run main
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
