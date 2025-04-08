/**
 * Test Improved Deep Research Functionality
 * 
 * This test verifies the Perplexity deep research functionality with proper model fallback
 * from sonar-deep-research to sonar-pro if needed.
 */

import dotenv from 'dotenv';
import perplexityService from '../../services/perplexityService.js';
import logger from '../../utils/logger.js';
import { promises as fs } from 'fs';
import path from 'path';
import { createInterface } from 'readline';

dotenv.config();

// Configure test
const TEST_QUERY = process.argv[2] || 
  "What are the latest developments in AI alignment research and how are leading AI labs addressing safety concerns?";

const OUTPUT_DIR = path.join('test-results', 'deep-research-tests');

// Make sure the output directory exists
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
  }
}

// Main test function
async function runDeepResearchTest() {
  const testId = Date.now().toString().substring(6);
  console.log(`\n======================================`);
  console.log(`IMPROVED DEEP RESEARCH TEST #${testId}`);
  console.log(`======================================\n`);

  console.log(`Query: "${TEST_QUERY.substring(0, 100)}${TEST_QUERY.length > 100 ? '...' : ''}"\n`);

  try {
    console.log(`Testing performDeepResearch with sonar-deep-research (fallback to sonar-pro)...`);

    // Setup thinking indication
    let thinkingInterval;
    let thinkingContent = '';
    let dots = 0;

    const startThinkingIndicator = () => {
      thinkingInterval = setInterval(() => {
        process.stdout.write(`\r🤔 Thinking${'.'.repeat(dots % 4)}   `);
        dots++;
      }, 1000);
    };

    const stopThinkingIndicator = () => {
      if (thinkingInterval) {
        clearInterval(thinkingInterval);
        process.stdout.write('\r                    \r'); // Clear the thinking line
      }
    };

    const thinkContentWatcher = (content) => {
      if (content && content !== thinkingContent) {
        stopThinkingIndicator();
        thinkingContent = content;
        console.log('\n📝 Model thinking process:');
        console.log('-------------------------------------------');
        console.log(content);
        console.log('-------------------------------------------');
        startThinkingIndicator();
      }
    };


    const startTime = Date.now();
    const result = await perplexityService.performDeepResearch(TEST_QUERY, {
      model: 'sonar-deep-research',
      fallbackModels: ['sonar-pro', 'sonar'],
      requestId: `test-${testId}`,
      saveResult: true,
      onThinking: thinkContentWatcher
    });

    stopThinkingIndicator();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Deep research completed in ${duration} seconds`);
    console.log(`Model used: ${result.modelUsed || 'unknown'}`);

    if (result.fallbackUsed) {
      console.log(`⚠️ Fallback was used: ${result.fallbackReason}`);
      console.log(`Model attempts: ${result.modelAttempts.join(' -> ')}`);
    }

    console.log(`\nContent length: ${result.content?.length || 0} characters`);
    console.log(`Citations: ${result.citations?.length || 0}`);

    // Save successful result
    const outputFile = path.join(OUTPUT_DIR, `deep-research-result-${testId}.json`);
    await fs.writeFile(outputFile, JSON.stringify({
      query: TEST_QUERY,
      result,
      testInfo: {
        timestamp: new Date().toISOString(),
        duration: `${duration} seconds`,
        modelUsed: result.modelUsed,
        fallbackUsed: result.fallbackUsed || false,
        thinkingProcess: thinkingContent
      }
    }, null, 2));

    console.log(`\nSaved result to ${outputFile}`);

    // Print first 500 characters of content
    if (result.content) {
      console.log(`\nContent preview:\n${'-'.repeat(40)}\n${result.content.substring(0, 500)}...\n${'-'.repeat(40)}`);
    }

    // Print citations if available
    if (result.citations && result.citations.length > 0) {
      console.log(`\nCitations preview:`);
      result.citations.slice(0, 3).forEach((citation, index) => {
        console.log(`[${index + 1}] ${citation.title || 'Untitled'}: ${citation.url || 'No URL'}`);
      });
      if (result.citations.length > 3) {
        console.log(`...and ${result.citations.length - 3} more citations`);
      }
    }

  } catch (error) {
    stopThinkingIndicator();
    console.error(`\n❌ Error testing deep research:`);
    console.error(`Error message: ${error.message}`);

    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }

    // Save error information
    const errorFile = path.join(OUTPUT_DIR, `deep-research-error-${testId}.json`);
    await fs.writeFile(errorFile, JSON.stringify({
      query: TEST_QUERY,
      error: {
        message: error.message,
        type: error.type || 'unknown',
        model: error.model || 'unknown',
        stack: error.stack?.split('\n').slice(0, 10).join('\n'),
        timestamp: new Date().toISOString()
      }
    }, null, 2));

    console.error(`\nSaved error details to ${errorFile}`);
  } finally {
    console.log(`\n======================================`);
    console.log(`TEST COMPLETED`);
    console.log(`======================================\n`);
  }
}

// Run the test
async function main() {
  await ensureOutputDir();
  await runDeepResearchTest();

  // Give time for logs to flush
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

main().catch(error => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});