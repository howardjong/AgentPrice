/**
 * Collect and Organize Deep Research Results
 * 
 * This script collects all deep research test results and organizes them
 * into a single markdown report for easy viewing.
 */

import fs from 'fs/promises';
import path from 'path';

// Constants
const TEST_RESULTS_DIR = 'test-results';
const DEEP_RESEARCH_DIR = path.join(TEST_RESULTS_DIR, 'deep-research');
const REPORT_FILE = 'deep-research-report.md';

/**
 * Collect and organize all deep research results
 */
async function collectResults() {
  console.log('Collecting deep research results...');
  
  // Initialize the report content
  let reportContent = `# Perplexity Deep Research Test Report\n\n`;
  reportContent += `Generated: ${new Date().toISOString()}\n\n`;
  
  try {
    // Ensure directories exist
    await fs.mkdir(TEST_RESULTS_DIR, { recursive: true });
    await fs.mkdir(DEEP_RESEARCH_DIR, { recursive: true });
    
    // Collect all files in test-results directory
    const testResultsFiles = await fs.readdir(TEST_RESULTS_DIR);
    
    // Find deep research related files
    const deepResearchFiles = testResultsFiles.filter(file => 
      file.includes('deep-research') || 
      file.includes('standard-test') || 
      file.includes('quick-test')
    );
    
    reportContent += `## Found ${deepResearchFiles.length} related files in test-results directory\n\n`;
    
    // Process each file
    for (const file of deepResearchFiles) {
      const filePath = path.join(TEST_RESULTS_DIR, file);
      const stats = await fs.stat(filePath);
      
      reportContent += `### ${file}\n`;
      reportContent += `- Size: ${stats.size} bytes\n`;
      reportContent += `- Modified: ${stats.mtime.toISOString()}\n\n`;
      
      // If it's a JSON file, parse and show summary
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);
          
          reportContent += '```json\n';
          reportContent += JSON.stringify(data, null, 2).substring(0, 500);
          if (JSON.stringify(data, null, 2).length > 500) {
            reportContent += '\n... (truncated)';
          }
          reportContent += '\n```\n\n';
        } catch (error) {
          reportContent += `Error parsing JSON: ${error.message}\n\n`;
        }
      } else if (file.endsWith('.md') || file.endsWith('.txt')) {
        // If it's a text or markdown file, show preview
        try {
          const content = await fs.readFile(filePath, 'utf8');
          
          reportContent += '```\n';
          reportContent += content.substring(0, 500);
          if (content.length > 500) {
            reportContent += '\n... (truncated)';
          }
          reportContent += '\n```\n\n';
        } catch (error) {
          reportContent += `Error reading file: ${error.message}\n\n`;
        }
      }
    }
    
    // Check deep-research subfolder
    const deepResearchSubFiles = await fs.readdir(DEEP_RESEARCH_DIR);
    
    reportContent += `## Found ${deepResearchSubFiles.length} files in deep-research directory\n\n`;
    
    // Process each file in the subfolder
    for (const file of deepResearchSubFiles) {
      const filePath = path.join(DEEP_RESEARCH_DIR, file);
      const stats = await fs.stat(filePath);
      
      reportContent += `### ${file}\n`;
      reportContent += `- Size: ${stats.size} bytes\n`;
      reportContent += `- Modified: ${stats.mtime.toISOString()}\n\n`;
      
      // If it's a JSON file, parse and show summary
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);
          
          reportContent += '```json\n';
          reportContent += JSON.stringify(data, null, 2);
          reportContent += '\n```\n\n';
        } catch (error) {
          reportContent += `Error parsing JSON: ${error.message}\n\n`;
        }
      }
    }
    
    // Check for log files related to deep research
    const rootFiles = await fs.readdir('.');
    const logFiles = rootFiles.filter(file => 
      (file.endsWith('.log') && 
       (file.includes('deep-research') || 
        file.includes('perplexity')))
    );
    
    reportContent += `## Found ${logFiles.length} log files\n\n`;
    
    // Process each log file
    for (const file of logFiles) {
      try {
        const stats = await fs.stat(file);
        
        reportContent += `### ${file}\n`;
        reportContent += `- Size: ${stats.size} bytes\n`;
        reportContent += `- Modified: ${stats.mtime.toISOString()}\n\n`;
        
        const content = await fs.readFile(file, 'utf8');
        
        // Only show the latest 50 lines of log files to keep the report manageable
        const lines = content.split('\n');
        const latestLines = lines.slice(Math.max(0, lines.length - 50));
        
        reportContent += '```\n';
        reportContent += latestLines.join('\n');
        reportContent += '\n```\n\n';
      } catch (error) {
        reportContent += `Error reading log file: ${error.message}\n\n`;
      }
    }
    
    // Write the report
    await fs.writeFile(REPORT_FILE, reportContent);
    
    console.log(`Report written to ${REPORT_FILE}`);
    return REPORT_FILE;
    
  } catch (error) {
    console.error('Error collecting results:', error);
    return null;
  }
}

// Run the collection process
collectResults().then(reportFile => {
  if (reportFile) {
    console.log(`Complete! Report is available at: ${reportFile}`);
  } else {
    console.error('Failed to create report');
  }
}).catch(error => {
  console.error('Unhandled error:', error);
});