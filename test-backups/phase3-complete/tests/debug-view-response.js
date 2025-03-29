
/**
 * Debug script to display the complete Perplexity deep research response
 */
import fs from 'fs';
import perplexityService from '../services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';

const QUERY = "what does the competitor landscape look like for all day elementary school children camps in spring and summer break in the greater Vancouver area?";

async function displayResponse() {
  try {
    console.log('=== Perplexity Deep Research Response Viewer ===');
    console.log('\nRunning query and capturing complete response...');
    console.log(`Query: "${QUERY}"`);
    
    const jobId = uuidv4();
    console.log(`Job ID: ${jobId}`);
    
    // Capture start time
    const startTime = Date.now();
    
    // Run the deep research query
    const result = await perplexityService.performDeepResearch(QUERY, jobId);
    
    // Calculate duration
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n======= RESEARCH RESULTS =======');
    console.log(`Duration: ${duration.toFixed(1)} seconds`);
    console.log(`Model used: ${result.modelUsed}`);
    console.log(`Content length: ${result.content.length} characters`);
    console.log(`Sources: ${result.sources.length} citations`);
    console.log('\n======= FULL RESPONSE TEXT =======\n');
    console.log(result.content);
    
    console.log('\n======= CITATIONS =======\n');
    result.sources.forEach((source, index) => {
      console.log(`[${index + 1}] ${source}`);
    });

    // Also save to file for easier viewing
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `perplexity-response-${timestamp}.txt`;
    
    let fullOutput = `PERPLEXITY DEEP RESEARCH RESPONSE\n`;
    fullOutput += `Query: ${QUERY}\n`;
    fullOutput += `Timestamp: ${timestamp}\n`;
    fullOutput += `Model: ${result.modelUsed}\n`;
    fullOutput += `Duration: ${duration.toFixed(1)} seconds\n\n`;
    fullOutput += `===== RESPONSE TEXT =====\n\n`;
    fullOutput += result.content;
    fullOutput += `\n\n===== CITATIONS (${result.sources.length}) =====\n\n`;
    
    result.sources.forEach((source, index) => {
      fullOutput += `[${index + 1}] ${source}\n`;
    });
    
    fs.writeFileSync(filename, fullOutput);
    console.log(`\nFull response saved to ${filename}`);
  } catch (error) {
    console.error('Error running deep research query:', error.message);
  }
}

// Run the function if this script is executed directly
if (process.argv[1].endsWith('debug-view-response.js')) {
  displayResponse().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
