/**
 * Test Deep Research Job Workflow
 * 
 * This script tests the complete workflow for deep research using Perplexity API
 * with the job manager system. It tests:
 * 
 * 1. Job creation and queuing
 * 2. Research processing with the deep research model
 * 3. Polling for job completion
 * 4. Result retrieval and processing
 * 
 * It's designed to work with real APIs while leveraging our existing infrastructure.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// For dynamic imports to avoid commonjs/esm issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Constants
const OUTPUT_DIR = 'test-results/deep-research-workflow';
const TEST_QUERY = 'What strategies should startups use to price their SaaS products in 2025?';
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60;  // 5 minutes total

// Helper for logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Check API key
function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    log('⚠️ PERPLEXITY_API_KEY environment variable is not set');
    process.exit(1);
  }
  log('✅ Perplexity API key is available');
}

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    log('Initializing services...');
    
    // Import required services (dynamically to handle ESM/CommonJS differences)
    const researchService = await import('./services/researchService.js');
    const jobManager = await import('./services/jobManager.js');
    
    // Initialize the research service
    await researchService.initialize();
    
    log('Services initialized successfully');
    return { researchService, jobManager };
  } catch (error) {
    log(`Error initializing services: ${error.message}`);
    throw error;
  }
}

/**
 * Poll for job completion
 */
async function pollJobStatus(jobManager, jobId, maxAttempts = MAX_POLL_ATTEMPTS, interval = POLL_INTERVAL_MS) {
  log(`Starting to poll for job ${jobId} status...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const status = await jobManager.getJobStatus(jobId);
      
      log(`Poll ${attempt + 1}/${maxAttempts}: Job status=${status.status}, progress=${status.progress}%`);
      
      if (status.status === 'completed') {
        log(`Job ${jobId} completed successfully!`);
        return { completed: true, result: status.result };
      } else if (status.status === 'failed') {
        log(`Job ${jobId} failed: ${status.error}`);
        throw new Error(`Job failed: ${status.error}`);
      }
      
      // Job is still in progress, wait and try again
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      log(`Error polling job status: ${error.message}`);
      
      // If the error is related to job not found, throw immediately
      if (error.message.includes('not found')) {
        throw error;
      }
      
      // For other errors, just continue polling
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error(`Job polling timed out after ${maxAttempts} attempts`);
}

/**
 * Save test results to a file
 */
async function saveResults(results, options = {}) {
  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Format filename
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `deep-research-results-${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    // Save results
    await fs.writeFile(filepath, JSON.stringify({
      timestamp,
      query: options.query || TEST_QUERY,
      options,
      results
    }, null, 2));
    
    log(`Results saved to ${filepath}`);
    return filepath;
  } catch (error) {
    log(`Error saving results: ${error.message}`);
    throw error;
  }
}

/**
 * Main test function
 */
async function runTest() {
  log('=== Starting Deep Research Job Workflow Test ===');
  
  try {
    // Check API key
    checkApiKey();
    
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Initialize services
    const { researchService, jobManager } = await initializeServices();
    
    // Generate a unique request ID for tracing
    const requestId = uuidv4();
    log(`Request ID: ${requestId}`);
    
    // Start a research job
    log(`Starting research job for query: "${TEST_QUERY}"`);
    
    const jobInfo = await researchService.startResearchJob(TEST_QUERY, {
      model: 'sonar-deep-research',
      systemPrompt: 'You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources when possible.',
      saveResults: true,
      requestId,
      recencyFilter: 'year',
      domainFilter: [],
      maxTokens: 4000,
      temperature: 0.2
    });
    
    // Log job information
    log(`Job created successfully. Job ID: ${jobInfo.jobId}`);
    log(`Estimated processing time: ${jobInfo.estimatedTime}`);
    
    // Poll for job completion
    log('Polling for job completion...');
    const pollResult = await pollJobStatus(jobManager, jobInfo.jobId);
    
    // Process results
    if (pollResult.completed) {
      const results = pollResult.result;
      
      // Log summary
      log('\n=== Deep Research Results ===');
      log(`Query: ${TEST_QUERY}`);
      log(`Model: ${results.model}`);
      log(`Content Length: ${results.content.length} characters`);
      log(`Citations: ${results.citations.length}`);
      
      // Preview content
      log('\nContent Preview:');
      log('--------------------------------------');
      log(results.content.substring(0, 500) + '...');
      log('--------------------------------------');
      
      // Save results
      await saveResults(results, {
        query: TEST_QUERY,
        requestId,
        jobId: jobInfo.jobId
      });
      
      log('=== Deep Research Job Workflow Test Completed Successfully ===');
      return { success: true, results };
    } else {
      throw new Error('Job did not complete successfully');
    }
    
  } catch (error) {
    log(`Error in test: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    return { success: false, error: error.message };
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});