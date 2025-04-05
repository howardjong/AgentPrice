
// Deep Research Workflow Verification Test
// This tests the entire workflow from end-to-end with real API calls

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as perplexityService from '../../services/perplexityService.js';
import logger from '../../utils/logger.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating output directory:', error);
  }
}

async function verifyDeepResearchWorkflow() {
  console.log('=== Starting Deep Research Workflow Verification ===\n');
  
  // Step 1: Initialize and ensure output directory exists
  await ensureOutputDir();
  
  // Create unique test ID
  const testId = uuidv4();
  console.log(`Test ID: ${testId}`);
  
  try {
    // Step 2: Call Perplexity API with deep research model
    console.log('\n--- STEP 1: Calling Perplexity Deep Research API ---');
    const query = "What are the latest pricing strategies for SaaS products in 2025?";
    console.log(`Query: "${query}"`);
    
    const startTime = Date.now();
    
    const researchResults = await perplexityService.performDeepResearch(query, testId);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Research completed in ${duration} seconds`);
    console.log(`Model used: ${researchResults.modelUsed}`);
    console.log(`Content length: ${researchResults.content.length} characters`);
    console.log(`Number of sources: ${researchResults.sources.length}`);
    
    // Step 3: Save the results
    console.log('\n--- STEP 2: Saving Research Results ---');
    const resultsFilename = `deep-research-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const resultsPath = path.join(OUTPUT_DIR, resultsFilename);
    
    await fs.writeFile(
      resultsPath, 
      JSON.stringify({
        query,
        results: researchResults,
        metadata: {
          testId,
          timestamp: new Date().toISOString(),
          duration: `${duration} seconds`
        }
      }, null, 2)
    );
    
    console.log(`✅ Results saved to ${resultsPath}`);
    
    // Step 4: Display a summary of the first 300 characters
    console.log('\n--- STEP 3: Research Content Preview ---');
    console.log(researchResults.content.substring(0, 300) + '...\n');
    
    // Step 5: Display sources
    console.log('--- STEP 4: Research Sources ---');
    researchResults.sources.slice(0, 5).forEach((source, i) => {
      console.log(`${i + 1}. ${source}`);
    });
    
    if (researchResults.sources.length > 5) {
      console.log(`...and ${researchResults.sources.length - 5} more sources`);
    }

    console.log('\n=== Deep Research Workflow Verification Complete ===');
    console.log(`\nVerification Summary:`);
    console.log(`✅ Deep Research API Call: Success (${duration}s)`);
    console.log(`✅ Content Generation: ${researchResults.content.length > 1000 ? 'Success' : 'Warning: Short content'}`);
    console.log(`✅ Citations: ${researchResults.sources.length > 0 ? 'Success' : 'Warning: No sources'}`);
    console.log(`✅ Results Saved: Success (${resultsFilename})`);
    
    return {
      success: true,
      results: researchResults,
      duration
    };
    
  } catch (error) {
    console.error('\n❌ ERROR: Deep research workflow verification failed:');
    console.error(error);
    
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// Run the test if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyDeepResearchWorkflow().catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
}

export default verifyDeepResearchWorkflow;
