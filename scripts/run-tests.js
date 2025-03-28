
/**
 * Unified Test Runner
 * 
 * This script provides a streamlined way to run tests with various options
 */

import { execa } from 'execa';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2), {
  string: ['filter', 'mode'],
  boolean: ['watch', 'coverage', 'ui', 'minimal'],
  alias: {
    f: 'filter',
    w: 'watch',
    c: 'coverage',
    m: 'mode',
    u: 'ui',
    h: 'help',
  },
  default: {
    mode: 'unit',
    watch: false,
    coverage: false,
    ui: false,
    minimal: false,
  },
});

if (args.help) {
  console.log(`
Test Runner Options:
  --mode, -m       Test mode: unit, integration, e2e, performance, all (default: unit)
  --filter, -f     Filter tests by name pattern
  --watch, -w      Watch mode
  --coverage, -c   Generate coverage report
  --ui, -u         Run tests with UI
  --minimal        Run minimal test set (no API calls)
  --help, -h       Show this help message
  
Examples:
  node scripts/run-tests.js -m unit -f "circuit"    # Run unit tests with "circuit" in the name
  node scripts/run-tests.js -m all -c               # Run all tests with coverage
  node scripts/run-tests.js -m integration --minimal # Run minimal integration tests
  `);
  process.exit(0);
}

// Define test patterns based on mode
const testPatterns = {
  unit: 'tests/unit/**/*.test.js',
  integration: 'tests/integration/**/*.test.js',
  e2e: 'tests/e2e/**/*.test.js',
  performance: 'tests/performance/**/*.test.js',
  all: 'tests/**/*.test.js',
};

// Prepare environment variables
const env = { ...process.env };
if (args.minimal) {
  env.DISABLE_LLM_CALLS = 'true';
  env.USE_MOCK_DATA = 'true';
}

// Build vitest command arguments
const vitestArgs = ['run'];

// Add the appropriate test pattern
if (args.mode in testPatterns) {
  vitestArgs.push(testPatterns[args.mode]);
} else {
  console.error(`Unknown mode: ${args.mode}`);
  process.exit(1);
}

// Add filter if specified
if (args.filter) {
  vitestArgs.push('-t', args.filter);
}

// Add watch mode if enabled
if (args.watch) {
  vitestArgs[0] = 'watch'; // Replace 'run' with 'watch'
}

// Add coverage if enabled
if (args.coverage) {
  vitestArgs.push('--coverage');
}

// Add UI if enabled
if (args.ui) {
  vitestArgs[0] = 'ui'; // Replace 'run' with 'ui'
}

// Display the command being run
console.log(`Running: vitest ${vitestArgs.join(' ')}`);

// Execute vitest with the arguments
try {
  const result = await execa('vitest', vitestArgs, { 
    env,
    stdio: 'inherit',
  });
  process.exit(result.exitCode);
} catch (error) {
  console.error('Error running tests:', error.message);
  process.exit(1);
}
