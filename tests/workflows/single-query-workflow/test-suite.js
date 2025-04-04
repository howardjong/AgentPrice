/**
 * Single Query Workflow Test Suite
 * 
 * This file serves as the main entry point for running single-query workflow tests.
 * It imports and runs the appropriate test files based on the test variant.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Determine which test file to run based on the variant
 * @param {string} variant - Test variant name
 * @returns {Promise<string>} Path to the test file
 */
async function getTestFile(variant) {
  const variantName = variant || process.env.TEST_VARIANT || 'basic';
  
  // Map of variant names to test files
  const variantMap = {
    'basic': 'basic.test.js',
    'performance': 'performance.test.js',
    'reliability': 'reliability.test.js',
    'error-handling': 'error-handling.test.js'
  };
  
  const testFileName = variantMap[variantName] || variantMap.basic;
  const testFilePath = path.join(__dirname, 'tests', testFileName);
  
  // Verify that the test file exists
  try {
    await fs.access(testFilePath);
    return testFilePath;
  } catch (error) {
    console.warn(`Test file for variant "${variantName}" not found, using basic tests`);
    return path.join(__dirname, 'tests', variantMap.basic);
  }
}

// Dynamic import of test files based on variant
describe('Single Query Workflow Tests', async () => {
  const testFile = await getTestFile(process.env.TEST_VARIANT);
  
  // Import the test file
  await import(testFile);
});

// If this file is executed directly, run the tests
if (import.meta.vitest) {
  const { it, expect, beforeAll, afterAll } = import.meta.vitest;
}