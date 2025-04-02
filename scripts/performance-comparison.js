/**
 * Performance Comparison Tool
 * 
 * This script helps compare performance metrics between Jest and Vitest test runs.
 * It records execution time, memory usage, and coverage metrics for a fair comparison.
 * 
 * Usage: node scripts/performance-comparison.js [--component=NAME]
 * Example: node scripts/performance-comparison.js --component=Socket
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const component = args.find(arg => arg.startsWith('--component='))?.split('=')[1];

// Terminal colors
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

/**
 * Formats a duration in milliseconds to a human-readable string
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
}

/**
 * Formats bytes to a human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Measures performance of a test run
 */
function measurePerformance(command, name) {
  console.log(`\n${COLORS.bright}${COLORS.blue}Running performance test: ${name}${COLORS.reset}`);
  console.log(`${COLORS.cyan}Command: ${command}${COLORS.reset}`);
  
  const start = process.hrtime.bigint();
  let memoryBefore = process.memoryUsage();
  
  try {
    execSync(command, { 
      stdio: 'pipe',  // Capture output
      encoding: 'utf-8'
    });
    
    const end = process.hrtime.bigint();
    let memoryAfter = process.memoryUsage();
    
    // Calculate duration in milliseconds
    const duration = Number(end - start) / 1000000;
    
    // Calculate memory usage delta
    const memoryDelta = {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      external: memoryAfter.external - memoryBefore.external
    };
    
    return {
      success: true,
      duration,
      memoryUsage: memoryDelta,
      name
    };
  } catch (error) {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;
    
    console.error(`${COLORS.red}❌ Test run failed${COLORS.reset}`);
    console.error(`Error message: ${error.message}`);
    
    return {
      success: false,
      duration,
      name,
      error: error.message
    };
  }
}

/**
 * Runs a performance comparison
 */
