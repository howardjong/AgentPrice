/**
 * ESM Mocking Fixer Script
 * 
 * This script helps fix common ESM mocking issues in test files:
 * 1. Ensures vi.mock() calls appear before imports OR
 *    Adds hoistingImports: true option to allow imports to be processed before factory functions
 * 2. Adds module reset and cleanup hooks if missing
 * 3. Adds __esModule flag to module mocks where missing
 * 
 * USAGE:
 *   node scripts/fix-esm-mocking.js [--mode=hoisting|reorder] [path/to/test/file.vitest.js]
 *   
 * Options:
 *   --mode=hoisting   Use the hoistingImports approach (default)
 *   --mode=reorder    Physically move vi.mock() calls before imports
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// Current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Templates for the fixes
const TEMPLATES = {
  CLEANUP_HOOKS: `
  // Reset modules and clear mocks before each test
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  
  // Restore original implementations after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });`,
  ES_MODULE_FLAG: `    __esModule: true,`,
};

/**
 * Fix issues in a single test file
 */
async function fixFile(filePath, options = { mode: 'hoisting' }) {
  console.log(`Analyzing ${filePath}...`);
  
  // Read the file content
  let content = await fs.readFile(filePath, 'utf8');
  const originalContent = content;
  let changes = [];
  
  // Check if file uses vi.mock
  if (!content.includes('vi.mock(')) {
    console.log(`No vi.mock() calls found in ${filePath}, skipping.`);
    return false;
  }
  
  // Fix 1: Handle vi.mock() calls that appear after imports
  const importIndex = content.indexOf('import ');
  if (importIndex > -1) {
    const viMockIndex = content.indexOf('vi.mock(');
    
    if (viMockIndex > importIndex) {
      if (options.mode === 'reorder') {
        // APPROACH 1: Reorder - Move vi.mock calls before imports
        console.log('⚠️ Found vi.mock() calls after imports. Reordering...');
        
        // Extract all vi.mock calls
        const mockCalls = [];
        const mockRegex = /vi\.mock\([^)]*\)(?:\s*,\s*\(\s*\)\s*=>\s*\{[^}]*\})?\s*;/g;
        const contentCopy = content; // Make a copy to extract from
        let match;
        while ((match = mockRegex.exec(contentCopy)) !== null) {
          mockCalls.push(match[0]);
        }
        
        if (mockCalls.length > 0) {
          // Remove the mock calls from their original positions
          content = content.replace(/vi\.mock\([^)]*\)(?:\s*,\s*\(\s*\)\s*=>\s*\{[^}]*\})?\s*;/g, '');
          
          // Add them before the first import
          const mockCode = mockCalls.join('\n') + '\n\n';
          content = content.slice(0, importIndex) + mockCode + content.slice(importIndex);
          changes.push('Moved vi.mock() calls before imports');
        }
      } else {
        // APPROACH 2: Hoisting - Add hoistingImports: true option
        console.log('⚠️ Found vi.mock() calls after imports. Adding hoistingImports: true...');
        
        // Regular expression to find vi.mock calls
        const mockRegex = /vi\.mock\((['"].*?['"])(,\s*\(\s*\)\s*=>\s*\{[^}]*\}\))?;/g;
        
        // Add the hoistingImports: true option to each vi.mock call
        let newContent = content;
        const contentCopy = content; // Make a copy to extract from
        let match;
        while ((match = mockRegex.exec(contentCopy)) !== null) {
          const [fullMatch, path, implementation] = match;
          let replacement;
          
          if (!implementation) {
            // For simple mocks: vi.mock('path');
            replacement = `vi.mock(${path}, { hoistingImports: true });`;
          } else {
            // For mocks with factory functions: vi.mock('path', () => { ... });
            replacement = `vi.mock(${path}, { hoistingImports: true${implementation};`;
          }
          
          newContent = newContent.replace(fullMatch, replacement);
        }
        
        if (newContent !== content) {
          content = newContent;
          changes.push('Added hoistingImports: true to vi.mock() calls');
          
          // Add a comment at the top of the file
          content = 
            `// NOTE: This file uses vi.mock() with hoistingImports: true to ensure proper hoisting\n` + 
            content;
        }
      }
    }
  }
  
  // Fix 2: Add module reset and cleanup hooks if missing
  if (!content.includes('vi.resetModules()')) {
    console.log('⚠️ Missing module reset. Adding cleanup hooks...');
    
    // Find the first describe or test block
    const testBlockMatch = content.match(/(describe|test|it)\s*\(\s*['"`]/);
    if (testBlockMatch) {
      const testBlockIndex = testBlockMatch.index;
      const openingBraceIndex = content.indexOf('{', testBlockIndex);
      
      if (openingBraceIndex > -1) {
        // Insert after the opening brace of the test block
        content = content.slice(0, openingBraceIndex + 1) + 
                 TEMPLATES.CLEANUP_HOOKS + 
                 content.slice(openingBraceIndex + 1);
        changes.push('Added module reset and cleanup hooks');
      }
    }
  }
  
  // Fix 3: Add __esModule flag to module mocks where missing
  {
    console.log('Checking for missing __esModule flag in mock implementations...');
    
    // Find all vi.mock calls
    const mockRegex = /vi\.mock\(['"]([^'"]+)['"](?:,\s*(?:{[^}]*})?)?,\s*(?:async\s*)?\(\s*\)\s*=>\s*{([^}]*)}/gs;
    let match;
    let newContent = content;
    const contentCopy = content; // Make a copy to extract from
    let flagsAdded = 0;
    
    while ((match = mockRegex.exec(contentCopy)) !== null) {
      const [fullMatch, modulePath, mockBody] = match;
      
      // Skip if the mock already has __esModule: true
      if (mockBody.includes('__esModule: true')) {
        continue;
      }
      
      // Check for ES module style exports (default export or named exports)
      const hasDefaultExport = mockBody.includes('default:') || mockBody.includes('default =');
      const hasNamedExports = /[a-zA-Z0-9_]+\s*[:=]/.test(mockBody);
      
      if (hasDefaultExport || hasNamedExports) {
        console.log(`⚠️ Found ES module style mock for "${modulePath}" missing __esModule flag`);
        
        // Two possible patterns to handle:
        // 1. return { ... }
        // 2. direct object: { ... }
        
        // Try to find "return {"
        let modifiedMatch = fullMatch;
        const returnIndex = mockBody.indexOf('return {');
        
        if (returnIndex > -1) {
          // Position right after "return {"
          const insertPos = fullMatch.indexOf('return {') + 'return {'.length;
          modifiedMatch = fullMatch.slice(0, insertPos) + 
                      '\n' + TEMPLATES.ES_MODULE_FLAG + 
                      fullMatch.slice(insertPos);
        } else {
          // If no "return", check for direct object pattern
          const openingBraceIndex = mockBody.indexOf('{');
          if (openingBraceIndex > -1) {
            // Find the position of the opening brace in the full match
            const fullOpeningBraceIndex = fullMatch.lastIndexOf('{');
            modifiedMatch = fullMatch.slice(0, fullOpeningBraceIndex + 1) + 
                        '\n' + TEMPLATES.ES_MODULE_FLAG + 
                        fullMatch.slice(fullOpeningBraceIndex + 1);
          }
        }
        
        // Apply the change if the match was modified
        if (modifiedMatch !== fullMatch) {
          newContent = newContent.replace(fullMatch, modifiedMatch);
          changes.push(`Added __esModule flag to mock implementation for ${modulePath}`);
          flagsAdded++;
        }
      }
    }
    
    if (newContent !== content) {
      content = newContent;
      console.log(`Added __esModule flag to ${flagsAdded} mock implementations`);
    }
  }
  
  // Only write the file if changes were made
  if (content !== originalContent) {
    console.log(`✅ Applied fixes to ${filePath}:`);
    changes.forEach(change => console.log(`  - ${change}`));
    
    // Create a backup before modifying
    await fs.writeFile(`${filePath}.bak`, originalContent, 'utf8');
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  } else {
    console.log(`No changes needed for ${filePath}.`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    // Parse options
    const options = {
      mode: 'hoisting' // Default to using hoistingImports approach
    };
    
    // Extract file paths and options
    const filePaths = [];
    
    for (const arg of args) {
      if (arg.startsWith('--mode=')) {
        const mode = arg.split('=')[1];
        if (mode === 'hoisting' || mode === 'reorder') {
          options.mode = mode;
          console.log(`Using ${mode} approach for fixing vi.mock() calls`);
        } else {
          console.warn(`Unknown mode: ${mode}. Using default mode: hoisting`);
        }
      } else {
        filePaths.push(arg);
      }
    }
    
    // Get files to process
    let files = [];
    
    if (filePaths.length > 0) {
      // Process specific file(s)
      files = filePaths;
    } else {
      // Process all Vitest test files
      console.log('No specific file provided. Scanning all test files...');
      files = await glob('tests/**/*.vitest.js', { windowsPathsNoEscape: true });
    }
    
    // Stats
    let processed = 0;
    let fixed = 0;
    
    // Process each file
    for (const file of files) {
      processed++;
      const wasFixed = await fixFile(file, options);
      if (wasFixed) fixed++;
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`Mode: ${options.mode}`);
    console.log(`Files processed: ${processed}`);
    console.log(`Files fixed: ${fixed}`);
    
    if (fixed > 0) {
      console.log('\n⚠️ Note: Backup files (.bak) were created for all modified files.');
      console.log('Please review the changes and run your tests to verify the fixes work correctly.');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);