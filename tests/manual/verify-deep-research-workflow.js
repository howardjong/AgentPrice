import * as perplexityService from '../../services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes timeout for deep research
const TEST_QUERY = "What are the latest innovations in quantum computing?";

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function verifyDeepResearchWorkflow() {
  console.log('=== Starting Deep Research Workflow Verification ===');
  console.log(`Test query: "${TEST_QUERY}"`);

  const jobId = uuidv4();
  console.log('Job ID:', jobId);
  console.log('Starting timestamp:', new Date().toISOString());

  try {
    console.log('\n=== Step 1: Initializing Deep Research with Perplexity ===');
    const startTime = Date.now();

    // Request deep research (will use polling mechanism)
    console.log('Requesting deep research...');
    const researchResults = await perplexityService.performDeepResearch(TEST_QUERY, jobId);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Research completed in ${duration} seconds`);

    // Verify the model used
    console.log('\n=== Verification Results ===');
    console.log(`Model requested: sonar-deep-research`);
    console.log(`Model actually used: ${researchResults.modelUsed || 'unknown'}`);
    console.log(`Model match: ${(researchResults.modelUsed === 'sonar-deep-research') ? '✓' : '❌'}`);

    // Verify research content
    console.log(`\nResearch content length: ${researchResults.content.length} characters`);
    console.log(`Number of sources: ${researchResults.sources?.length || 0}`);

    // Display a preview of the content
    console.log('\n=== Content Preview ===');
    console.log(researchResults.content.substring(0, 500) + '...');

    // Save the results to a file
    const outputPath = path.join(OUTPUT_DIR, `deep-research-results-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(researchResults, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);

    console.log('\n=== Deep Research Workflow Verification Completed Successfully ===');
    return { success: true, results: researchResults };

  } catch (error) {
    console.error('\n❌ Deep Research Workflow Verification Failed');
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    return { success: false, error: error.message };
  }
}

// Execute the verification flow
verifyDeepResearchWorkflow().then(result => {
  if (!result.success) {
    process.exit(1);
  }
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error in verification script:', error);
  process.exit(1);
});

export default verifyDeepResearchWorkflow;