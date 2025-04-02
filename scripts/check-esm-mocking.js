/**
 * ESM Mocking Pattern Verification Script
 * 
 * This script analyzes test files to check if they follow the recommended
 * ES module mocking patterns defined in our guidelines.
 * 
 * It looks for:
 * 1. Proper use of vi.mock() before imports
 * 2. Module resets between tests
 * 3. Proper handling of default and named exports
 * 4. Mock cleanup in afterEach/afterAll blocks
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// Patterns to check for
const PATTERNS = {
  RESET_MODULES: /vi\.resetModules\(\)/,
  CLEAR_ALL_MOCKS: /vi\.clearAllMocks\(\)/,
  RESTORE_ALL_MOCKS: /vi\.restoreAllMocks\(\)/,
  MOCK_BEFORE_IMPORT: /vi\.mock\([^)]*\);.*import/s,
  ES_MODULE_FLAG: /__esModule: true/,
  DEFAULT_EXPORT_MOCK: /default: \{/,
  NAMED_EXPORT_MOCK: /return \{\s+__esModule: true,\s+[a-zA-Z]+:/,
  MOCK_CLEANUP: /(afterEach|afterAll)\s*\(\s*\(\)\s*=>\s*\{[^}]*(clearAllMocks|restoreAllMocks)/,
  DYNAMIC_IMPORT: /await import\(/,
  IMPORT_ACTUAL: /vi\.importActual\(/,
};

// Counter for tracking statistics
const stats = {
  totalFiles: 0,
  filesWithProperMockBeforeImport: 0,
  filesWithResetModules: 0,
  filesWithProperCleanup: 0,
  filesWithESModuleFlag: 0,
  filesWithDefaultExportHandling: 0,
  filesWithNamedExportHandling: 0,
  filesWithDynamicImports: 0,
  filesWithImportActual: 0,
};

// Results tracking
const results = {
  missingMockBeforeImport: [],
  missingResetModules: [],
  missingCleanup: [],
  missingESModuleFlag: [],
  missingDefaultExportHandling: [],
  missingNamedExportHandling: [],
  noteworthy: [], // Files that follow all best practices
};

/**
 * Check a file for ES module mocking patterns
 */
async function checkFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  stats.totalFiles++;

  // Only include files that actually use mocking
  if (!content.includes('vi.mock(') && !content.includes('vi.spyOn(')) {
    return;
  }

  // Check for each pattern
  const hasMockBeforeImport = PATTERNS.MOCK_BEFORE_IMPORT.test(content);
  if (hasMockBeforeImport) {
    stats.filesWithProperMockBeforeImport++;
  } else if (content.includes('vi.mock(') && content.includes('import ')) {
    results.missingMockBeforeImport.push(filePath);
  }

  const hasResetModules = PATTERNS.RESET_MODULES.test(content);
  if (hasResetModules) {
    stats.filesWithResetModules++;
  } else {
    results.missingResetModules.push(filePath);
  }

  const hasProperCleanup = PATTERNS.MOCK_CLEANUP.test(content) || 
                         (PATTERNS.CLEAR_ALL_MOCKS.test(content) && 
                          PATTERNS.RESTORE_ALL_MOCKS.test(content));
  if (hasProperCleanup) {
    stats.filesWithProperCleanup++;
  } else {
    results.missingCleanup.push(filePath);
  }

  const hasESModuleFlag = PATTERNS.ES_MODULE_FLAG.test(content);
  if (hasESModuleFlag) {
    stats.filesWithESModuleFlag++;
  } else if (content.includes('vi.mock(')) {
    results.missingESModuleFlag.push(filePath);
  }

  const hasDefaultExportHandling = PATTERNS.DEFAULT_EXPORT_MOCK.test(content);
  if (hasDefaultExportHandling) {
    stats.filesWithDefaultExportHandling++;
  } else if (content.includes('vi.mock(')) {
    results.missingDefaultExportHandling.push(filePath);
  }

  const hasNamedExportHandling = PATTERNS.NAMED_EXPORT_MOCK.test(content);
  if (hasNamedExportHandling) {
    stats.filesWithNamedExportHandling++;
  } else if (content.includes('vi.mock(') && !hasDefaultExportHandling) {
    results.missingNamedExportHandling.push(filePath);
  }

  const hasDynamicImports = PATTERNS.DYNAMIC_IMPORT.test(content);
  if (hasDynamicImports) {
    stats.filesWithDynamicImports++;
  }

  const hasImportActual = PATTERNS.IMPORT_ACTUAL.test(content);
  if (hasImportActual) {
    stats.filesWithImportActual++;
  }

  // Track noteworthy files (following best practices)
  if (hasResetModules && hasProperCleanup && 
      (hasESModuleFlag || !content.includes('vi.mock(')) &&
      (hasDefaultExportHandling || hasNamedExportHandling || !content.includes('vi.mock('))) {
    results.noteworthy.push(filePath);
  }
}

