/**
 * Test Coverage Report Generator
 * 
 * This script runs Vitest with coverage enabled and generates a comprehensive report.
 * The report includes:
 * - Overall coverage statistics
 * - Per-file breakdown
 * - Identification of coverage gaps
 * - Recommendations for test improvements
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const COVERAGE_DIR = './coverage';
const JSON_SUMMARY = path.join(COVERAGE_DIR, 'coverage-summary.json');
const MARKDOWN_REPORT = path.join(COVERAGE_DIR, 'coverage-summary.md');
const COVERAGE_THRESHOLD = 80; // Target coverage percentage

/**
 * Ensure the coverage directory exists
 */
async function ensureDirectoryExists(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Directory ${dir} created or already exists.`);
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error);
    throw error;
  }
}

/**
 * Run the tests with coverage enabled
 */
async function runTestsWithCoverage() {
  try {
    console.log('Running tests with coverage...');
    execSync('vitest run --coverage', { stdio: 'inherit' });
    console.log('Tests completed.');
  } catch (error) {
    console.error('Error running tests with coverage:', error);
    throw error;
  }
}

/**
 * Generate a markdown report from the coverage data
 */
async function generateMarkdownReport() {
  try {
    // Read the JSON summary file
    const jsonData = JSON.parse(await fs.readFile(JSON_SUMMARY, 'utf8'));
    
    // Extract the overall coverage
    const total = jsonData.total;
    
    // Start building the markdown report
    let markdown = `# Test Coverage Report - ${new Date().toISOString().split('T')[0]}\n\n`;
    
    // Add overall statistics
    markdown += '## Overall Coverage\n\n';
    markdown += '| Category | Coverage % | Covered/Total | Missing |\n';
    markdown += '|----------|------------|---------------|--------|\n';
    
    for (const [category, data] of Object.entries(total)) {
      const percentage = data.pct;
      const covered = data.covered;
      const totalVal = data.total;
      const missing = totalVal - covered;
      
      markdown += `| ${category} | ${percentage.toFixed(2)}% | ${covered}/${totalVal} | ${missing} |\n`;
    }
    
    // Add status based on threshold
    const overallStatus = total.lines.pct >= COVERAGE_THRESHOLD 
      ? '✅ Meets target coverage threshold' 
      : '❌ Below target coverage threshold';
    
    markdown += `\n**Status**: ${overallStatus} (Target: ${COVERAGE_THRESHOLD}%)\n\n`;
    
    // Add file breakdown
    markdown += '## File Coverage Breakdown\n\n';
    markdown += '| File | Line Coverage % | Function Coverage % | Statement Coverage % | Branch Coverage % |\n';
    markdown += '|------|----------------|-------------------|-------------------|------------------|\n';
    
    // Sort files by line coverage
    const files = Object.entries(jsonData)
      .filter(([key]) => key !== 'total')
      .sort((a, b) => a[1].lines.pct - b[1].lines.pct);
    
    // Add each file to the table
    for (const [file, data] of files) {
      if (file === 'total') continue;
      
      const lineCoverage = data.lines?.pct || 0;
      const functionCoverage = data.functions?.pct || 0;
      const statementCoverage = data.statements?.pct || 0;
      const branchCoverage = data.branches?.pct || 0;
      
      // Highlight rows with low coverage
      const isLowCoverage = lineCoverage < COVERAGE_THRESHOLD;
      const displayFile = file.replace(/^\.\//, ''); // Remove leading ./
      
      if (isLowCoverage) {
        markdown += `| **${displayFile}** | **${lineCoverage.toFixed(2)}%** | ${functionCoverage.toFixed(2)}% | ${statementCoverage.toFixed(2)}% | ${branchCoverage.toFixed(2)}% |\n`;
      } else {
        markdown += `| ${displayFile} | ${lineCoverage.toFixed(2)}% | ${functionCoverage.toFixed(2)}% | ${statementCoverage.toFixed(2)}% | ${branchCoverage.toFixed(2)}% |\n`;
      }
    }
    
    // Add recommendations
    markdown += '\n## Recommendations\n\n';
    
    // Find files with low coverage
    const lowCoverageFiles = files
      .filter(([_, data]) => data.lines.pct < COVERAGE_THRESHOLD)
      .sort((a, b) => a[1].lines.pct - b[1].lines.pct)
      .slice(0, 5); // Top 5 lowest
    
    if (lowCoverageFiles.length > 0) {
      markdown += '### Priority Files for Coverage Improvements\n\n';
      
      for (const [file, data] of lowCoverageFiles) {
        const displayFile = file.replace(/^\.\//, '');
        markdown += `1. **${displayFile}** (${data.lines.pct.toFixed(2)}% line coverage)\n`;
        
        // Add specific areas to focus on, if available
        if (data.functions && data.functions.skipped) {
          markdown += `   - Missing function coverage: ${data.functions.skipped} functions\n`;
        }
        if (data.branches && data.branches.skipped) {
          markdown += `   - Missing branch coverage: ${data.branches.skipped} branches\n`;
        }
      }
    } else {
      markdown += '✅ All files meet the coverage threshold.\n';
    }
    
    // Write the markdown file
    await fs.writeFile(MARKDOWN_REPORT, markdown);
    console.log(`Markdown report generated at ${MARKDOWN_REPORT}`);
    
    return markdown;
  } catch (error) {
    console.error('Error generating markdown report:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await ensureDirectoryExists(COVERAGE_DIR);
    await runTestsWithCoverage();
    
    // Wait a moment to ensure the JSON file is written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await generateMarkdownReport();
    console.log('Coverage report generation completed successfully.');
  } catch (error) {
    console.error('Error in coverage report generation:', error);
    process.exit(1);
  }
}

// Run the main function
main();