function runPerformanceComparison() {
  console.log(`${COLORS.bright}${COLORS.magenta}PERFORMANCE COMPARISON: JEST VS VITEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.magenta}====================================${COLORS.reset}`);
  
  // Determine what tests to run
  let vitestCommand = 'npx vitest run';
  let jestCommand = 'npx jest';
  
  if (component) {
    console.log(`${COLORS.yellow}Running tests only for component: ${component}${COLORS.reset}`);
    vitestCommand += ` -t "${component}"`;
    jestCommand += ` -t "${component}"`;
  } else {
    console.log(`${COLORS.yellow}Running all tests${COLORS.reset}`);
  }
  
  // Run Vitest performance test
  const vitestResult = measurePerformance(vitestCommand, 'Vitest');
  
  // Run Jest performance test (if available)
  let jestResult;
  try {
    // Check if Jest is available
    execSync('npx jest --version', { stdio: 'pipe' });
    jestResult = measurePerformance(jestCommand, 'Jest');
  } catch (e) {
    console.log(`${COLORS.yellow}Jest is not available for comparison${COLORS.reset}`);
    jestResult = {
      success: false,
      name: 'Jest',
      error: 'Jest not installed'
    };
  }
  
  // Display comparison table
  console.log(`\n${COLORS.bright}${COLORS.magenta}COMPARISON RESULTS${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.magenta}=================${COLORS.reset}`);
  
  console.log('\n==========================================================');
  console.log('| Metric            | Vitest                | Jest                   |');
  console.log('|-------------------|------------------------|------------------------|');
  
  // Success/Failure
  console.log(`| Status            | ${vitestResult.success ? `${COLORS.green}Success${COLORS.reset}` : `${COLORS.red}Failed${COLORS.reset}`}                | ${jestResult?.success ? `${COLORS.green}Success${COLORS.reset}` : `${COLORS.red}Failed/N/A${COLORS.reset}`}                |`);
  
  // Execution Time
  if (vitestResult.success && jestResult?.success) {
    const timeComparison = ((jestResult.duration - vitestResult.duration) / jestResult.duration * 100).toFixed(2);
    console.log(`| Execution Time    | ${formatDuration(vitestResult.duration)}${' '.repeat(Math.max(0, 22 - formatDuration(vitestResult.duration).length))}| ${formatDuration(jestResult.duration)}${' '.repeat(Math.max(0, 22 - formatDuration(jestResult.duration).length))}|`);
    console.log(`| Time Difference   | ${timeComparison > 0 ? `${COLORS.green}${timeComparison}% faster${COLORS.reset}` : `${COLORS.red}${Math.abs(timeComparison)}% slower${COLORS.reset}`}${' '.repeat(Math.max(0, 22 - (timeComparison.toString().length + 8)))}| N/A                    |`);
  } else if (vitestResult.success) {
    console.log(`| Execution Time    | ${formatDuration(vitestResult.duration)}${' '.repeat(Math.max(0, 22 - formatDuration(vitestResult.duration).length))}| N/A                    |`);
  }
  
  // Memory Usage
  if (vitestResult.success && vitestResult.memoryUsage) {
    console.log(`| Memory (RSS)       | ${formatBytes(vitestResult.memoryUsage.rss)}${' '.repeat(Math.max(0, 22 - formatBytes(vitestResult.memoryUsage.rss).length))}| ${jestResult?.success && jestResult?.memoryUsage ? formatBytes(jestResult.memoryUsage.rss) : 'N/A'}${' '.repeat(Math.max(0, 22 - (jestResult?.success && jestResult?.memoryUsage ? formatBytes(jestResult.memoryUsage.rss).length : 3)))}|`);
    console.log(`| Memory (Heap)     | ${formatBytes(vitestResult.memoryUsage.heapUsed)}${' '.repeat(Math.max(0, 22 - formatBytes(vitestResult.memoryUsage.heapUsed).length))}| ${jestResult?.success && jestResult?.memoryUsage ? formatBytes(jestResult.memoryUsage.heapUsed) : 'N/A'}${' '.repeat(Math.max(0, 22 - (jestResult?.success && jestResult?.memoryUsage ? formatBytes(jestResult.memoryUsage.heapUsed).length : 3)))}|`);
  }
  
  console.log('==========================================================');
  
  // Performance Summary
  console.log(`\n${COLORS.bright}${COLORS.magenta}SUMMARY${COLORS.reset}`);
  if (vitestResult.success && jestResult?.success) {
    if (vitestResult.duration < jestResult.duration) {
      console.log(`${COLORS.green}✓ Vitest is faster than Jest by ${((jestResult.duration - vitestResult.duration) / jestResult.duration * 100).toFixed(2)}%${COLORS.reset}`);
    } else {
      console.log(`${COLORS.yellow}⚠ Vitest is slower than Jest by ${((vitestResult.duration - jestResult.duration) / jestResult.duration * 100).toFixed(2)}%${COLORS.reset}`);
    }
    
    if (vitestResult.memoryUsage?.rss < jestResult.memoryUsage?.rss) {
      console.log(`${COLORS.green}✓ Vitest uses less memory than Jest by ${((jestResult.memoryUsage.rss - vitestResult.memoryUsage.rss) / jestResult.memoryUsage.rss * 100).toFixed(2)}%${COLORS.reset}`);
    } else if (vitestResult.memoryUsage && jestResult.memoryUsage) {
      console.log(`${COLORS.yellow}⚠ Vitest uses more memory than Jest by ${((vitestResult.memoryUsage.rss - jestResult.memoryUsage.rss) / jestResult.memoryUsage.rss * 100).toFixed(2)}%${COLORS.reset}`);
    }
  } else if (vitestResult.success) {
    console.log(`${COLORS.blue}ℹ Vitest tests completed successfully in ${formatDuration(vitestResult.duration)}${COLORS.reset}`);
    console.log(`${COLORS.blue}ℹ Jest comparison not available${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}❌ Vitest tests failed${COLORS.reset}`);
  }
}

// Run the performance comparison
try {
  runPerformanceComparison();
} catch (error) {
  console.error(`${COLORS.red}Error in performance comparison:${COLORS.reset}`, error);
  process.exit(1);
}