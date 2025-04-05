// Deep Research Workflow Verification Script
// Tests the complete workflow from end-to-end with real API calls

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

// Import services
import perplexityService from '../../services/perplexityService.js';
import promptManager from '../../services/promptManager.js';

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const DEFAULT_QUERY = "What are current pricing strategies for premium SaaS products in 2025?";

// Configuration
const config = {
  perplexity: {
    model: 'sonar-deep-research',
    enhancedContext: true
  }
};

// Enable debugging with DEBUG=perplexity:* environment variable
const DEBUG = process.env.DEBUG || '';
const IS_DEBUG = DEBUG.includes('perplexity:');

/**
 * Save results to file
 */
async function saveResults(results, filePrefix) {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${filePrefix}-${timestamp}.json`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Save results
    await fs.writeFile(
      outputPath,
      JSON.stringify(results, null, 2)
    );

    return outputPath;

  } catch (error) {
    console.error('Error saving results:', error);
    return null;
  }
}

async function verifyDeepResearchWorkflow() {
  // Step 1: Generate a unique jobId
  const jobId = uuidv4();
  console.log(`Starting deep research workflow verification (jobId: ${jobId})`);

  // Step 2: Define a research query
  const query = process.argv[2] || "What are the latest developments in quantum computing?";
  console.log(`Research query: "${query}"`);

  try {
    // Step 3: Perform deep research
    console.log('Initiating deep research...');
    const startTime = Date.now();

    const researchResult = await perplexityService.performDeepResearch(query, jobId, {
      enableChunking: true
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Deep research completed in ${duration.toFixed(2)} seconds`);

    // Step 4: Log the results
    console.log('\n=== Research Results ===');
    console.log(`Model requested: ${researchResult.requestedModel}`);
    console.log(`Model used: ${researchResult.modelUsed}`);
    console.log(`Content length: ${researchResult.content.length} characters`);
    console.log(`Number of sources: ${researchResult.sources.length}`);

    if (IS_DEBUG) {
      console.log('\n=== Content Preview ===');
      console.log(researchResult.content.substring(0, 500) + '...');

      console.log('\n=== Sources ===');
      researchResult.sources.forEach((source, i) => {
        console.log(`${i+1}. ${source}`);
      });
    }

    // Step 5: Save the results to a file (optional)
    const outputFile = await saveResults(researchResult, 'deep-research-results');
    console.log(`\nResults saved to: ${outputFile}`);

    return {
      success: true,
      result: researchResult
    };
  } catch (error) {
    console.error(`\n❌ Deep research workflow failed: ${error.message}`);
    console.error(error.stack);

    return {
      success: false,
      error: error.message
    };
  }
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyDeepResearchWorkflow()
    .then(result => {
      console.log('\n=== Workflow Verification Complete ===');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error in verification script:', error);
      process.exit(1);
    });
}

export default verifyDeepResearchWorkflow;