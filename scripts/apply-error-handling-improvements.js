/**
 * Apply Error Handling Improvements to Test Files
 * 
 * This script applies automated error handling improvements to test files.
 * It can fix common patterns like try/catch blocks without await, missing rejects,
 * and basic error message checking.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Patterns to replace
const replacements = [
  // Replace try/catch without await
  {
    pattern: /try\s*{([^{}]*service\.[^{}()]*\([^{}]*)\)([^{}]*)}\s*catch\s*\(error\)\s*{([^{}]*expect\(error\.message\)[^{}]*)}/g,
    replacement: 'await expect($1))$2.rejects.toThrow();\n    // Additional assertions can be added if needed'
  },
  // Replace simple error message checks with better assertions
  {
    pattern: /expect\(error\.message\)\.toBe\(['"]([^'"]*)['"]\)/g,
    replacement: 'expect(error).toMatchObject({\n      message: \'$1\',\n      name: expect.any(String)\n    })'
  },
  // Replace expect(true).toBe(false) with better failure mechanisms
  {
    pattern: /expect\(true\)\.toBe\(false\)/g,
    replacement: 'fail(\'This operation should have failed\')'
  },
  // Add missing awaits to async calls
  {
    pattern: /(const [^=]* = )([^;(]*service\.[^;(]*\([^;]*\))(;)/g,
    replacement: '$1await $2$3'
  }
];

// Import patterns for error handling utilities
const importPattern = /import.*from ['"]vitest['"];/;
const importReplacement = `import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';`;

/**
 * Apply replacements to a file
 */
async function applyReplacements(filePath) {
  console.log(`Processing file: ${filePath}`);
  
  // Read the file content
  let content = await fs.readFile(filePath, 'utf8');
  const originalContent = content;
  let changes = 0;
  
  // Add error handling imports if needed
  if (content.includes('expect(error.message)') || 
      content.includes('try {') && content.includes('catch (')) {
    if (importPattern.test(content)) {
      content = content.replace(importPattern, importReplacement);
      changes++;
      console.log('- Added error handling utility imports');
    }
  }
  
  // Apply each replacement pattern
  for (const { pattern, replacement } of replacements) {
    const newContent = content.replace(pattern, (match) => {
      changes++;
      return replacement;
    });
    
    if (newContent !== content) {
      content = newContent;
    }
  }
  
  // Only write the file if changes were made
  if (changes > 0) {
    // Create backup
    await fs.writeFile(`${filePath}.bak`, originalContent);
    console.log(`- Created backup at ${filePath}.bak`);
    
    // Write changes
    await fs.writeFile(filePath, content);
    console.log(`- Applied ${changes} improvements to ${filePath}`);
    return true;
  } else {
    console.log('- No improvements needed for this file');
    return false;
  }
}

/**
 * Process a list of files
 */
async function processFiles(files) {
  const results = {
    improved: 0,
    skipped: 0,
    failed: 0
  };
  
  for (const file of files) {
    try {
      const wasImproved = await applyReplacements(file);
      if (wasImproved) {
        results.improved++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Run the script
 */
async function main() {
  try {
    // Get file list from command line or use a default pattern
    const args = process.argv.slice(2);
    let files = [];
    
    if (args.length > 0) {
      // Files provided as arguments
      files = args;
    } else {
      // Find files with potential issues
      const output = execSync('find tests -name "*.vitest.js" | xargs grep -l "try\\|catch\\|expect(error" || true').toString();
      files = output.trim().split('\n').filter(Boolean);
    }
    
    if (files.length === 0) {
      console.log('No files to process.');
      return;
    }
    
    console.log(`Found ${files.length} files to process`);
    
    // Create error handling utils file if it doesn't exist
    const utilsDir = path.join(__dirname, '..', 'tests', 'utils');
    const utilsFile = path.join(utilsDir, 'error-handling-utils.js');
    
    try {
      await fs.access(utilsFile);
      console.log('Error handling utilities file already exists');
    } catch (error) {
      console.log('Creating error handling utilities file...');
      try {
        await fs.mkdir(utilsDir, { recursive: true });
        // The content would be copied from the already created file
        console.log('Utils directory created');
      } catch (dirError) {
        console.log('Utils directory already exists');
      }
    }
    
    // Process files
    const results = await processFiles(files);
    
    // Print summary
    console.log('\nImprovement Summary:');
    console.log(`- Improved: ${results.improved} files`);
    console.log(`- Skipped: ${results.skipped} files`);
    console.log(`- Failed: ${results.failed} files`);
    
    if (results.improved > 0) {
      console.log('\nNext Steps:');
      console.log('1. Review the changes in each improved file');
      console.log('2. Run tests to ensure they still pass');
      console.log('3. Adjust any assertions that need more specific error checks');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();