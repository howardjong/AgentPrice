/**
 * Memory-Optimized Test Runner
 * 
 * This script runs Vitest tests with memory optimization techniques.
 * It batches test files to avoid memory pressure and automatically
 * restarts if memory thresholds are exceeded.
 */

import { promisify } from 'util';
import { exec as execCb, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const exec = promisify(execCb);

// Configuration
const MEMORY_THRESHOLD_MB = 300;
const BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES_MS = 1000;
const NODE_ARGS = [
  '--max-old-space-size=512', 
  '--expose-gc'
];

// Color codes for output
const COLOR = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Find all Vitest test files
 */
async function findTestFiles(patterns = ['**/*.vitest.js']) {
  let allFiles = [];
  
  for (const pattern of patterns) {
    // Use find to locate files matching the pattern
    const { stdout } = await exec(`find . -path "./node_modules" -prune -o -path "${pattern}" -print`);
    const files = stdout.trim().split('\n').filter(Boolean);
    allFiles = [...allFiles, ...files];
  }
  
  return [...new Set(allFiles)].sort();
}

/**
 * Get the current memory usage
 */
function getMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  return {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };
}

/**
 * Log memory usage
 */
function logMemoryUsage(label) {
  const memory = getMemoryUsage();
  console.log(`${COLOR.blue}${label} Memory Usage:${COLOR.reset} RSS: ${memory.rss}MB, Heap: ${memory.heapUsed}MB`);
  return memory;
}

/**
 * Force garbage collection if possible
 */
function forceGarbageCollection() {
  if (global.gc) {
    console.log(`${COLOR.yellow}Forcing garbage collection...${COLOR.reset}`);
    const before = getMemoryUsage();
    global.gc();
    const after = getMemoryUsage();
    console.log(`${COLOR.green}Garbage collection complete.${COLOR.reset} Freed: ${before.heapUsed - after.heapUsed}MB`);
  } else {
    console.log(`${COLOR.yellow}Garbage collection not available. Run with --expose-gc.${COLOR.reset}`);
  }
}

/**
 * Run a specific test file
 */
async function runTestFile(testFile, options = {}) {
  const { watch = false, ui = false, update = false } = options;
  
  const args = [
    'node_modules/vitest/vitest.mjs', 
    'run',
    testFile,
    '--config', 
    'vitest.config.js',
    '--threads', 
    'false'
  ];
  
  if (watch) args.splice(2, 1, 'watch');
  if (ui) args.push('--ui');
  if (update) args.push('--update');
  
  console.log(`${COLOR.cyan}Running test: ${COLOR.reset}${testFile}`);
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [...NODE_ARGS, ...args], { 
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--no-warnings' }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Test exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Run tests in batches to manage memory
 */
async function runTestsInBatches(testFiles, batchSize = BATCH_SIZE, options = {}) {
  const totalFiles = testFiles.length;
  const batches = Math.ceil(totalFiles / batchSize);
  
  console.log(`${COLOR.green}Running ${totalFiles} test files in ${batches} batches${COLOR.reset}`);
  
  const results = {
    passed: [],
    failed: []
  };
  
  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, totalFiles);
    const batch = testFiles.slice(start, end);
    
    console.log(`\n${COLOR.magenta}Batch ${i + 1}/${batches}:${COLOR.reset} Running ${batch.length} test files\n`);
    
    // Run tests in this batch sequentially
    for (const testFile of batch) {
      try {
        await runTestFile(testFile, options);
        results.passed.push(testFile);
      } catch (error) {
        console.error(`${COLOR.red}Error running test ${testFile}:${COLOR.reset}`, error.message);
        results.failed.push(testFile);
      }
      
      // Check memory after each test
      const memory = logMemoryUsage('After test');
      
      // Force GC if memory is getting high
      if (memory.heapUsed > MEMORY_THRESHOLD_MB * 0.8) {
        forceGarbageCollection();
      }
      
      // Brief delay between tests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Delay between batches and force GC
    if (i < batches - 1) {
      console.log(`\n${COLOR.yellow}Waiting between batches...${COLOR.reset}`);
      forceGarbageCollection();
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }
  
  return results;
}

/**
 * Print test summary
 */
function printSummary(results) {
  console.log('\n' + '='.repeat(50));
  console.log(`${COLOR.magenta}Test Summary:${COLOR.reset}`);
  console.log('='.repeat(50));
  
  console.log(`${COLOR.green}Passed: ${results.passed.length} tests${COLOR.reset}`);
  
  if (results.failed.length > 0) {
    console.log(`${COLOR.red}Failed: ${results.failed.length} tests${COLOR.reset}`);
    console.log('\nFailed tests:');
    results.failed.forEach(file => console.log(`  ${COLOR.red}✗${COLOR.reset} ${file}`));
  } else {
    console.log(`${COLOR.green}All tests passed!${COLOR.reset}`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    watch: args.includes('--watch'),
    ui: args.includes('--ui'),
    update: args.includes('--update'),
    pattern: args.find(arg => arg.startsWith('--pattern='))?.split('=')[1] || '**/*.vitest.js',
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || BATCH_SIZE, 10)
  };
  
  console.log(`${COLOR.cyan}Memory-Optimized Test Runner${COLOR.reset}`);
  console.log(`${COLOR.cyan}Options:${COLOR.reset}`, options);
  
  // Log initial memory state
  logMemoryUsage('Initial');
  
  // Find test files
  let testFiles = [];
  try {
    if (args.length > 0 && !args[0].startsWith('--')) {
      // Specific test files provided
      testFiles = args.filter(arg => !arg.startsWith('--'));
      console.log(`${COLOR.cyan}Running specific test files:${COLOR.reset}`, testFiles);
    } else {
      // Find all test files matching pattern
      const pattern = options.pattern;
      console.log(`${COLOR.cyan}Finding test files matching pattern:${COLOR.reset} ${pattern}`);
      testFiles = await findTestFiles([pattern]);
      console.log(`${COLOR.cyan}Found ${testFiles.length} test files${COLOR.reset}`);
    }
    
    if (testFiles.length === 0) {
      console.log(`${COLOR.yellow}No test files found!${COLOR.reset}`);
      return;
    }
    
    // Run tests in batches
    const results = await runTestsInBatches(testFiles, options.batchSize, options);
    
    // Print summary
    printSummary(results);
    
    // Final memory usage
    logMemoryUsage('Final');
    
    // Report overall success/failure
    if (results.failed.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`${COLOR.red}Error running tests:${COLOR.reset}`, error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(`${COLOR.red}Unhandled error:${COLOR.reset}`, error);
  process.exit(1);
});