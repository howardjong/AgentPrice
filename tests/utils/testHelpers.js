
/**
 * Consolidated Test Utilities
 * 
 * This file contains shared utility functions for tests
 * to reduce redundancy across test files
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get dirname in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Creates the output directory if it doesn't exist
 */
export async function ensureOutputDirectory() {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  try {
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
    return outputDir;
  }
}

/**
 * Saves test results to a file
 */
export async function saveTestResults(filename, data) {
  const outputDir = await ensureOutputDirectory();
  const filePath = path.join(outputDir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

/**
 * Read test results from a file
 */
export async function readTestResults(filename) {
  const outputDir = await ensureOutputDirectory();
  const filePath = path.join(outputDir, filename);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Format test result for comparison
 */
export function formatTestResult(result, includeTimestamp = false) {
  const formatted = { ...result };
  
  // Remove or standardize non-deterministic fields
  if (!includeTimestamp && formatted.timestamp) {
    delete formatted.timestamp;
  }
  
  return formatted;
}

/**
 * Compare test results with baseline
 */
export function compareResults(current, baseline) {
  if (!baseline) return { differences: ['No baseline found'], match: false };
  
  const differences = [];
  let match = true;
  
  // Compare top-level properties (simple implementation)
  for (const key in baseline) {
    if (typeof baseline[key] === 'object' && baseline[key] !== null) {
      // Deep object comparison would go here
      continue;
    }
    
    if (current[key] !== baseline[key]) {
      differences.push(`${key}: ${baseline[key]} → ${current[key]}`);
      match = false;
    }
  }
  
  return { differences, match };
}

/**
 * Wait for specified milliseconds
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock logger for tests
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

/**
 * Create mock Redis client for tests
 */
export function createMockRedisClient() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
  };
}
