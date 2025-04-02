/**
 * ESModule Flag Fixer Script
 * 
 * This script specifically adds the __esModule: true flag to ES module style mocks
 * in Vitest test files. This is important to ensure that default exports and named
 * exports work correctly with ES modules.
 * 
 * USAGE:
 *   node scripts/fix-esm-flags.js [path/to/test/file.vitest.js]
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

/**
 * Fix ES module flags in a test file
 */
async function fixFile(filePath) {
  console.log(`Analyzing ${filePath}...`);
  
  // Read the file
  const content = await fs.readFile(filePath, 'utf8');
  const originalContent = content;
  const changes = [];
  
  // Find all vi.mock statements
  const mockStatements = [];
  let currentIndex = 0;
  
  // Search the file for vi.mock() calls
  while (true) {
    const startIndex = content.indexOf('vi.mock(', currentIndex);
    if (startIndex === -1) break;
    
    // Find the matching closing parenthesis by tracking parentheses balance
    let parenCount = 1;
    let endIndex = startIndex + 8; // Skip 'vi.mock('
    let inString = false;
    let stringChar = '';
    
    while (parenCount > 0 && endIndex < content.length) {
      const char = content[endIndex];
      
      // Handle strings to avoid counting parens inside strings
      if ((char === "'" || char === '"') && 
          (endIndex === 0 || content[endIndex - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (stringChar === char) {
          inString = false;
        }
      }
      
      // Only count parens when not in a string
      if (!inString) {
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
      }
      
      endIndex++;
    }
    
    if (parenCount === 0) {
      // Complete vi.mock statement found
      const fullStatement = content.substring(startIndex, endIndex);
      
      // Extract module path
      const modulePathMatch = fullStatement.match(/vi\.mock\(['"]([^'"]+)['"]/);
      const modulePath = modulePathMatch ? modulePathMatch[1] : 'unknown';
      
      // Check for ES module style mocks (object literals)
      const hasObjectLiteral = fullStatement.includes(' => ({') || 
                               fullStatement.includes('return {');
      
      // Check if __esModule flag is already present
      const hasEsModuleFlag = fullStatement.includes('__esModule: true');
      
      mockStatements.push({
        path: modulePath,
        content: fullStatement,
        startIndex,
        endIndex,
        hasObjectLiteral,
        hasEsModuleFlag
      });
      
      console.log(`Found vi.mock for ${modulePath}`);
    }
    
    currentIndex = startIndex + 8; // Move past 'vi.mock('
  }
  
  // Filter to get only ES module style mocks missing the __esModule flag
  const blocksThatNeedFixes = mockStatements.filter(mock => 
    mock.hasObjectLiteral && !mock.hasEsModuleFlag
  );
  
  // Fix each block that needs the __esModule flag
  let newContent = content;
  let offset = 0; // Track position offset from earlier replacements
  
  for (const block of blocksThatNeedFixes) {
    console.log(`Adding __esModule flag to mock for ${block.path}`);
    
    let modifiedContent;
    
    // Targeted approach based on the mock pattern
    if (block.content.includes(' => ({')) {
      // Arrow function with object literal: vi.mock('path', () => ({ ... }))
      modifiedContent = block.content.replace(
        /(\(\)\s*=>\s*\(\{)/,
        '$1\n  __esModule: true,'
      );
    } else if (block.content.includes('return {')) {
      // Function with return statement: vi.mock('path', () => { return { ... } })
      modifiedContent = block.content.replace(
        /(return\s*\{)/,
        '$1\n  __esModule: true,'
      );
    }
    
    if (modifiedContent && modifiedContent !== block.content) {
      // Update the content with the modified mock
      const adjustedStartIndex = block.startIndex + offset;
      newContent = newContent.slice(0, adjustedStartIndex) + 
                  modifiedContent + 
                  newContent.slice(adjustedStartIndex + block.content.length);
      
      // Adjust offset for subsequent replacements
      offset += modifiedContent.length - block.content.length;
      
      changes.push(`Added __esModule flag to mock for ${block.path}`);
    }
  }
  
  // Save changes if any were made
  if (newContent !== originalContent) {
    console.log(`✅ Applied fixes to ${filePath}:`);
    changes.forEach(change => console.log(`  - ${change}`));
    
    // Create a backup before modifying
    await fs.writeFile(`${filePath}.bak`, originalContent, 'utf8');
    await fs.writeFile(filePath, newContent, 'utf8');
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
    // Get file path from command line argument or process all files
    const args = process.argv.slice(2);
    let files = [];
    
    if (args.length > 0) {
      // Process specific file(s)
      files = args;
    } else {
      // Process all Vitest test files
      console.log('No specific file provided. Scanning all test files...');
      files = await glob('tests/**/*.vitest.js');
    }
    
    // Stats
    let processed = 0;
    let fixed = 0;
    
    // Process each file
    for (const file of files) {
      processed++;
      const wasFixed = await fixFile(file);
      if (wasFixed) fixed++;
    }
    
    // Summary
    console.log('\n📊 Summary:');
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