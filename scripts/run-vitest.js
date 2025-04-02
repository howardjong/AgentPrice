/**
 * Script to run Vitest tests with configurable options
 * 
 * Usage:
 * node scripts/run-vitest.js [options]
 * 
 * Options:
 * --coverage            Generate coverage report
 * --run-isolated        Run tests in isolation mode
 * --testNamePattern=X   Run only tests matching pattern X
 * 
 * Examples:
 * node scripts/run-vitest.js --coverage
 * node scripts/run-vitest.js --testNamePattern="Socket" --run-isolated
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  coverage: args.includes('--coverage'),
  runIsolated: args.includes('--run-isolated'),
  testNamePattern: args.find(arg => arg.startsWith('--testNamePattern='))
    ?.split('=')[1]
    ?.replace(/"/g, '')
};

// Build the Vitest command
function buildVitestCommand() {
  let command = 'npx vitest run';
  
  if (options.coverage) {
    command += ' --coverage';
  }
  
  if (options.runIsolated) {
    command += ' --isolate';
  }
  
  if (options.testNamePattern) {
    command += ` -t "${options.testNamePattern}"`;
  }
  
  return command;
}

// Execute the Vitest tests
function runTests() {
  console.log('🧪 Running Vitest tests with the following options:');
  console.log(options);
  console.log('--------------------------------------------------------');
  
  const command = buildVitestCommand();
  console.log(`Executing: ${command}\n`);
  
  try {
    // Run the command and pipe output to console
    execSync(command, { stdio: 'inherit' });
    
    // If we're generating coverage, save a timestamp file
    if (options.coverage) {
      const timestamp = new Date().toISOString();
      fs.writeFileSync(
        path.join(__dirname, '..', 'coverage', 'last-run.txt'),
        `Coverage last generated: ${timestamp}\n`
      );
    }
    
    console.log('\n✅ Tests completed successfully');
  } catch (error) {
    console.error('\n❌ Tests failed with error:', error.message);
    process.exit(1);
  }
}

// Verify Vitest config exists
function verifyVitestConfig() {
  const configPath = path.join(__dirname, '..', 'vitest.config.js');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: vitest.config.js not found. Please ensure it exists before running tests.');
    process.exit(1);
  }
  
  console.log('✅ Found vitest.config.js');
}

// Main function
function main() {
  console.log('🚀 Starting Vitest test runner...');
  verifyVitestConfig();
  runTests();
}

main();