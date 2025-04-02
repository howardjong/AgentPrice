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
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// Current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fix ES module flags in a test file
 */
async function fixFile(filePath) {
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
  
  // We need more precise detection rather than simple string includes
  
  // Look for ES module style mocks (using default: or named exports)
  const mockBlocks = [];
  let mockStartIndex = 0;
  let inMockBlock = false;
  let openBraces = 0;
  let currentBlock = '';
  let mockPath = '';
  
  // Try several regex patterns to find all vi.mock blocks
  // Pattern 1: Regular vi.mock with function body - vi.mock('path', () => { ... });
  const mockRegexBody = /vi\.mock\((['"])(.+?)\1(?:,\s*(?:{.*?})?)?,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/g;
  let match;
  
  while ((match = mockRegexBody.exec(content)) !== null) {
    const mockPath = match[2];
    const mockContent = match[0];
    const mockStartIndex = match.index;
    const mockEndIndex = mockStartIndex + mockContent.length;
    
    mockBlocks.push({
      path: mockPath,
      content: mockContent,
      startIndex: mockStartIndex,
      endIndex: mockEndIndex,
      innerContent: match[3] || ''
    });
    
    console.log(`[Pattern 1] Found mock for ${mockPath}`);
  }
  
  // Pattern 2: Shorthand vi.mock with object - vi.mock('path', () => ({ ... }));
  const mockRegexObject = /vi\.mock\((['"])(.+?)\1(?:,\s*(?:{.*?})?)?,\s*\(\)\s*=>\s*\(\{([\s\S]*?)}\)\);/g;
  
  while ((match = mockRegexObject.exec(content)) !== null) {
    // Skip if this section was already matched by the first pattern
    let alreadyMatched = false;
    
    for (const block of mockBlocks) {
      if (match.index >= block.startIndex && match.index < block.endIndex) {
        alreadyMatched = true;
        break;
      }
    }
    
    if (!alreadyMatched) {
      const mockPath = match[2];
      const mockContent = match[0];
      const mockStartIndex = match.index;
      const mockEndIndex = mockStartIndex + mockContent.length;
      
      mockBlocks.push({
        path: mockPath,
        content: mockContent,
        startIndex: mockStartIndex,
        endIndex: mockEndIndex,
        innerContent: match[3] || ''
      });
      
      console.log(`[Pattern 2] Found mock for ${mockPath}`);
    }
  }
  
  // Pattern 3: Simple mock with no options - vi.mock('path');
  const mockRegexSimple = /vi\.mock\((['"])(.+?)\1\);/g;
  
  while ((match = mockRegexSimple.exec(content)) !== null) {
    // Skip if this section was already matched by previous patterns
    let alreadyMatched = false;
    
    for (const block of mockBlocks) {
      if (match.index >= block.startIndex && match.index < block.endIndex) {
        alreadyMatched = true;
        break;
      }
    }
    
    if (!alreadyMatched) {
      const mockPath = match[2];
      const mockContent = match[0];
      const mockStartIndex = match.index;
      const mockEndIndex = mockStartIndex + mockContent.length;
      
      mockBlocks.push({
        path: mockPath,
        content: mockContent,
        startIndex: mockStartIndex,
        endIndex: mockEndIndex,
        innerContent: ''
      });
      
      console.log(`[Pattern 3] Found simple mock for ${mockPath}`);
    }
  }
  
  // Second pass: Check each block and add __esModule flag if needed
  let newContent = content;
  let offset = 0; // Track offset from insertions
  
  for (const block of mockBlocks) {
    // For vi.mock blocks using arrow functions with direct object returns
    // vi.mock('module', () => ({ ... }))
    const arrowObjectPattern = /\(\)\s*=>\s*\(\{/;
    
    // For vi.mock blocks using return statements
    // vi.mock('module', () => { return { ... } })
    const returnObjectPattern = /\(\)\s*=>\s*\{[\s\S]*?return\s*\{/;
    
    const isESModule = arrowObjectPattern.test(block.content) || returnObjectPattern.test(block.content);
    const hasEsModuleFlag = block.content.includes('__esModule: true');
    
    console.log(`Mock block for ${block.path}:`);
    console.log(`- isESModule: ${isESModule}`);
    console.log(`- hasEsModuleFlag: ${hasEsModuleFlag}`);
    console.log(`- pattern matches: arrow=${arrowObjectPattern.test(block.content)}, return=${returnObjectPattern.test(block.content)}`);
    console.log(`- mock content snippet: ${block.content.substring(0, 100)}...`);
    
    // Only add flag if it's an ES module style mock and doesn't already have the flag
    if (isESModule && !hasEsModuleFlag) {
      console.log(`Adding __esModule flag to mock for ${block.path}`);
      
      let modifiedContent;
      
      if (arrowObjectPattern.test(block.content)) {
        // Arrow function with direct object return: vi.mock('module', () => ({ ... }))
        modifiedContent = block.content.replace(
          /\(\)\s*=>\s*\(\{/,
          '() => ({ __esModule: true,'
        );
      } else if (returnObjectPattern.test(block.content)) {
        // Function with return statement: vi.mock('module', () => { return { ... } })
        modifiedContent = block.content.replace(
          /(return\s*\{)/,
          '$1 __esModule: true,'
        );
      }
      
      if (modifiedContent && modifiedContent !== block.content) {
        // Replace the entire mock block
        newContent = newContent.slice(0, block.startIndex) + 
                    modifiedContent + 
                    newContent.slice(block.endIndex);
        
        // Adjust offset for subsequent replacements
        offset += modifiedContent.length - block.content.length;
        
        changes.push(`Added __esModule flag to mock for ${block.path}`);
      }
    }
  }
  
  // Only write the file if changes were made
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
      files = await glob('tests/**/*.vitest.js', { windowsPathsNoEscape: true });
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