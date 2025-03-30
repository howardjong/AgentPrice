/**
 * Time Testing Improvement Script
 * 
 * This script scans test files for problematic time-related patterns
 * and suggests improvements by leveraging the time-testing-utils library.
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to identify problematic time-related code
const PATTERNS = {
  directPerformanceNow: {
    pattern: /performance\.now\(\)/g,
    suggestion: 'Consider using time-testing-utils.js to mock performance.now for consistent test results'
  },
  performanceNowMocking: {
    pattern: /vi\.stubGlobal\(['"]performance['"]\s*,\s*{.*?now\s*:\s*vi\.fn\(\)/gs,
    suggestion: 'Replace with mockPerformanceNowSequence from time-testing-utils.js'
  },
  dateNowUsage: {
    pattern: /Date\.now\(\)/g,
    suggestion: 'Consider using time-testing-utils.js to mock Date.now for consistent test results'
  },
  setTimeoutWithoutMock: {
    pattern: /setTimeout\s*\(/g,
    suggestion: 'Ensure setTimeout is properly mocked using TimeController or vi.useFakeTimers'
  },
  setIntervalWithoutMock: {
    pattern: /setInterval\s*\(/g,
    suggestion: 'Ensure setInterval is properly mocked using TimeController or vi.useFakeTimers'
  },
  advanceTimersByTime: {
    pattern: /vi\.advanceTimersByTime\s*\(/g,
    suggestion: 'Consider using timeController.advanceTime for more control over time progression'
  },
  testingPromisesWithDelay: {
    pattern: /new Promise\s*\(\s*(?:function\s*\([^)]*\)|[^=>]*=>)\s*{[^}]*setTimeout\s*\([^,]*,\s*\d+\s*\)/gs,
    suggestion: 'Replace with wait() from time-testing-utils.js for better time control'
  },
  sleepImplementation: {
    pattern: /(?:function|const)\s+\w+\s*=\s*(?:function\s*\([^)]*\)|[^=>]*=>)\s*{[^}]*new Promise\s*\(\s*(?:function\s*\([^)]*\)|[^=>]*=>)\s*{[^}]*setTimeout\s*\([^,]*,\s*[^)]*\)/gs,
    suggestion: 'Replace custom sleep functions with wait() from time-testing-utils.js'
  },
  manualTimeMocking: {
    pattern: /(?:let|var|const)\s+(\w+Time|\w+_time|\w+Clock)\s*=\s*\d+[\s\S]*?\1\s*(?:\+=|\-=|=)\s*\d+/gs,
    suggestion: 'Use TimeController for better time manipulation control'
  },
  realTimeDependentTests: {
    pattern: /expect\([^)]*\)\.toBeLessThan\(\s*\d+\s*\)/g,
    contextPattern: /performance\.now\(\)|Date\.now\(\)/,
    suggestion: 'This test may be time-dependent. Consider using time-testing-utils.js for deterministic results'
  }
};

/**
 * Find all test files
 * @returns {Promise<string[]>} Array of file paths
 */
async function findTestFiles() {
  try {
    const result = execSync('find tests -type f -name "*.vitest.js" -o -name "*.test.js"', { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error finding test files:', error.message);
    return [];
  }
}

/**
 * Analyze a file for problematic patterns
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];
    
    // Check for time-testing-utils.js import
    const hasTimeTestingUtils = content.includes('time-testing-utils');
    
    Object.entries(PATTERNS).forEach(([name, { pattern, contextPattern, suggestion }]) => {
      const matches = content.match(pattern);
      
      if (matches) {
        // For patterns that need context, check if the context exists
        if (contextPattern && !content.match(contextPattern)) {
          return;
        }
        
        issues.push({
          name,
          count: matches.length,
          suggestion
        });
      }
    });
    
    return {
      path: filePath,
      hasTimeTestingUtils,
      issues
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return {
      path: filePath,
      error: error.message
    };
  }
}

/**
 * Generate improved code for the file
 * @param {string} filePath - Path to the file
 * @param {Object} analysis - Analysis results
 * @returns {Promise<string>} - Improved code
 */
async function generateImprovedCode(filePath, analysis) {
  const content = await fs.readFile(filePath, 'utf8');
  let improvedCode = content;
  
  // Add import if needed
  if (analysis.issues.length > 0 && !analysis.hasTimeTestingUtils) {
    // Find the last import statement
    const lastImportMatch = content.match(/import\s+.*?from\s+['"].*?['"]/gs);
    const lastImport = lastImportMatch ? lastImportMatch[lastImportMatch.length - 1] : null;
    
    if (lastImport) {
      const importStatement = `import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../utils/time-testing-utils.js';`;
      improvedCode = improvedCode.replace(
        lastImport, 
        `${lastImport}\n${importStatement}`
      );
    }
  }
  
  // Replace problematic patterns
  if (analysis.issues.some(i => i.name === 'performanceNowMocking')) {
    // Replace vi.stubGlobal performance.now implementations with mockPerformanceNowSequence
    improvedCode = improvedCode.replace(
      /vi\.stubGlobal\(['"]performance['"]\s*,\s*{\s*now\s*:\s*vi\.fn\(\)\s*\.mockReturnValueOnce\((\d+)\)(?:\.mockReturnValueOnce\((\d+)\))?/g,
      (match, val1, val2) => {
        const values = [val1];
        if (val2) values.push(val2);
        return `vi.stubGlobal('performance', { now: mockPerformanceNowSequence(${values.join(', ')})`;
      }
    );
  }
  
  // Add TimeController usage pattern
  if (analysis.issues.some(i => 
    ['setTimeoutWithoutMock', 'setIntervalWithoutMock', 'manualTimeMocking'].includes(i.name)
  ) && !improvedCode.includes('createTimeController')) {
    
    // Find the describe block
    const describeMatch = improvedCode.match(/describe\s*\(['"](.*?)['"],\s*(?:function\s*\(\)|[^=>]*=>)\s*{/);
    
    if (describeMatch) {
      const beforeEachMatch = improvedCode.match(/beforeEach\s*\(\s*(?:function\s*\(\)|[^=>]*=>)\s*{/g);
      
      if (beforeEachMatch) {
        // Add to existing beforeEach
        improvedCode = improvedCode.replace(
          beforeEachMatch[0],
          `${beforeEachMatch[0]}\n    // Create and setup the time controller\n    const timeController = createTimeController().setup();`
        );
        
        // Also add to afterEach to restore time functions
        const afterEachMatch = improvedCode.match(/afterEach\s*\(\s*(?:function\s*\(\)|[^=>]*=>)\s*{/g);
        
        if (afterEachMatch) {
          improvedCode = improvedCode.replace(
            afterEachMatch[0],
            `${afterEachMatch[0]}\n    // Restore original time functions\n    timeController.restore();`
          );
        } else {
          // Add afterEach if it doesn't exist
          const beforeEachEndMatch = improvedCode.match(/beforeEach\s*\([^{]*{[\s\S]*?\n  \}\)/);
          if (beforeEachEndMatch) {
            improvedCode = improvedCode.replace(
              beforeEachEndMatch[0],
              `${beforeEachEndMatch[0]}\n\n  afterEach(() => {\n    // Restore original time functions\n    timeController.restore();\n  });`
            );
          }
        }
      } else {
        // Add new beforeEach and afterEach
        improvedCode = improvedCode.replace(
          describeMatch[0],
          `${describeMatch[0]}\n  let timeController;\n\n  beforeEach(() => {\n    // Create and setup the time controller\n    timeController = createTimeController().setup();\n  });\n\n  afterEach(() => {\n    // Restore original time functions\n    timeController.restore();\n  });`
        );
      }
    }
  }
  
  // Replace real sleep with wait
  if (analysis.issues.some(i => i.name === 'sleepImplementation')) {
    improvedCode = improvedCode.replace(
      /(?:function|const)\s+(\w+)\s*=\s*(?:function\s*\([^)]*\)|[^=>]*=>)\s*{\s*return\s+new Promise\s*\(\s*(?:function\s*\([^)]*\)|[^=>]*=>)\s*{\s*setTimeout\s*\([^,]*,\s*([^)]*)\)/gs,
      (match, fnName, delay) => {
        return `// Replaced custom sleep function with wait from time-testing-utils.js\nconst ${fnName} = (${delay}) => wait(${delay}`;
      }
    );
  }
  
  return improvedCode;
}

/**
 * Generate report of issues
 * @param {Array} results - Analysis results
 * @returns {string} - Markdown report
 */
function generateReport(results) {
  let report = '# Time Testing Improvement Report\n\n';
  
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const filesWithIssues = results.filter(r => r.issues.length > 0).length;
  
  report += `Found ${totalIssues} potential issues in ${filesWithIssues} files.\n\n`;
  
  // Summary of issue types
  const issueTypes = {};
  results.forEach(file => {
    file.issues.forEach(issue => {
      issueTypes[issue.name] = (issueTypes[issue.name] || 0) + issue.count;
    });
  });
  
  report += '## Issue Types\n\n';
  Object.entries(issueTypes).forEach(([name, count]) => {
    report += `- **${name}**: ${count} occurrences\n`;
  });
  
  report += '\n## Files with Issues\n\n';
  
  results
    .filter(file => file.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length)
    .forEach(file => {
      report += `### ${file.path}\n\n`;
      
      if (file.hasTimeTestingUtils) {
        report += '✅ Already imports time-testing-utils\n\n';
      } else {
        report += '❌ Does not import time-testing-utils\n\n';
      }
      
      report += 'Issues:\n\n';
      file.issues.forEach(issue => {
        report += `- **${issue.name}** (${issue.count} occurrences)\n`;
        report += `  - Suggestion: ${issue.suggestion}\n`;
      });
      
      report += '\n';
    });
  
  return report;
}

/**
 * Save improved version of the file
 * @param {string} filePath - Original file path
 * @param {string} improvedCode - Improved code
 * @returns {Promise<void>}
 */
async function saveImprovedVersion(filePath, improvedCode) {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const improvedPath = path.join(dir, `improved-${basename}`);
  
  // Make sure directory exists
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  
  await fs.writeFile(improvedPath, improvedCode, 'utf8');
  console.log(`Saved improved version to ${improvedPath}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const singleFile = args.find(arg => arg.startsWith('--file='));
  
  console.log('Time Testing Improvement Tool');
  console.log('-----------------------------');
  
  let files;
  if (singleFile) {
    const filePath = singleFile.split('=')[1];
    files = [filePath];
    console.log(`Analyzing single file: ${filePath}`);
  } else {
    console.log('Finding test files...');
    files = await findTestFiles();
    console.log(`Found ${files.length} test files`);
  }
  
  if (files.length === 0) {
    console.log('No files to analyze. Exiting.');
    return;
  }
  
  console.log('Analyzing files for time-related issues...');
  const results = [];
  
  for (const file of files) {
    const analysis = await analyzeFile(file);
    results.push(analysis);
    
    // Status update for large codebases
    if (files.length > 10 && results.length % 10 === 0) {
      console.log(`Analyzed ${results.length}/${files.length} files...`);
    }
  }
  
  console.log('Analysis complete!');
  
  const filesWithIssues = results.filter(r => r.issues.length > 0);
  console.log(`Found ${filesWithIssues.length} files with potential time-testing issues`);
  
  if (filesWithIssues.length === 0) {
    console.log('No issues found. Exiting.');
    return;
  }
  
  // Generate and save report
  const report = generateReport(results);
  const reportPath = path.join(path.resolve(__dirname, '..'), 'tests', 'TIME_TESTING_IMPROVEMENTS_REPORT.md');
  await fs.writeFile(reportPath, report, 'utf8');
  console.log(`Report saved to ${reportPath}`);
  
  // Generate and save improved versions if requested
  if (shouldFix) {
    console.log('Generating improved versions of files with issues...');
    
    for (const file of filesWithIssues) {
      const improvedCode = await generateImprovedCode(file.path, file);
      await saveImprovedVersion(file.path, improvedCode);
    }
    
    console.log('Improved versions generated!');
    console.log('Review the changes and rename the files to apply the improvements.');
  } else {
    console.log('Run with --fix to generate improved versions of problematic files');
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});