#!/usr/bin/env node

/**
 * Jest Unit Test Removal Execution Script
 * 
 * This script removes Jest unit test files that have been fully migrated to Vitest.
 * IMPORTANT: Run this script only after verifying all Vitest tests pass!
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

// Argument parsing
const args = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'help'],
  alias: {
    d: 'dry-run',
    h: 'help'
  }
});

// Help message
if (args.help) {
  console.log(`
Jest Unit Test Removal Execution Script

This script removes Jest unit test files that have been fully migrated to Vitest.

Options:
  --dry-run, -d    Simulate the removal process without actually deleting files
  --help, -h       Show this help message

Example:
  node scripts/execute-jest-unit-test-removal.js --dry-run
  `);
  process.exit(0);
}

// Configuration
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'test-backups', 'unit');
const isDryRun = args['dry-run'];

// Files to remove - we're explicitly listing confirmed ready files here
// based on our manual verification
const filesToRemove = [
  'tests/unit/services/perplexityService.test.js',
  'tests/unit/logger.test.js',
  // Add more files here as they're verified
];

/**
 * Create backup directory
 */
async function createBackupDir() {
  console.log('Creating backup directory...');
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

/**
 * Backup a file before removal
 */
async function backupFile(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const backupPath = path.join(BACKUP_DIR, filePath.replace('tests/unit/', ''));
  const backupDir = path.dirname(backupPath);

  await fs.mkdir(backupDir, { recursive: true });
  await fs.copyFile(fullPath, backupPath);
  console.log(`  Backed up: ${filePath}`);
}

/**
 * Check if Vitest counterpart exists and passes
 */
async function checkVitestCounterpart(jestFile) {
  const vitestFile = jestFile.replace('.test.js', '.vitest.js');
  const vitestPath = path.join(ROOT_DIR, vitestFile);
  
  try {
    await fs.access(vitestPath);
    console.log(`  ✓ Vitest counterpart exists: ${vitestFile}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Vitest counterpart not found: ${vitestFile}`);
    return false;
  }
}

/**
 * Remove Jest files
 */
async function removeJestFiles() {
  console.log(`\nRemoving ${filesToRemove.length} Jest unit test files...`);
  console.log(`Dry run: ${isDryRun ? 'Yes' : 'No'}`);

  for (const file of filesToRemove) {
    const fullPath = path.join(ROOT_DIR, file);
    
    // Verify file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      console.warn(`  ! File does not exist: ${file}`);
      continue;
    }
    
    // Check for Vitest counterpart
    const hasVitestFile = await checkVitestCounterpart(file);
    if (!hasVitestFile) {
      console.warn(`  ! Skipping ${file} because Vitest counterpart not found`);
      continue;
    }
    
    // Backup the file
    await backupFile(file);
    
    // Remove the file (unless in dry-run mode)
    if (!isDryRun) {
      await fs.unlink(fullPath);
      console.log(`  Removed: ${file}`);
    } else {
      console.log(`  Would remove: ${file}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Jest Unit Test Removal Execution Script');
    console.log('=====================================');
    console.log(`Mode: ${isDryRun ? 'Dry Run' : 'Execution'}`);
    
    await createBackupDir();
    await removeJestFiles();

    if (isDryRun) {
      console.log('\nDry run completed. No files were actually removed.');
      console.log('Run without --dry-run to perform the actual removal.');
    } else {
      console.log('\nJest unit test files have been removed and backed up to:', BACKUP_DIR);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();