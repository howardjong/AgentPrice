/**
 * Script to fix hoisting issues with vi.mock() in test files
 * 
 * In Vitest, vi.mock() calls are hoisted to the top of the file automatically
 * but we need to add the hoistingImports: true option to handle mock functions
 * that reference variables defined after the mock calls
 */

import fs from 'fs/promises';

// The target test file
const targetFile = 'tests/unit/services/researchService.vitest.js';

async function fixFile() {
  try {
    console.log(`Processing ${targetFile}...`);
    
    // Read the file
    const content = await fs.readFile(targetFile, 'utf8');
    
    // Look for vi.mock calls and update them with hoistingImports: true
    let updatedContent = content;
    
    // Regular expression to find vi.mock calls - be specific to avoid matching other functions
    const mockRegex = /vi\.mock\((['"].*?['"])(,\s*\(\s*\)\s*=>\s*\{[^}]*\}\))?;/g;
    
    // Add the hoistingImports: true option to each vi.mock call
    updatedContent = updatedContent.replace(mockRegex, (match, path, implementation) => {
      // Check if there's an implementation
      if (!implementation) {
        // For simple mocks: vi.mock('path');
        return `vi.mock(${path}, { hoistingImports: true });`;
      } else {
        // For mocks with factory functions: vi.mock('path', () => { ... });
        return `vi.mock(${path}, { hoistingImports: true${implementation};`;
      }
    });

    // Add a comment at the top of the file
    updatedContent = 
      `// NOTE: This file uses vi.mock() with hoistingImports: true to ensure proper hoisting\n` + 
      updatedContent;
    
    // Write to a new file to compare
    await fs.writeFile(`${targetFile}.hoisted`, updatedContent, 'utf8');
    
    console.log(`Fixed version written to ${targetFile}.hoisted`);
    console.log('Please review the changes before applying them to the original file.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixFile();