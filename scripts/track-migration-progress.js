
#!/usr/bin/env node
/**
 * Test Migration Progress Tracker
 * 
 * This script scans the test directories to identify migrated and pending tests,
 * and updates the MIGRATION_PROGRESS.md file with the current status.
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2), {
  boolean: ['update', 'verbose'],
  alias: {
    u: 'update',
    v: 'verbose',
    h: 'help'
  }
});

if (args.help) {
  console.log(`
Test Migration Progress Tracker

Options:
  --update, -u    Update the MIGRATION_PROGRESS.md file with current status
  --verbose, -v   Show detailed output
  --help, -h      Show this help message
  
Examples:
  node scripts/track-migration-progress.js          # Show migration progress without updating the file
  node scripts/track-migration-progress.js -u       # Update the MIGRATION_PROGRESS.md file
  node scripts/track-migration-progress.js -u -v    # Update with verbose output
  `);
  process.exit(0);
}

// List of services with known ESM compatibility issues
const knownEsmIssues = [
  'researchService',
  'promptManager',
  'anthropicService',
  'perplexityService',
];

async function scanTestFiles() {
  // Get all Jest test files
  const jestFiles = await glob('tests/**/*.test.js');
  
  // Get all Vitest test files
  const vitestFiles = await glob('tests/**/*.vitest.js');
  
  // Extract service/module names from file paths
  const getModuleName = (filePath) => {
    const basename = path.basename(filePath, path.extname(filePath))
      .replace('.test', '')
      .replace('.vitest', '');
    return basename;
  };
  
  // Create maps of test files by module name
  const jestModules = jestFiles.map(getModuleName);
  const vitestModules = vitestFiles.map(getModuleName);
  
  // Determine migrated and pending modules
  const migratedModules = vitestModules.filter(module => jestModules.includes(module));
  const pendingModules = jestModules.filter(module => !vitestModules.includes(module));
  
  // Map file paths to module names for more detailed reporting
  const migratedFiles = vitestFiles.map(file => ({
    module: getModuleName(file),
    jestPath: file.replace('.vitest.js', '.test.js'),
    vitestPath: file,
    hasEsmIssues: knownEsmIssues.includes(getModuleName(file))
  }));
  
  const pendingFiles = jestFiles
    .filter(file => !vitestFiles.some(vf => getModuleName(vf) === getModuleName(file)))
    .map(file => ({
      module: getModuleName(file),
      jestPath: file,
      hasEsmIssues: knownEsmIssues.includes(getModuleName(file))
    }));
  
  return {
    migratedFiles,
    pendingFiles,
    stats: {
      total: jestModules.length,
      migrated: migratedModules.length,
      pending: pendingModules.length,
      percentComplete: Math.round((migratedModules.length / jestModules.length) * 100)
    }
  };
}

async function generateProgressMarkdown(results) {
  const { migratedFiles, pendingFiles, stats } = results;
  
  // Sort files by path
  migratedFiles.sort((a, b) => a.vitestPath.localeCompare(b.vitestPath));
  pendingFiles.sort((a, b) => a.jestPath.localeCompare(b.jestPath));
  
  let markdown = `
# Vitest Migration Progress

## Summary
- Total tests: ${stats.total}
- Migrated: ${stats.migrated} (${stats.percentComplete}%)
- Pending: ${stats.pending}

## Migrated Test Files
${migratedFiles.map(file => `- ✅ ${file.vitestPath}${file.hasEsmIssues ? ' (has ESM compatibility issues)' : ''}`).join('\n')}

## Pending Migration
${pendingFiles.map(file => `- ⬜ ${file.jestPath}${file.hasEsmIssues ? ' (has ESM compatibility issues)' : ''}`).join('\n')}

## Known Issues
- ES Module compatibility issues with Jest - expected and handled
- Manual tests for service classes may have different behavior from unit tests due to mocking differences

## Next Steps
1. Continue migrating unit tests
2. Use validation script to confirm test consistency between frameworks
3. Update CI workflows
4. Create reusable test fixtures
5. Convert manual tests to proper test suites where appropriate

## ESM Compatibility Note
For tests with ES Module compatibility issues in Jest:
1. We prioritize Vitest test results over Jest
2. We consider manual tests and Vitest to be the source of truth
3. We accept Jest failures when they're known to be related to ESM compatibility
`;

  return markdown;
}

async function updateProgressFile(markdown) {
  const progressFilePath = path.join(process.cwd(), 'tests', 'MIGRATION_PROGRESS.md');
  await fs.writeFile(progressFilePath, markdown, 'utf-8');
  return progressFilePath;
}

async function main() {
  console.log('🔍 Scanning test files...');
  const results = await scanTestFiles();
  
  // Generate the progress markdown
  const markdown = await generateProgressMarkdown(results);
  
  // Print summary
  console.log(`\n📊 Migration Progress: ${results.stats.migrated}/${results.stats.total} (${results.stats.percentComplete}%)`);
  
  if (args.verbose) {
    console.log('\n✅ Migrated:');
    results.migratedFiles.forEach(file => {
      console.log(`  - ${file.module}${file.hasEsmIssues ? ' (ESM issues)' : ''}`);
    });
    
    console.log('\n⬜ Pending:');
    results.pendingFiles.forEach(file => {
      console.log(`  - ${file.module}${file.hasEsmIssues ? ' (ESM issues)' : ''}`);
    });
  }
  
  // Update the progress file if requested
  if (args.update) {
    const filePath = await updateProgressFile(markdown);
    console.log(`\n✅ Updated migration progress file: ${filePath}`);
  } else {
    console.log('\nRun with --update or -u to update the MIGRATION_PROGRESS.md file');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
