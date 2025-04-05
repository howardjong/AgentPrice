/**
 * Collect and Organize Deep Research Results
 * 
 * This script collects all deep research test results and organizes them
 * into a single markdown report for easy viewing.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'test-results', 'deep-research');
const REPORT_FILE = 'deep-research-report.md';

/**
 * Collect and organize all deep research results
 */
async function collectResults() {
  console.log('Collecting deep research results...');
  
  // Ensure directories exist
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  
  try {
    // Get all files in the results directory
    const files = await fs.readdir(RESULTS_DIR);
    
    // Group files by request ID
    const requestGroups = {};
    
    for (const file of files) {
      // Extract request ID from filename
      let requestId = 'unknown';
      
      if (file.startsWith('initial-response-')) {
        requestId = file.replace('initial-response-', '').replace('.json', '');
      } else if (file.startsWith('poll-data-')) {
        requestId = file.replace('poll-data-', '').replace('.json', '');
      } else if (file.startsWith('complete-response-')) {
        requestId = file.replace('complete-response-', '').replace('.json', '');
      } else if (file.startsWith('poll-response-')) {
        // Format: poll-response-requestId-attempt.json
        const parts = file.split('-');
        if (parts.length >= 3) {
          requestId = parts[2];
          // Handle cases where request ID contains hyphens
          if (file.includes('.json')) {
            const beforeJson = file.split('.json')[0];
            const attemptPart = beforeJson.split('-').pop();
            if (!isNaN(attemptPart)) {
              // Last part is the attempt number, reconstruct the ID
              const requestParts = beforeJson.split('-');
              requestParts.pop(); // Remove attempt number
              requestParts.shift(); // Remove 'poll'
              requestParts.shift(); // Remove 'response'
              requestId = requestParts.join('-');
            }
          }
        }
      } else if (file.startsWith('error-')) {
        requestId = file.replace('error-', '').replace('.json', '');
      } else if (file.startsWith('request-')) {
        // Format: request-requestId-timestamp-intermediate.json
        const parts = file.split('-');
        if (parts.length >= 2) {
          requestId = parts[1];
        }
      }
      
      // Add to request group
      if (requestId !== 'unknown') {
        if (!requestGroups[requestId]) {
          requestGroups[requestId] = [];
        }
        requestGroups[requestId].push(file);
      }
    }
    
    // Generate report
    let report = '# Deep Research Test Results\n\n';
    report += `Generated on ${new Date().toISOString()}\n\n`;
    report += `Total requests found: ${Object.keys(requestGroups).length}\n\n`;
    
    // Process each request
    for (const [requestId, files] of Object.entries(requestGroups)) {
      report += `## Request: ${requestId}\n\n`;
      
      // Check for completed response
      const completeFiles = files.filter(f => f.startsWith('complete-response-'));
      const isComplete = completeFiles.length > 0;
      
      report += `Status: ${isComplete ? '✅ Complete' : '⏳ In Progress'}\n\n`;
      
      // Get initial query if available
      const pollDataFiles = files.filter(f => f.startsWith('poll-data-'));
      if (pollDataFiles.length > 0) {
        try {
          const pollDataPath = path.join(RESULTS_DIR, pollDataFiles[0]);
          const pollData = JSON.parse(await fs.readFile(pollDataPath, 'utf8'));
          
          if (pollData.query) {
            report += `**Query**: ${pollData.query}\n\n`;
          }
          
          if (pollData.timestamp) {
            report += `**Started**: ${pollData.timestamp}\n\n`;
          }
        } catch (error) {
          console.error(`Error processing poll data: ${error.message}`);
        }
      }
      
      // Count poll responses
      const pollResponseFiles = files.filter(f => f.startsWith('poll-response-'));
      report += `**Poll responses**: ${pollResponseFiles.length}\n\n`;
      
      // If complete, extract and show content
      if (isComplete) {
        try {
          const completePath = path.join(RESULTS_DIR, completeFiles[0]);
          const completeData = JSON.parse(await fs.readFile(completePath, 'utf8'));
          
          // Extract model info
          let modelInfo = 'unknown';
          if (completeData.model) {
            modelInfo = completeData.model;
          } else if (completeData.completion && completeData.completion.model) {
            modelInfo = completeData.completion.model;
          }
          
          report += `**Model**: ${modelInfo}\n\n`;
          
          // Extract content
          let content = '';
          if (completeData.choices && completeData.choices[0] && completeData.choices[0].message) {
            content = completeData.choices[0].message.content;
          } else if (completeData.completion && completeData.completion.text) {
            content = completeData.completion.text;
          }
          
          if (content) {
            report += `### Response Content\n\n`;
            report += `${content}\n\n`;
          }
          
          // Extract citations if available
          if (completeData.completion && completeData.completion.links) {
            report += `### Citations\n\n`;
            for (const link of completeData.completion.links) {
              report += `- [${link.title || 'Link'}](${link.url})\n`;
            }
            report += '\n';
          }
          
        } catch (error) {
          console.error(`Error processing complete response: ${error.message}`);
          report += `Error extracting content: ${error.message}\n\n`;
        }
      } else {
        report += `*Research still in progress or incomplete*\n\n`;
      }
      
      // List all files for reference
      report += `### Files\n\n`;
      for (const file of files) {
        report += `- \`${file}\`\n`;
      }
      report += '\n---\n\n';
    }
    
    // Write report
    await fs.writeFile(REPORT_FILE, report);
    console.log(`Report generated: ${REPORT_FILE}`);
    
  } catch (error) {
    console.error(`Error collecting results: ${error.message}`);
  }
}

// Run collection
collectResults();