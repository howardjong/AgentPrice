#!/usr/bin/env node

/**
 * Script to migrate Jest database tests to Vitest
 * 
 * This script analyzes Jest database tests and migrates them to Vitest format.
 * It handles common patterns and modifications needed for the migration.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

// ANSI colors for output formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
};

// Log a message with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Simple rule-based migration
const migrationRules = [
  {
    // Replace Jest imports with Vitest
    pattern: /const\s+\{\s*([^}]+)\s*\}\s*=\s*require\(['"]jest['"]\);?/g,
    replacement: 'import { $1 } from "vitest";',
  },
  {
    // Replace individual Jest imports
    pattern: /const\s+(\w+)\s*=\s*require\(['"]jest['"]\);?/g,
    replacement: 'import $1 from "vitest";',
  },
  {
    // Replace jest.mock with vi.mock
    pattern: /jest\.mock\(/g,
    replacement: 'vi.mock(',
  },
  {
    // Replace jest.fn with vi.fn
    pattern: /jest\.fn\(/g,
    replacement: 'vi.fn(',
  },
  {
    // Replace jest.spyOn with vi.spyOn
    pattern: /jest\.spyOn\(/g,
    replacement: 'vi.spyOn(',
  },
  {
    // Replace resetAllMocks
    pattern: /jest\.resetAllMocks\(/g,
    replacement: 'vi.resetAllMocks(',
  },
  {
    // Replace clearAllMocks
    pattern: /jest\.clearAllMocks\(/g,
    replacement: 'vi.clearAllMocks(',
  },
  {
    // Replace restoreAllMocks
    pattern: /jest\.restoreAllMocks\(/g,
    replacement: 'vi.restoreAllMocks(',
  },
  {
    // Replace common require syntax with imports
    pattern: /const\s+(\w+)\s*=\s*require\(['"](.*)['"]\);?/g,
    replacement: 'import $1 from "$2";',
  },
  {
    // Replace destructured require syntax with imports
    pattern: /const\s+\{\s*([^}]+)\s*\}\s*=\s*require\(['"](.*)['"]\);?/g,
    replacement: 'import { $1 } from "$2";',
  },
  {
    // Replace done callback pattern with async/await
    pattern: /it\(['"](.*)['"](,\s*)?function\s*\(done\)\s*\{([\s\S]*?)done\(\);?\s*\}\);/g,
    replacement: 'it("$1", async () => {$3});',
  },
  {
    // Replace test.each with test.each (same syntax in Vitest)
    // This is a no-op rule, but we're keeping it here for completeness
    pattern: /test\.each\(/g,
    replacement: 'test.each(',
  },
  {
    // Replace beforeEach with direct imports if needed
    pattern: /const\s+beforeEach\s*=\s*global\.beforeEach;?/g,
    replacement: 'import { beforeEach } from "vitest";',
  },
];

// Special handling for database-specific patterns
const databaseSpecificRules = [
  {
    // Handle common database connection patterns
    pattern: /beforeAll\(\(\)\s*=>\s*\{\s*connection\s*=\s*await\s*createConnection/g,
    replacement: 'beforeAll(async () => {\n  // Set up database connection\n  connection = await createConnection',
  },
  {
    // Handle transaction setup
    pattern: /beforeEach\(\(\)\s*=>\s*\{\s*transaction\s*=\s*await\s*connection\.startTransaction/g,
    replacement: 'beforeEach(async () => {\n  // Start transaction for test isolation\n  transaction = await connection.startTransaction',
  },
  {
    // Handle transaction teardown
    pattern: /afterEach\(\(\)\s*=>\s*\{\s*await\s*transaction\.rollbackTransaction/g,
    replacement: 'afterEach(async () => {\n  // Roll back transaction after test\n  await transaction.rollbackTransaction',
  },
];

// Combine all rules
const allRules = [...migrationRules, ...databaseSpecificRules];

// Migrate a single file
function migrateFile(filePath) {
  log(`Migrating: ${filePath}`, colors.fgCyan);
  
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Apply all migration rules
  allRules.forEach(rule => {
    content = content.replace(rule.pattern, rule.replacement);
  });
  
  // Add file extension for imports if needed
  content = content.replace(/from\s+['"](\.\.?\/[^'"]*)['"]/g, (match, importPath) => {
    // Check if the import path needs a .js extension for ESM compatibility
    if (!importPath.endsWith('.js') && !importPath.endsWith('.ts')) {
      try {
        // Check if the imported file exists with .js or .ts extension
        const jsFile = `${importPath}.js`;
        const tsFile = `${importPath}.ts`;
        
        if (fs.existsSync(path.resolve(path.dirname(filePath), jsFile))) {
          return `from '${jsFile}'`;
        } else if (fs.existsSync(path.resolve(path.dirname(filePath), tsFile))) {
          return `from '${tsFile}'`;
        }
      } catch (err) {
        // Ignore errors and leave the import as is
      }
    }
    return match;
  });
  
  // Convert file to Vitest
  if (content !== originalContent) {
    // Create a backup of the original file
    const backupPath = `${filePath}.jest-backup`;
    fs.writeFileSync(backupPath, originalContent);
    
    // Write the converted file
    fs.writeFileSync(filePath, content);
    
    log(`  ✓ Migrated successfully (backup at ${backupPath})`, colors.fgGreen);
    return true;
  } else {
    log(`  ✓ No changes needed`, colors.fgYellow);
    return false;
  }
}

// Find all Jest test files that involve database testing
function findDatabaseTestFiles() {
  log('Finding database test files...', colors.fgBlue);
  
  // Look for common patterns in test files that indicate database usage
  const patterns = [
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.spec.js',
    '**/*.spec.ts',
  ];
  
  const allTestFiles = [];
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, {
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
    });
    allTestFiles.push(...files);
  });
  
  // Filter to only include files with database operations
  const databaseTestFiles = allTestFiles.filter(file => {
    const content = fs.readFileSync(file, 'utf8');
    return (
      // Look for common database-related terms
      content.includes('database') ||
      content.includes('connection') ||
      content.includes('transaction') ||
      content.includes('query') ||
      content.includes('repository') ||
      content.includes('sql') ||
      content.includes('db') ||
      content.includes('drizzle') ||
      content.includes('postgres') ||
      content.includes('pg')
    );
  });
  
  log(`Found ${databaseTestFiles.length} database test files`, colors.fgGreen);
  return databaseTestFiles;
}

