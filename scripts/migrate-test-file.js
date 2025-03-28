
/**
 * Utility script to help migrate Jest test files to Vitest
 * 
 * This script takes a Jest test file and creates a Vitest version with the necessary changes
 */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2), {
  string: ['file'],
  boolean: ['dry-run'],
  alias: {
    f: 'file',
    d: 'dry-run',
    h: 'help',
  },
});

if (args.help || !args.file) {
  console.log(`
Test File Migration Utility
---------------------------
Usage: node scripts/migrate-test-file.js --file <path-to-jest-file>

Options:
  --file, -f     Path to the Jest test file to migrate
  --dry-run, -d  Show changes without writing the file
  --help, -h     Show this help message
  `);
  process.exit(0);
}

async function migrateTestFile(jestFilePath, dryRun = false) {
  try {
    // Read the original Jest test file
    const content = await readFile(jestFilePath, 'utf8');
    
    // Parse the file path for the output
    const parsedPath = path.parse(jestFilePath);
    const vitestFilePath = path.join(
      parsedPath.dir,
      parsedPath.name.replace('.test', '.vitest') + parsedPath.ext
    );
    
    // Perform the necessary replacements
    let vitestContent = content
      // Update imports
      .replace(/const\s+(\w+)\s+=\s+require\(['"]([^'"]+)['"]\)/g, 'import $1 from \'$2\'')
      // Replace Jest mocks
      .replace(/jest\.mock\(['"]([^'"]+)['"]/g, 'vi.mock(\'$1\'')
      .replace(/jest\./g, 'vi.')
      // ESM exports
      .replace(/module\.exports\s*=\s*/g, 'export default ');
    
    // Add Vitest imports if they don't exist
    if (!vitestContent.includes('import { describe, it, expect')) {
      vitestContent = `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';\n${vitestContent}`;
    }
    
    // Output
    if (dryRun) {
      console.log(`\n--- Would create: ${vitestFilePath} ---\n`);
      console.log(vitestContent);
    } else {
      await writeFile(vitestFilePath, vitestContent);
      console.log(`🎯 Created Vitest test file: ${vitestFilePath}`);
      
      // Try to run the new test to see if it passes
      try {
        const result = await execa('npx', ['vitest', 'run', vitestFilePath], { stdio: 'inherit' });
        console.log('✅ Test file ran successfully!');
      } catch (err) {
        console.log('❌ The migrated test file has issues that need to be fixed manually.');
      }
    }
    
    return vitestFilePath;
  } catch (error) {
    console.error(`Error migrating test file: ${error.message}`);
    throw error;
  }
}

// Run the migration
migrateTestFile(args.file, args['dry-run'])
  .then(() => {
    if (!args['dry-run']) {
      console.log('\nRemember to update MIGRATION_PROGRESS.md with this newly migrated test!');
    }
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
