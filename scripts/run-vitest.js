#!/usr/bin/env node

/**
 * Vitest Test Runner
 * 
 * This script runs Vitest tests with memory optimization
 * and better resource management.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const MEMORY_LIMIT = '1024'; // Increased memory limit for Node.js
const DEFAULT_TIMEOUT = 20000; // Default timeout for tests

// Run a command with memory optimization
async function runVitest(args = []) {
  console.log('Running Vitest with optimized settings...');
  
  // Set environment variables for better performance
  const env = {
    ...process.env,
    NODE_OPTIONS: `--max-old-space-size=${MEMORY_LIMIT}`
  };
  
  // Spawn Vitest process
  const vitest = spawn('npx', ['vitest', ...args], {
    env,
    stdio: 'inherit'
  });
  
  return new Promise((resolve, reject) => {
    vitest.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Vitest exited with code ${code}`));
      }
    });
    
    vitest.on('error', (err) => {
      reject(err);
    });
  });
}

// Main function
async function main() {
  try {
    const args = process.argv.slice(2);
    
    console.log('Vitest Runner');
    console.log('=============');
    
    if (args.includes('--help') || args.includes('-h')) {
      console.log('Usage:');
      console.log('  node scripts/run-vitest.js [options] [test files]');
      console.log('');
      console.log('Options:');
      console.log('  --run           Run tests once (default)');
      console.log('  --watch         Run tests in watch mode');
      console.log('  --ui            Run tests with UI');
      console.log('  --coverage      Run tests with coverage');
      console.log('  --pattern [p]   Run tests matching pattern');
      return;
    }
    
    let runArgs = [];
    
    // Check for options
    const optionFlags = ['--pattern', '--watch', '--ui', '--coverage', '--run', '-h', '--help'];
    
    // Filter out option flags to identify test files
    const testFiles = args.filter((arg, index) => {
      // Skip this arg and the next if this is a flag that takes an argument
      if (arg === '--pattern') return false;
      
      // Skip this arg if it's the argument to a flag
      if (index > 0 && args[index - 1] === '--pattern') return false;
      
      // If it's not an option flag, it's a test file
      return !optionFlags.includes(arg);
    });
    
    if (testFiles.length > 0) {
      // If specific test files are provided, use those
      runArgs = [...testFiles];
    } else {
      // Otherwise check for pattern
      const patternIndex = args.indexOf('--pattern');
      if (patternIndex >= 0 && patternIndex < args.length - 1) {
        const pattern = args[patternIndex + 1];
        runArgs.push(pattern);
      }
    }
    
    // Handle run modes
    if (args.includes('--watch')) {
      // Watch mode
      await runVitest(runArgs);
    } else if (args.includes('--ui')) {
      // UI mode
      await runVitest(['--ui', ...runArgs]);
    } else if (args.includes('--coverage')) {
      // Coverage mode
      await runVitest(['run', '--coverage', ...runArgs]);
    } else {
      // Default run mode
      await runVitest(['run', ...runArgs]);
    }
    
    console.log('Tests completed successfully');
  } catch (error) {
    console.error('Error running tests:', error.message);
    process.exit(1);
  }
}

main();