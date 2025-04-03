/**
 * Memory Profile Test Script
 * 
 * This script runs vitest tests and captures memory usage statistics
 * at regular intervals during execution.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SAMPLE_INTERVAL_MS = 1000; // Check memory every second
const MAX_SAMPLES = 60; // Maximum number of samples to collect
const LOG_FILE = path.join(__dirname, '..', 'memory-profile-results.json');

// Get command line arguments
const args = process.argv.slice(2);
console.log('Running tests with arguments:', args);

// Start the Vitest process
const vitestProcess = spawn('npx', ['vitest', 'run', ...args]);

let samples = [];
let sampleCount = 0;
const startTime = Date.now();

// Collect memory samples at regular intervals
const sampleInterval = setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const sample = {
    timestamp: Date.now() - startTime,
    rss: memoryUsage.rss / 1024 / 1024, // MB
    heapTotal: memoryUsage.heapTotal / 1024 / 1024, // MB
    heapUsed: memoryUsage.heapUsed / 1024 / 1024, // MB
    external: memoryUsage.external / 1024 / 1024, // MB
  };
  
  samples.push(sample);
  sampleCount++;
  
  console.log(`Sample ${sampleCount}: RSS ${sample.rss.toFixed(2)} MB, Heap Used ${sample.heapUsed.toFixed(2)} MB`);
  
  if (sampleCount >= MAX_SAMPLES) {
    clearInterval(sampleInterval);
  }
}, SAMPLE_INTERVAL_MS);

// Handle Vitest process output
vitestProcess.stdout.on('data', (data) => {
  console.log(`vitest: ${data}`);
});

vitestProcess.stderr.on('data', (data) => {
  console.error(`vitest error: ${data}`);
});

vitestProcess.on('close', (code) => {
  clearInterval(sampleInterval);
  
  // Add summary information
  const summary = {
    duration: Date.now() - startTime,
    exitCode: code,
    peakRSS: Math.max(...samples.map(s => s.rss)),
    peakHeapUsed: Math.max(...samples.map(s => s.heapUsed)),
    finalRSS: samples[samples.length - 1]?.rss || 0,
    finalHeapUsed: samples[samples.length - 1]?.heapUsed || 0,
    sampleCount: samples.length,
  };
  
  const report = {
    command: `npx vitest run ${args.join(' ')}`,
    timestamp: new Date().toISOString(),
    summary,
    samples,
  };
  
  // Write the memory profile results to a file
  fs.writeFileSync(LOG_FILE, JSON.stringify(report, null, 2));
  
  console.log('\nMemory Profile Summary:');
  console.log(`Duration: ${summary.duration} ms`);
  console.log(`Peak RSS: ${summary.peakRSS.toFixed(2)} MB`);
  console.log(`Peak Heap Used: ${summary.peakHeapUsed.toFixed(2)} MB`);
  console.log(`Final RSS: ${summary.finalRSS.toFixed(2)} MB`);
  console.log(`Final Heap Used: ${summary.finalHeapUsed.toFixed(2)} MB`);
  console.log(`Test Exit Code: ${code}`);
  console.log(`Memory profile saved to: ${LOG_FILE}`);
  
  process.exit(code);
});