#!/usr/bin/env node

/**
 * Jest Test Clean-up Script
 * 
 * This script safely cleans up all Jest test files (.test.js) in the project.
 * It identifies Jest test files in both the tests directory and the test-backups directory,
 * and provides options to delete them with appropriate backups.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import { execSync } from 'child_process';

// Parse command line arguments
const args = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'help', 'tests-only', 'backups-only', 'confirm'],
  alias: {
    d: 'dry-run',
    h: 'help',
    t: 'tests-only',
    b: 'backups-only',
    c: 'confirm',
  }
});

// Show help if requested
if (args.help) {
  console.log(`
Jest Test Clean-up Script

This script safely cleans up all Jest test files (.test.js) in the project.

Options:
  --dry-run, -d       Simulate deletion without actually removing files
  --tests-only, -t    Only clean Jest tests in the tests directory
  --backups-only, -b  Only clean Jest tests in the test-backups directory
  --confirm, -c       Skip the confirmation prompt
  --help, -h          Show this help message

Example:
  node scripts/clean-jest-tests.js --dry-run
  
  `);
  process.exit(0);
}

// Configuration
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT_DIR, 'tests');
const BACKUP_DIR = path.join(ROOT_DIR, 'test-backups');
const ARCHIVE_DIR = path.join(ROOT_DIR, 'jest-archive');
const isDryRun = args['dry-run'];
const testsOnly = args['tests-only'];
const backupsOnly = args['backups-only'];
const skipConfirmation = args['confirm'];

/**
 * Find Jest test files in a directory
 */
async function findJestFiles(dir) {
  const command = `find ${dir} -name "*.test.js" | grep -v "node_modules"`;
  try {
    const output = execSync(command, { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return []; // Return empty array if no files found
  }
}

/**
 * Create directory if it doesn't exist
 */
async function ensureDirectory(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Archive a file before deletion
 */
async function archiveFile(filePath) {
  // Determine the relative path from the root directory
  const relativePath = path.relative(ROOT_DIR, filePath);
  // Create the archive path
  const archivePath = path.join(ARCHIVE_DIR, relativePath);
  // Create the directory structure
  const archiveDir = path.dirname(archivePath);
  
  try {
    await ensureDirectory(archiveDir);
    await fs.copyFile(filePath, archivePath);
    console.log(`  Archived: ${relativePath} → ${path.relative(ROOT_DIR, archivePath)}`);
    return true;
  } catch (error) {
    console.error(`  Error archiving file ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Delete a file with a confirmation prompt
 */
async function deleteFile(filePath, dryRun = false) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  
  if (dryRun) {
    console.log(`  Would delete: ${relativePath}`);
    return true;
  } else {
    try {
      await fs.unlink(filePath);
      console.log(`  Deleted: ${relativePath}`);
      return true;
    } catch (error) {
      console.error(`  Error deleting file ${filePath}: ${error.message}`);
      return false;
    }
  }
}

/**
 * Clean up Jest test files
 */
async function cleanJestTests() {
  // Find Jest test files
  const testsFiles = testsOnly || !backupsOnly ? await findJestFiles(TESTS_DIR) : [];
  const backupFiles = backupsOnly || !testsOnly ? await findJestFiles(BACKUP_DIR) : [];
  
  const totalFiles = testsFiles.length + backupFiles.length;
  
  if (totalFiles === 0) {
    console.log('No Jest test files found to clean up.');
    return;
  }
  
  console.log(`Found ${totalFiles} Jest test files to clean up:`);
  console.log(`- ${testsFiles.length} files in tests directory`);
  console.log(`- ${backupFiles.length} files in test-backups directory`);
  
  // Display files
  if (testsFiles.length > 0) {
    console.log('\nJest files in tests directory:');
    testsFiles.forEach(file => console.log(`  ${path.relative(ROOT_DIR, file)}`));
  }
  
  if (backupFiles.length > 0) {
    console.log('\nJest files in test-backups directory:');
    backupFiles.forEach(file => console.log(`  ${path.relative(ROOT_DIR, file)}`));
  }
  
  // Confirm before proceeding (unless --confirm is specified)
  if (!skipConfirmation && !isDryRun) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const response = await new Promise(resolve => {
      readline.question('\nAre you sure you want to delete these files? (yes/no): ', answer => {
        readline.close();
        resolve(answer.toLowerCase());
      });
    });
    
    if (response !== 'yes' && response !== 'y') {
      console.log('Operation cancelled by user.');
      return;
    }
  }
  
  // Create archive directory
  await ensureDirectory(ARCHIVE_DIR);
  
  // Process files in tests directory
  if (testsFiles.length > 0) {
    console.log('\nProcessing files in tests directory:');
    for (const file of testsFiles) {
      const archived = await archiveFile(file);
      if (archived) {
        await deleteFile(file, isDryRun);
      }
    }
  }
  
  // Process files in test-backups directory
  if (backupFiles.length > 0) {
    console.log('\nProcessing files in test-backups directory:');
    for (const file of backupFiles) {
      const archived = await archiveFile(file);
      if (archived) {
        await deleteFile(file, isDryRun);
      }
    }
  }
  
  // Summary
  console.log('\nClean-up Summary:');
  console.log(`Mode: ${isDryRun ? 'Dry Run' : 'Execution'}`);
  console.log(`Processed ${totalFiles} Jest test files`);
  console.log(`All files have been archived to: ${path.relative(ROOT_DIR, ARCHIVE_DIR)}`);
  
  if (isDryRun) {
    console.log('\nThis was a dry run. No files were actually deleted.');
    console.log('Run without --dry-run to perform the actual deletion.');
  } else {
    console.log('\nJest test files have been cleaned up successfully.');
  }
}

// Main function
async function main() {
  try {
    console.log('Jest Test Clean-up Script');
    console.log('========================');
    console.log(`Mode: ${isDryRun ? 'Dry Run' : 'Execution'}`);
    
    if (testsOnly) {
      console.log('Target: Tests directory only');
    } else if (backupsOnly) {
      console.log('Target: Test-backups directory only');
    } else {
      console.log('Target: Both tests and test-backups directories');
    }
    
    await cleanJestTests();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();