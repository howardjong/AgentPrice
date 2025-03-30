/**
 * Test Error Handling Improvement Script
 * 
 * This script scans test files to identify potential error handling improvements
 * and suggests better patterns to follow.
 */

import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

// Pattern definitions
const patterns = {
  tryWithoutAwait: {
    pattern: /try\s*{(?![^{}]*await)[^{}]*}\s*catch/g,
    message: 'Try/catch block without await - might not catch async errors properly'
  },
  expectInCatch: {
    pattern: /catch\s*\([^)]*\)\s*{\s*[^}]*expect\(/g,
    message: 'Using expect() in catch block - consider using expect().rejects pattern instead'
  },
  missingRejects: {
    pattern: /expect\([^)]*\)\.not\.toThrow\(/g,
    message: 'Using expect().not.toThrow() with async code - use expect().resolves instead'
  },
  asyncWithoutAwait: {
    pattern: /async[\s\w]*\([^)]*\)[^{]*{(?![^{}]*await|[^{}]*return\s*Promise)/g,
    message: 'Async function without await or returned Promise - might be missing await'
  },
  bareMinimumErrorCheck: {
    pattern: /expect\(error\.message\)\.toContain\(|expect\(error\.message\)\.toBe\(/g,
    message: 'Only checking error.message - consider using expect().rejects.toMatchObject for more thorough checks'
  },
  expectTrue: {
    pattern: /expect\(true\)\.toBe\(false\)/g,
    message: 'Using expect(true).toBe(false) to force failure - use fail() or expect().rejects instead'
  }
};

// Suggested replacements
const suggestions = {
  tryWithoutAwait: 
    `// Instead of:
try {
  service.method(); // Missing await
} catch (error) {
  expect(error.message).toBe('Error');
}

// Use:
await expect(service.method()).rejects.toThrow('Error');`,

  expectInCatch:
    `// Instead of:
try {
  await service.method();
  fail('Should have thrown');
} catch (error) {
  expect(error.message).toBe('Error');
}

// Use:
await expect(service.method()).rejects.toThrow('Error');`,

  missingRejects:
    `// Instead of:
expect(() => service.method()).not.toThrow();

// Use:
await expect(service.method()).resolves.not.toThrow();`,

  asyncWithoutAwait:
    `// Instead of:
async () => {
  const result = service.method(); // Missing await
  expect(result).toBeDefined(); // This might pass incorrectly
}

// Use:
async () => {
  const result = await service.method();
  expect(result).toBeDefined();
}`,

  bareMinimumErrorCheck:
    `// Instead of:
try {
  await service.method();
} catch (error) {
  expect(error.message).toBe('Error');
}

// Use:
await expect(service.method()).rejects.toMatchObject({
  message: 'Error',
  name: 'TypeError', // Include error type
  // Include other relevant properties
});`,

  expectTrue:
    `// Instead of:
try {
  await service.method();
  expect(true).toBe(false); // Forcing failure
} catch (error) {
  expect(error.message).toBe('Error');
}

// Use:
await expect(service.method()).rejects.toThrow('Error');`
};

/**
 * Find all test files
 */
async function findTestFiles() {
  const { stdout } = await exec('find tests -name "*.vitest.js" -type f');
  return stdout.trim().split('\n');
}

/**
 * Analyze a file for problematic patterns
 */
async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const issues = [];

  Object.entries(patterns).forEach(([name, { pattern, message }]) => {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      issues.push({
        type: name,
        count: matches.length,
        message,
        suggestion: suggestions[name]
      });
    }
  });

  return { filePath, issues };
}

/**
 * Generate a report of issues
 */
async function generateReport(results) {
  let report = '# Test Error Handling Improvement Report\n\n';
  
  // Summary section
  report += '## Summary\n\n';
  const totalIssues = results.reduce((sum, { issues }) => sum + issues.length, 0);
  const filesWithIssues = results.filter(r => r.issues.length > 0).length;
  
  report += `Found ${totalIssues} potential improvements in ${filesWithIssues} files.\n\n`;
  
  // Generate issue type summary
  const issueTypeCounts = {};
  results.forEach(({ issues }) => {
    issues.forEach(({ type }) => {
      issueTypeCounts[type] = (issueTypeCounts[type] || 0) + 1;
    });
  });
  
  report += '### Issue Types\n\n';
  Object.entries(issueTypeCounts).forEach(([type, count]) => {
    report += `- **${type}**: ${count} occurrences\n`;
  });
  
  // Detailed results
  report += '\n## Detailed Results\n\n';
  
  results.filter(r => r.issues.length > 0).forEach(({ filePath, issues }) => {
    report += `### ${filePath}\n\n`;
    
    issues.forEach(({ type, count, message, suggestion }) => {
      report += `#### ${type} (${count} occurrences)\n\n`;
      report += `**Issue**: ${message}\n\n`;
      report += `**Suggested improvement**:\n\n\`\`\`javascript\n${suggestion}\n\`\`\`\n\n`;
    });
  });
  
  report += '\n## Next Steps\n\n';
  report += '1. Review each file with issues and apply the suggested improvements\n';
  report += '2. Refer to `tests/ERROR_HANDLING_BEST_PRACTICES.md` for comprehensive guidelines\n';
  report += '3. Run tests after each change to ensure they still pass\n';
  
  return report;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Finding test files...');
    const testFiles = await findTestFiles();
    console.log(`Found ${testFiles.length} test files`);
    
    console.log('Analyzing files for error handling patterns...');
    const results = await Promise.all(testFiles.map(analyzeFile));
    
    console.log('Generating report...');
    const report = await generateReport(results);
    
    const reportPath = 'tests/ERROR_HANDLING_IMPROVEMENT_REPORT.md';
    await fs.writeFile(reportPath, report);
    
    console.log(`Report generated at ${reportPath}`);
    
    // Output quick summary to console
    const filesWithIssues = results.filter(r => r.issues.length > 0);
    console.log(`Found issues in ${filesWithIssues.length} files`);
    
    filesWithIssues.slice(0, 5).forEach(({ filePath, issues }) => {
      console.log(`- ${filePath}: ${issues.length} potential improvements`);
    });
    
    if (filesWithIssues.length > 5) {
      console.log(`... and ${filesWithIssues.length - 5} more files`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();