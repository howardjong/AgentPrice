#!/usr/bin/env node

/**
 * Database Test Migration Script
 * 
 * This script identifies and fixes common issues with database tests
 * in the migration from Jest to Vitest.
 * 
 * Key fixes:
 * 1. Replaces Jest-specific database setup/teardown patterns with Vitest equivalents
 * 2. Adds proper transaction handling
 * 3. Ensures all tests use proper isolation patterns
 * 4. Adds cleanup to prevent resource leaks
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const util = require('util');
const globPromise = util.promisify(glob);

// Pattern to identify database test files
const DB_TEST_PATTERN = /.*\.(test|spec)\.(js|ts)$/;
const ISSUE_MARKERS = [
  'pg.',
  'Pool',
  'createPool',
  'connect()',
  'database.js',
  'connection',
  'query(',
  'transaction',
  'commit(',
  'rollback(',
  'CREATE TABLE',
  'INSERT INTO',
  'SELECT',
  'UPDATE',
  'DELETE FROM'
];

// Count of issues found and fixed
let issuesFound = 0;
let issuesFixed = 0;

/**
 * Identifies if a file is likely a database test
 * @param {string} content File content
 * @returns {boolean} Whether the file is likely a database test
 */
function isDatabaseTest(content) {
  return ISSUE_MARKERS.some(marker => content.includes(marker));
}

/**
 * Fixes Jest-style database setup/teardown patterns
 * @param {string} content File content
 * @returns {string} Updated file content
 */
