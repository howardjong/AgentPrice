/**
 * Test for the research workflow
 * 
 * This script tests the research workflow by starting a job and polling for its completion
 */
import * as researchService from './services/researchService.js';
import * as jobManager from './services/jobManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize the services
async function initializeServices() {
  console.log('Initializing services...');
  await researchService.initialize();
  // Note: jobManager is automatically initialized when imported and used
}

// Poll for job status
async function pollJobStatus(jobId, maxAttempts = 10, interval = 5000) {
  console.log(`Polling for job status (jobId: ${jobId})...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const status = await researchService.getResearchStatus(jobId);
      console.log(`Job status (attempt ${attempt + 1}): ${status.status}, progress: ${status.progress || 0}%`);
      
      if (status.status === 'completed') {
        console.log('Job completed successfully!');
        return status.result;
      }
      
      if (status.status === 'failed') {
        console.error('Job failed:', status.error);
        return null;
      }
      
      // Wait before next polling attempt
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.error(`Error polling job status: ${error.message}`);
    }
  }
  
  console.log('Polling timeout reached. The job may still be running.');
  return null;
}

// Save results to a file
async function saveResults(results, filename) {
  try {
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Results saved to ${outputPath}`);
  } catch (error) {
    console.error(`Error saving results: ${error.message}`);
  }
}

// Run the test
async function runTest() {
  try {
    await initializeServices();
    
    // Check for API key
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY is not set. Please set it in the .env file or environment.');
      process.exit(1);
    }
    
    // Start a research job
    const query = 'What are the latest advancements in renewable energy in 2024?';
    const jobInfo = await researchService.startResearchJob(query, {
      model: 'sonar-deep-research', // Use the deep research model
      recencyFilter: 'month',
      saveResults: true
    });
    
    console.log('Research job started:', jobInfo);
    
    // Poll for job completion
    const results = await pollJobStatus(jobInfo.jobId, 12, 10000); // Poll for up to 2 minutes
    
    if (results) {
      console.log('Research completed. Content snippet:');
      console.log(results.content.substring(0, 300) + '...');
      console.log(`Citations: ${results.citations.length}`);
      
      // Save the results
      await saveResults(results, `research-results-${new Date().toISOString()}.json`);
    }
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Clean up
    await jobManager.close();
    process.exit(0);
  }
}

// Run the test
runTest();