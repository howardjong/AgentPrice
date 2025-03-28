
/**
 * Code Redundancy Analyzer
 * 
 * This script analyzes the codebase to identify potential redundancies,
 * duplicate functionality, and unnecessary components.
 */

import fs from 'fs/promises';
import path from 'path';
import glob from 'glob';
import util from 'util';

const globPromise = util.promisify(glob);

// Configuration
const DIRS_TO_SCAN = [
  'utils',
  'services',
  'tests/manual'
];

const MIN_SIMILARITY = 0.6; // Minimum similarity threshold (0-1)

// Function to read a file
async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return '';
  }
}

// Function to find all JS files in directories
async function findJsFiles(directories) {
  const allFiles = [];
  
  for (const dir of directories) {
    const files = await globPromise(path.join(dir, '**/*.js'));
    allFiles.push(...files);
  }
  
  return allFiles;
}

// Simple similarity calculation between two strings
function calculateSimilarity(str1, str2) {
  const longerStr = str1.length > str2.length ? str1 : str2;
  const shorterStr = str1.length > str2.length ? str2 : str1;
  
  if (shorterStr.length === 0) return 0;
  
  // Count similar characters
  let matchCount = 0;
  for (let i = 0; i < shorterStr.length; i++) {
    if (shorterStr[i] === longerStr[i]) {
      matchCount++;
    }
  }
  
  return matchCount / longerStr.length;
}

// Function to extract function names from code
function extractFunctionNames(code) {
  const functionPattern = /function\s+(\w+)\s*\(/g;
  const classMethodPattern = /(\w+)\s*\([^)]*\)\s*{/g;
  const arrowFunctionPattern = /const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>/g;
  
  const functions = [];
  let match;
  
  // Match regular functions
  while ((match = functionPattern.exec(code)) !== null) {
    functions.push(match[1]);
  }
  
  // Match class methods
  while ((match = classMethodPattern.exec(code)) !== null) {
    functions.push(match[1]);
  }
  
  // Match arrow functions
  while ((match = arrowFunctionPattern.exec(code)) !== null) {
    functions.push(match[1]);
  }
  
  return functions;
}

// Main function to analyze code redundancy
async function analyzeRedundancy() {
  console.log('=== Code Redundancy Analysis ===');
  
  // Find all JS files
  const files = await findJsFiles(DIRS_TO_SCAN);
  console.log(`Found ${files.length} JavaScript files to analyze`);
  
  // Read file contents
  const fileContents = {};
  for (const file of files) {
    fileContents[file] = await readFile(file);
  }
  
  // Extract function names
  const fileFunctions = {};
  for (const [file, content] of Object.entries(fileContents)) {
    fileFunctions[file] = extractFunctionNames(content);
  }
  
  // Find similar files
  const similarFiles = [];
  const duplicateFunctions = [];
  
  // Compare all files with each other
  const fileNames = Object.keys(fileContents);
  for (let i = 0; i < fileNames.length; i++) {
    const fileA = fileNames[i];
    const contentA = fileContents[fileA];
    
    for (let j = i + 1; j < fileNames.length; j++) {
      const fileB = fileNames[j];
      const contentB = fileContents[fileB];
      
      // Skip comparing the same file or empty files
      if (fileA === fileB || !contentA || !contentB) continue;
      
      // Calculate similarity
      const similarity = calculateSimilarity(contentA, contentB);
      
      if (similarity > MIN_SIMILARITY) {
        similarFiles.push({
          fileA,
          fileB,
          similarity: similarity.toFixed(2)
        });
      }
      
      // Find duplicate function names
      const functionsA = fileFunctions[fileA] || [];
      const functionsB = fileFunctions[fileB] || [];
      
      const common = functionsA.filter(fn => functionsB.includes(fn));
      
      if (common.length > 0) {
        duplicateFunctions.push({
          fileA,
          fileB,
          functions: common
        });
      }
    }
  }
  
  // Output results
  console.log('\n=== Potentially Similar Files ===');
  if (similarFiles.length === 0) {
    console.log('No similar files found');
  } else {
    similarFiles.sort((a, b) => b.similarity - a.similarity);
    similarFiles.forEach(({ fileA, fileB, similarity }) => {
      console.log(`${similarity} similarity between:`);
      console.log(`  - ${fileA}`);
      console.log(`  - ${fileB}`);
    });
  }
  
  console.log('\n=== Potentially Duplicate Functions ===');
  if (duplicateFunctions.length === 0) {
    console.log('No duplicate functions found');
  } else {
    duplicateFunctions.sort((a, b) => b.functions.length - a.functions.length);
    duplicateFunctions.forEach(({ fileA, fileB, functions }) => {
      console.log(`${functions.length} duplicated function(s) between:`);
      console.log(`  - ${fileA}`);
      console.log(`  - ${fileB}`);
      console.log(`  Functions: ${functions.join(', ')}`);
    });
  }
  
  console.log('\n=== Analysis Complete ===');
}

// Run the analysis
analyzeRedundancy().catch(error => {
  console.error('Error during redundancy analysis:', error);
});