// Main function
function main() {
  log('\n======================================', colors.fgMagenta);
  log('  DATABASE TEST MIGRATION TO VITEST', colors.bright + colors.fgMagenta);
  log('======================================\n', colors.fgMagenta);
  
  // Find all database test files
  const files = findDatabaseTestFiles();
  
  if (files.length === 0) {
    log('No database test files found.', colors.fgYellow);
    return;
  }
  
  // Confirm migration
  log('The following files will be migrated to Vitest:', colors.fgYellow);
  files.forEach(file => log(`  - ${file}`, colors.fgCyan));
  
  // Migrate each file
  log('\nStarting migration...', colors.fgBlue);
  
  let migratedCount = 0;
  
  files.forEach(file => {
    try {
      const migrated = migrateFile(file);
      if (migrated) migratedCount++;
    } catch (error) {
      log(`  ✗ Error migrating ${file}: ${error.message}`, colors.fgRed);
    }
  });
  
  // Summary
  log('\n======================================', colors.fgGreen);
  log(`  MIGRATION COMPLETE: ${migratedCount}/${files.length} files migrated`, colors.bright + colors.fgGreen);
  log('======================================\n', colors.fgGreen);
  
  if (migratedCount > 0) {
    log('Next steps:', colors.fgYellow);
    log('1. Run the migrated tests to verify they work correctly', colors.fgYellow);
    log('2. Check for any remaining Jest-specific code that needs manual updates', colors.fgYellow);
    log('3. Update any imports or requires that might need adjustment', colors.fgYellow);
    log('4. Review test timeouts and async handling', colors.fgYellow);
  }
}

// Run the main function
main();