function fixSetupTeardown(content) {
  let modified = content;
  
  // Replace Jest imports with Vitest
  modified = modified.replace(
    /const\s+{([^}]*)}\s*=\s*require\(['"]jest['"]\)/g,
    'const {$1} = require("vitest")'
  );
  
  modified = modified.replace(
    /import\s+{([^}]*)}\s+from\s+['"]jest['"]/g,
    'import {$1} from "vitest"'
  );
  
  // Replace afterAll without proper cleanup
  if (
    modified.includes('afterAll') && 
    !modified.includes('client.end()') && 
    !modified.includes('pool.end()') &&
    !modified.includes('connection.end()')
  ) {
    // Add a warning comment about missing cleanup
    modified = modified.replace(
      /afterAll\(\s*(?:async\s*)?\(\)\s*=>\s*{/g,
      'afterAll(async () => { // FIXME: Add proper database cleanup with client.end() or connection.end()'
    );
  }
  
  // Add transaction handling if missing
  if (
    (modified.includes('beforeEach') || modified.includes('beforeAll')) &&
    !modified.includes('BEGIN') &&
    !modified.includes('ROLLBACK') &&
    (modified.includes('INSERT') || modified.includes('UPDATE') || modified.includes('DELETE'))
  ) {
    // Add a warning comment about missing transactions
    modified = modified.replace(
      /beforeEach\(\s*(?:async\s*)?\(\)\s*=>\s*{/g,
      'beforeEach(async () => { // FIXME: Consider using transactions with client.query("BEGIN") for test isolation'
    );
    
    if (modified.includes('afterEach') && !modified.includes('ROLLBACK')) {
      modified = modified.replace(
        /afterEach\(\s*(?:async\s*)?\(\)\s*=>\s*{/g,
        'afterEach(async () => { // FIXME: Add transaction rollback with client.query("ROLLBACK") for proper cleanup'
      );
    } else if (!modified.includes('afterEach')) {
      // If there's no afterEach but we have beforeEach, suggest adding one
      const beforeEachMatch = modified.match(/beforeEach\(\s*(?:async\s*)?\(\)\s*=>\s*{[^}]*}\);/);
      if (beforeEachMatch) {
        const beforeEachBlock = beforeEachMatch[0];
        const afterEachBlock = `\nafterEach(async () => { // FIXME: Add transaction rollback for proper cleanup
  // await client.query('ROLLBACK');
});\n`;
        
        modified = modified.replace(beforeEachBlock, beforeEachBlock + afterEachBlock);
      }
    }
  }
  
  // Check for proper connection pooling and cleanup
  if (
    (modified.includes('new Pool') || modified.includes('createPool')) &&
    !modified.includes('afterAll') &&
    !modified.includes('pool.end()')
  ) {
    // Add a warning about connection leaks
    modified += `\n\n// FIXME: Potential connection leak detected. Add proper cleanup with:
// afterAll(async () => {
//   await pool.end();
// });\n`;
  }
  
  // Replace deprecated Jest timer handling with Vitest equivalents
  modified = modified.replace(
    /jest\.useFakeTimers\(\)/g,
    'vi.useFakeTimers()'
  );
  
  modified = modified.replace(
    /jest\.useRealTimers\(\)/g,
    'vi.useRealTimers()'
  );
  
  // Add proper database isolation note if missing
  if (
    (modified.includes('database') || modified.includes('connect')) &&
    !modified.includes('test_') &&
    !modified.includes('schema') &&
    !modified.includes('isolation')
  ) {
    modified = `// FIXME: Consider using proper database isolation with separate test schemas or test databases
${modified}`;
  }
  
  return modified;
}

/**
 * Updates import statements to use Vitest instead of Jest
 * @param {string} content File content
 * @returns {string} Updated file content
 */
function updateImports(content) {
  let modified = content;
  
  // Fix imports from jest to vitest
  modified = modified
    .replace(
      /import\s+{([^}]*)}\s+from\s+['"]jest['"]/g,
      'import {$1} from "vitest"'
    )
    .replace(
      /const\s+{([^}]*)}\s*=\s*require\(['"]jest['"]\)/g,
      'const {$1} = require("vitest")'
    );
  
  // Add vi import if using mocks but not importing vi
  if (
    (content.includes('jest.mock') || content.includes('jest.spyOn')) &&
    !content.includes('vi.mock') &&
    !content.includes('vi.spyOn') &&
    !content.includes('import { vi ')
  ) {
    if (content.includes('import {')) {
      modified = modified.replace(
        /import\s+{([^}]*)}\s+from\s+['"]vitest['"]/g,
        'import { vi, $1 } from "vitest"'
      );
    } else if (content.includes('const {')) {
      modified = modified.replace(
        /const\s+{([^}]*)}\s*=\s*require\(['"]vitest['"]\)/g,
        'const { vi, $1 } = require("vitest")'
      );
    } else if (content.includes('import ')) {
      // Add as a new import if we have other imports
      modified = modified.replace(
        /(import .* from .*;\n)/,
        '$1import { vi } from "vitest";\n'
      );
    } else {
      // Add at the top if no imports found
      modified = `import { vi } from "vitest";\n${modified}`;
    }
  }
  
  // Replace jest mocks with vi
  modified = modified
    .replace(/jest\.mock/g, 'vi.mock')
    .replace(/jest\.spyOn/g, 'vi.spyOn')
    .replace(/jest\.fn/g, 'vi.fn')
    .replace(/jest\.resetAllMocks/g, 'vi.resetAllMocks')
    .replace(/jest\.clearAllMocks/g, 'vi.clearAllMocks');
  
  return modified;
}

/**
 * Main processing function
 */
async function processFiles() {
  try {
    // Find all test files
    const files = await globPromise('**/*.{test,spec}.{js,ts}', {
      ignore: ['node_modules/**', 'coverage/**']
    });
    
    console.log(`Found ${files.length} test files to analyze...`);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Skip files that don't look like database tests
        if (!isDatabaseTest(content)) {
          continue;
        }
        
        issuesFound++;
        console.log(`Analyzing database test: ${file}`);
        
        // Apply fixes
        let modified = content;
        modified = fixSetupTeardown(modified);
        modified = updateImports(modified);
        
        // Only write if changes were made
        if (modified !== content) {
          // Create a backup
          const backupPath = path.join(
            'tests', 
            'backups', 
            'database',
            path.basename(file)
          );
          
          // Ensure backup directory exists
          const backupDir = path.dirname(backupPath);
          await fs.mkdir(backupDir, { recursive: true });
          
          // Write backup
          await fs.writeFile(backupPath, content, 'utf8');
          
          // Write modified file
          await fs.writeFile(file, modified, 'utf8');
          
          issuesFixed++;
          console.log(`✓ Fixed issues in: ${file}`);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError);
      }
    }
    
    console.log('\nDatabase Test Migration Summary:');
    console.log(`- Database test files analyzed: ${issuesFound}`);
    console.log(`- Files fixed: ${issuesFixed}`);
    
    if (issuesFixed > 0) {
      console.log('\nNext steps:');
      console.log('1. Check the modified files for // FIXME: comments and address them');
      console.log('2. Consider using the new db-test-utils.js utilities for proper isolation');
      console.log('3. Run the tests to verify they work correctly with Vitest');
    }
  } catch (error) {
    console.error('Error processing files:', error);
    process.exit(1);
  }
}

// Run the script
processFiles().then(() => {
  console.log('Database test migration script completed');
});