/**
 * Main function to scan all test files
 */
async function main() {
  try {
    console.log('🔍 Scanning test files for ES module mocking patterns...');
    
    // Find all Vitest test files
    const files = await glob('tests/**/*.vitest.js', { windowsPathsNoEscape: true });
    
    // Check each file
    for (const file of files) {
      await checkFile(file);
    }
    
    // Print results
    console.log('\n📊 ES Module Mocking Analysis Results');
    console.log('====================================');
    console.log(`Total test files scanned: ${stats.totalFiles}`);
    console.log(`\nBest Practices Implementation:`);
    console.log(`- Files with proper vi.mock() before import: ${stats.filesWithProperMockBeforeImport} (${getPercentage(stats.filesWithProperMockBeforeImport)})`);
    console.log(`- Files with vi.resetModules(): ${stats.filesWithResetModules} (${getPercentage(stats.filesWithResetModules)})`);
    console.log(`- Files with proper mock cleanup: ${stats.filesWithProperCleanup} (${getPercentage(stats.filesWithProperCleanup)})`);
    console.log(`- Files with __esModule flag: ${stats.filesWithESModuleFlag} (${getPercentage(stats.filesWithESModuleFlag)})`);
    console.log(`- Files handling default exports: ${stats.filesWithDefaultExportHandling} (${getPercentage(stats.filesWithDefaultExportHandling)})`);
    console.log(`- Files handling named exports: ${stats.filesWithNamedExportHandling} (${getPercentage(stats.filesWithNamedExportHandling)})`);
    console.log(`- Files using dynamic imports: ${stats.filesWithDynamicImports} (${getPercentage(stats.filesWithDynamicImports)})`);
    console.log(`- Files using vi.importActual(): ${stats.filesWithImportActual} (${getPercentage(stats.filesWithImportActual)})`);
    
    console.log(`\n📝 Noteworthy examples (following best practices): ${results.noteworthy.length}`);
    if (results.noteworthy.length > 0) {
      console.log(results.noteworthy.slice(0, 5).join('\n'));
      if (results.noteworthy.length > 5) {
        console.log(`... and ${results.noteworthy.length - 5} more`);
      }
    }

    console.log('\n⚠️ Areas for Improvement:');
    
    if (results.missingResetModules.length > 0) {
      console.log(`\nFiles missing vi.resetModules() (${results.missingResetModules.length}):`);
      printLimitedResults(results.missingResetModules);
    }
    
    if (results.missingCleanup.length > 0) {
      console.log(`\nFiles missing proper mock cleanup (${results.missingCleanup.length}):`);
      printLimitedResults(results.missingCleanup);
    }
    
    if (results.missingMockBeforeImport.length > 0) {
      console.log(`\nFiles with potential incorrect mocking order (${results.missingMockBeforeImport.length}):`);
      printLimitedResults(results.missingMockBeforeImport);
    }
    
    if (results.missingESModuleFlag.length > 0) {
      console.log(`\nFiles missing __esModule flag (${results.missingESModuleFlag.length}):`);
      printLimitedResults(results.missingESModuleFlag);
    }
    
    if (results.missingDefaultExportHandling.length > 0 && results.missingNamedExportHandling.length > 0) {
      console.log(`\nFiles potentially not handling exports properly (${results.missingDefaultExportHandling.length}):`);
      printLimitedResults(results.missingDefaultExportHandling);
    }

    console.log('\n✅ Recommendation:');
    console.log(`Update test files to follow the best practices in tests/docs/guidelines/vitest-module-mocking-guidelines.md`);
    
  } catch (error) {
    console.error('Error scanning test files:', error);
    process.exit(1);
  }
}

/**
 * Print a limited number of results to avoid cluttering the console
 */
function printLimitedResults(array, limit = 10) {
  const items = array.slice(0, limit);
  console.log(items.join('\n'));
  if (array.length > limit) {
    console.log(`... and ${array.length - limit} more`);
  }
}

/**
 * Calculate percentage
 */
function getPercentage(value) {
  if (stats.totalFiles === 0) return '0%';
  return `${Math.round((value / stats.totalFiles) * 100)}%`;
}

// Run the script
main().catch(console.error);