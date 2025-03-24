
/**
 * Debug script to display the latest Perplexity deep research response
 */
import fs from 'fs';
import path from 'path';

// Read the latest response from logs
try {
  // Try to read from combined log file first
  const logData = fs.readFileSync('combined.log', 'utf8');
  
  // Find the most recent deep research content
  const contentMatches = logData.match(/Deep research completed successfully.*?contentLength":(\d+)/g);
  
  if (contentMatches && contentMatches.length > 0) {
    const latestMatch = contentMatches[contentMatches.length - 1];
    const contentLengthMatch = latestMatch.match(/contentLength":(\d+)/);
    const contentLength = contentLengthMatch ? contentLengthMatch[1] : 'unknown';
    
    // Get the job ID from the log
    const jobIdMatch = latestMatch.match(/jobId":"([^"]+)"/);
    const jobId = jobIdMatch ? jobIdMatch[1] : 'unknown';
    
    console.log('========================');
    console.log(`Found latest deep research response (Job ID: ${jobId})`);
    console.log(`Content length: ${contentLength} characters`);
    console.log('========================\n');
    
    // Search for the model data
    const modelMatch = logData.match(new RegExp(`modelUsed":"([^"]+)".*?${jobId}`));
    if (modelMatch) {
      console.log(`Model used: ${modelMatch[1]}\n`);
    }
    
    // Look for the actual content
    // This is challenging since the logs don't contain the full content
    console.log('To see the full content, run the test deep research workflow again:');
    console.log('Note: The response will be visible in the terminal when the test runs');
  } else {
    console.log('No deep research responses found in logs');
  }
} catch (error) {
  console.error('Error reading logs:', error.message);
}

console.log('\nRunning deep research query now:');

// Display instructions
console.log(`
To run the deep research test and see full content:

1. Use the "Test Deep Research Query" workflow 
2. Check the console output for the complete response

Alternatively, run this command:
node tests/reset-circuit-breaker.js perplexity
node tests/manual/testDeepResearch.js "what does the competitor landscape look like for all day elementary school children camps in spring and summer break in the greater Vancouver area?"
`);
