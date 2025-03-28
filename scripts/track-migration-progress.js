#!/usr/bin/env node

/**
 * Test Migration Progress Tracker
 * 
 * This script scans the test directories to identify migrated and pending tests,
 * and updates the MIGRATION_PROGRESS.md file with the current status.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateTestFile } from './migrate-test-file.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(ROOT_DIR, 'tests');
const MIGRATION_PROGRESS_FILE = path.resolve(ROOT_DIR, 'TEST_MIGRATION_PROGRESS.md');

async function scanTestFiles() {
  const results = {
    migrated: [],
    pending: [],
    directories: {}
  };
  
  async function scanDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Initialize directory stats
    const dirName = path.relative(TEST_DIR, dir);
    const dirPath = dirName || 'root';
    results.directories[dirPath] = { 
      migrated: 0, 
      pending: 0, 
      total: 0 
    };
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(ROOT_DIR, fullPath);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDir(fullPath);
      } else if (entry.name.endsWith('.test.js')) {
        // Jest test found
        const vitestPath = fullPath.replace(/\.test\.js$/, '.vitest.js');
        
        try {
          await fs.access(vitestPath);
          // Vitest version exists, test is migrated
          results.migrated.push(relativePath);
          results.directories[dirPath].migrated++;
          results.directories[dirPath].total++;
        } catch (err) {
          // Vitest version doesn't exist, test is pending migration
          results.pending.push(relativePath);
          results.directories[dirPath].pending++;
          results.directories[dirPath].total++;
        }
      } else if (entry.name.endsWith('.vitest.js')) {
        // Count vitest-only files (no Jest equivalent)
        const jestPath = fullPath.replace(/\.vitest\.js$/, '.test.js');
        
        try {
          await fs.access(jestPath);
          // Don't count, this is a migrated test already counted above
        } catch (err) {
          // Jest version doesn't exist, this is a Vitest-only test
          results.migrated.push(relativePath);
          results.directories[dirPath].migrated++;
          results.directories[dirPath].total++;
        }
      }
    }
  }
  
  await scanDir(TEST_DIR);
  
  // Calculate migration progress stats
  const totalTests = results.migrated.length + results.pending.length;
  const migrationProgress = totalTests > 0 
    ? Math.round((results.migrated.length / totalTests) * 100) 
    : 0;
  
  results.stats = {
    totalTests,
    migratedTests: results.migrated.length,
    pendingTests: results.pending.length,
    migrationProgress
  };
  
  return results;
}

async function generateProgressMarkdown(results) {
  const { stats, migrated, pending, directories } = results;
  const timestamp = new Date().toISOString();
  
  let markdown = `# Test Migration Progress\n\n`;
  markdown += `Last updated: ${timestamp}\n\n`;
  
  // Overall progress
  markdown += `## Overall Progress\n\n`;
  markdown += `- **Total Tests**: ${stats.totalTests}\n`;
  markdown += `- **Migrated Tests**: ${stats.migratedTests}\n`;
  markdown += `- **Pending Tests**: ${stats.pendingTests}\n`;
  markdown += `- **Migration Progress**: ${stats.migrationProgress}%\n\n`;
  
  markdown += `\`\`\`\n`;
  markdown += `[${'='.repeat(Math.floor(stats.migrationProgress / 5))}${' '.repeat(20 - Math.floor(stats.migrationProgress / 5))}] ${stats.migrationProgress}%\n`;
  markdown += `\`\`\`\n\n`;
  
  // Directory breakdown
  markdown += `## Directory Breakdown\n\n`;
  markdown += `| Directory | Migrated | Pending | Total | Progress |\n`;
  markdown += `|-----------|----------|---------|-------|----------|\n`;
  
  for (const [dirName, dirStats] of Object.entries(directories).sort()) {
    const dirProgress = dirStats.total > 0 
      ? Math.round((dirStats.migrated / dirStats.total) * 100) 
      : 0;
    
    markdown += `| ${dirName} | ${dirStats.migrated} | ${dirStats.pending} | ${dirStats.total} | ${dirProgress}% |\n`;
  }
  
  markdown += `\n`;
  
  // Details of migrated tests
  markdown += `## Migrated Tests\n\n`;
  for (const file of migrated.sort()) {
    markdown += `- ✅ ${file}\n`;
  }
  
  markdown += `\n`;
  
  // Details of pending tests
  markdown += `## Pending Tests\n\n`;
  for (const file of pending.sort()) {
    markdown += `- ⏳ ${file}\n`;
  }
  
  return markdown;
}

async function updateProgressFile(markdown) {
  await fs.writeFile(MIGRATION_PROGRESS_FILE, markdown, 'utf8');
  console.log(`Progress file updated: ${MIGRATION_PROGRESS_FILE}`);
}

async function migrateAllTests(autoMigrate = false) {
  const results = await scanTestFiles();
  
  if (autoMigrate && results.pending.length > 0) {
    console.log(`Found ${results.pending.length} tests to migrate. Migrating...`);
    
    for (const file of results.pending) {
      console.log(`Migrating ${file}...`);
      await migrateTestFile(file);
    }
    
    console.log('Migration complete. Rescanning...');
    return scanTestFiles();
  }
  
  return results;
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const autoMigrate = args.includes('--auto-migrate');
    
    console.log('Test Migration Progress Tracker');
    console.log('==============================');
    
    console.log('Scanning test files...');
    const results = await migrateAllTests(autoMigrate);
    
    console.log('Generating progress report...');
    const markdown = await generateProgressMarkdown(results);
    
    console.log('Saving progress report...');
    await updateProgressFile(markdown);
    
    console.log(`Migration progress: ${results.stats.migrationProgress}%`);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if this is the main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { scanTestFiles, generateProgressMarkdown, updateProgressFile };