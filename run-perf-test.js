#!/usr/bin/env node

/**
 * Simple script to run the performanceMonitor tests directly
 */

import { spawnSync } from 'child_process';

console.log('Running performanceMonitor tests with a timeout...');

// Run Jest with specific options
const result = spawnSync('npx', [
  'jest', 
  'tests/unit/utils/performanceMonitor.test.js',
  '--testTimeout=5000',
  '--forceExit',
  '--detectOpenHandles'
], { 
  stdio: 'inherit',
  timeout: 15000 // 15 second timeout for the entire process
});

if (result.error) {
  console.error('Error running tests:', result.error);
  process.exit(1);
}

process.exit(result.status);