#!/usr/bin/env node

/**
 * Script to compare two code review prompt outputs
 * 
 * Usage:
 * node scripts/compare-code-review-prompts.js <review-file-1> <review-file-2> [--verbose]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CodeReviewScorecard from '../utils/codeReviewScorecard.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

if (args.length < 2 || (args.length === 2 && verbose)) {
  console.error('Error: Please provide two review files to compare');
  console.log('Usage: node scripts/compare-code-review-prompts.js <review-file-1> <review-file-2> [--verbose]');
  process.exit(1);
}

// Get file paths
const reviewFile1 = verbose ? args[0] : args[0];
const reviewFile2 = verbose ? args[1] : args[1];

// Validate files
try {
  const reviewsDir = path.join(process.cwd(), 'reviews');
  const fullPath1 = path.join(reviewsDir, reviewFile1);
  const fullPath2 = path.join(reviewsDir, reviewFile2);

  if (!fs.existsSync(fullPath1)) {
    console.error(`Error: Review file not found: ${fullPath1}`);
    process.exit(1);
  }

  if (!fs.existsSync(fullPath2)) {
    console.error(`Error: Review file not found: ${fullPath2}`);
    process.exit(1);
  }

  // Compare reviews
  const scorecard = new CodeReviewScorecard({ verbose: true });
  const comparison = scorecard.compareReviewFiles(fullPath1, fullPath2);
  const report = scorecard.generateComparisonReport(comparison, verbose);

  console.log(report);

} catch (err) {
  console.error(`Error comparing reviews: ${err.message}`);
  process.exit(1);
}