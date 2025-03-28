#!/usr/bin/env node

/**
 * Selective Test Runner
 * 
 * A utility to selectively run tests across different frameworks
 * with resource management to prevent overloading the system.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Function to optimize resources before running tests
async function optimizeResources() {
  console.log('Optimizing system resources...');
  
  // Run garbage collection if possible
  if (global.gc) {
    global.gc();
  }
  
  // Set environment variables for better memory management
  process.env.NODE_OPTIONS = '--max-old-space-size=1024';
  
  // Ensure test output directory exists
  await fs.mkdir(path.join(ROOT_DIR, 'reports'), { recursive: true });
}

// Function to run a test with the specified framework
async function runTest(framework, testName) {
  console.log(`Running ${testName} with ${framework}...`);
  
  let command, args;
  
  if (framework === 'vitest') {
    command = 'npx';
    args = ['vitest', 'run', testName, '--reporter', 'default'];
  } else if (framework === 'jest') {
    command = 'npx';
    args = ['jest', testName, '--no-cache', '--forceExit'];
  } else {
    throw new Error(`Unsupported test framework: ${framework}`);
  }
  
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=1024'
      }
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          framework,
          testName
        });
      } else {
        resolve({
          success: false,
          framework,
          testName,
          code
        });
      }
    });
    
    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Function to compare test results across frameworks
async function compareTestResults(testName) {
  console.log(`Comparing test results for ${testName}...`);
  
  // Run with Jest
  const jestResult = await runTest('jest', testName);
  
  // Run with Vitest
  const vitestResult = await runTest('vitest', testName);
  
  console.log('\nResults comparison:');
  console.log('-'.repeat(50));
  console.log(`Jest: ${jestResult.success ? 'PASS' : 'FAIL'}`);
  console.log(`Vitest: ${vitestResult.success ? 'PASS' : 'FAIL'}`);
  console.log('-'.repeat(50));
  
  if (jestResult.success !== vitestResult.success) {
    console.warn('WARNING: Test results differ between frameworks!');
    
    if (jestResult.success && !vitestResult.success) {
      console.log('The test passes in Jest but fails in Vitest.');
      console.log('This could indicate an issue with the Vitest migration.');
    } else {
      console.log('The test passes in Vitest but fails in Jest.');
      console.log('This could indicate an ES module compatibility issue in Jest.');
    }
  } else {
    console.log('Test results are consistent across frameworks.');
  }
  
  return {
    testName,
    jestResult,
    vitestResult,
    consistent: jestResult.success === vitestResult.success
  };
}

// Main function
async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 1 || args.includes('--help')) {
      console.log('Usage: node selective-test-runner.js <command> [options]');
      console.log('\nCommands:');
      console.log('  run <framework> <test-name>   Run a specific test with the specified framework');
      console.log('  compare <test-name>           Compare test results across frameworks');
      console.log('\nOptions:');
      console.log('  --help                        Show this help message');
      console.log('\nExamples:');
      console.log('  node selective-test-runner.js run vitest "perplexityService"');
      console.log('  node selective-test-runner.js compare "circuitBreaker"');
      return;
    }
    
    await optimizeResources();
    
    const command = args[0];
    
    if (command === 'run') {
      if (args.length < 3) {
        console.error('Error: "run" command requires a framework and test name');
        process.exit(1);
      }
      
      const framework = args[1];
      const testName = args[2];
      
      const result = await runTest(framework, testName);
      process.exit(result.success ? 0 : 1);
    } else if (command === 'compare') {
      if (args.length < 2) {
        console.error('Error: "compare" command requires a test name');
        process.exit(1);
      }
      
      const testName = args[1];
      const result = await compareTestResults(testName);
      process.exit(result.consistent ? 0 : 1);
    } else {
      console.error(`Error: Unknown command ${command}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if this is the main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}