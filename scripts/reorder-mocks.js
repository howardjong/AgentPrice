/**
 * A focused script to reorder vi.mock() calls before imports
 * This is a simplified version for demonstration purposes
 */

import fs from 'fs/promises';

// The target test file
const targetFile = 'tests/unit/services/researchService.vitest.js';

async function fixFile() {
  try {
    console.log(`Processing ${targetFile}...`);
    
    // Read the file
    const content = await fs.readFile(targetFile, 'utf8');
    
    // Find the imports and mocks
    const importSectionEndIndex = content.indexOf('// Mock all dependencies');
    
    if (importSectionEndIndex === -1) {
      console.log('Could not find import section end marker');
      return;
    }
    
    // Extract sections
    const importSection = content.substring(0, importSectionEndIndex);
    
    // Extract the mock section
    const mockSectionStartIndex = content.indexOf('// Mock all dependencies');
    const mockSectionEndIndex = content.indexOf('describe(\'ResearchService\'');
    
    if (mockSectionStartIndex === -1 || mockSectionEndIndex === -1) {
      console.log('Could not find mock section or describe block');
      return;
    }
    
    const mockSection = content.substring(mockSectionStartIndex, mockSectionEndIndex);
    const restOfFile = content.substring(mockSectionEndIndex);
    
    // Rearrange: mocks first, then imports, then rest of file
    const mockSectionWithoutComment = mockSection
      .replace('// Mock all dependencies\n', '')
      .trim();
      
    const newContent = '// All mocks must come before imports in Vitest\n' +
      mockSectionWithoutComment + '\n\n' +
      importSection +
      '// Test implementation\n' +
      restOfFile;
    
    // Write to a new file to compare
    await fs.writeFile(`${targetFile}.fixed`, newContent, 'utf8');
    
    console.log(`Fixed version written to ${targetFile}.fixed`);
    console.log('Please review the changes before applying them to the original file.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixFile();