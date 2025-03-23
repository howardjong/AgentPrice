/**
 * Manual test for Perplexity research functionality
 * Tests both quick research and deep research modes
 * Respects rate limit of 5 requests per minute for sonar-deep-research
 */

import perplexityService from '../../services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

// Rate limit configuration
const REQUESTS_PER_MINUTE = 5;
const MINUTE_IN_MS = 60 * 1000;
const DELAY_BETWEEN_REQUESTS = Math.ceil(MINUTE_IN_MS / REQUESTS_PER_MINUTE);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testDeepResearch() {
  try {
    console.log('=== Starting Deep Research Model Verification Test ===\n');

    const testCases = [
      {
        query: 'What are the latest developments in quantum computing in 2025?',
        wantsDeepResearch: true
      },
      {
        query: 'Analyze the current state of renewable energy adoption globally',
        wantsDeepResearch: false
      },
      {
        query: 'What are the emerging trends in artificial intelligence and machine learning?',
        wantsDeepResearch: true
      }
    ];

    for (const testCase of testCases) {
      const jobId = uuidv4();
      console.log('\nTesting query:', testCase.query);
      console.log('Job ID:', jobId);
      console.log('Expects deep research:', testCase.wantsDeepResearch);

      const startTime = Date.now();

      try {
        const results = await perplexityService.performDeepResearch(testCase.query, jobId);
        const duration = Date.now() - startTime;

        console.log(`\nResearch completed in ${(duration / 1000).toFixed(3)} seconds`);
        console.log('Model verification:');
        console.log(`- Requested model: ${results.requestedModel}`);
        console.log(`- Actually used model: ${results.modelUsed}`);
        console.log(`- Model match: ${results.requestedModel === results.modelUsed ? '✓' : '❌'}`);
        console.log(`Content length: ${results.content.length}`);
        console.log(`Number of sources: ${results.sources.length}\n`);

        if (results.requestedModel !== results.modelUsed) {
          console.error('WARNING: Model mismatch detected!');
          console.error(`Expected ${results.requestedModel} but got ${results.modelUsed}`);
        }

        // Add delay between requests to respect rate limit
        if (testCase.wantsDeepResearch) {
          console.log(`\nWaiting ${DELAY_BETWEEN_REQUESTS}ms before next request to respect rate limit...`);
          await delay(DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        console.error(`Error in test:`, error.message);
      }
    }

    console.log('\n=== Deep Research Model Verification Test Completed ===\n');

  } catch (error) {
    console.error('Test script error:', error);
    process.exit(1);
  }
}


async function testResearchModes() {
  try {
    console.log('=== Testing Perplexity Research Modes ===');
    
    // Check API key and service status
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('ERROR: PERPLEXITY_API_KEY is not set!');
      return;
    }
    
    const status = perplexityService.getStatus();
    console.log('Service status:', status);
    
    if (!status.status === 'connected') {
      console.error('ERROR: Perplexity service is not connected!');
      return;
    }

    // Test queries
    const testCases = [
      {
        query: 'What are the latest developments in quantum computing?',
        wantsDeepResearch: false
      },
      {
        query: 'What are the latest developments in quantum computing?',
        wantsDeepResearch: true
      }
    ];

    for (const testCase of testCases) {
      const jobId = uuidv4();
      const mode = testCase.wantsDeepResearch ? 'Deep Research' : 'Quick Research';
      
      console.log(`\n=== Testing ${mode} Mode ===`);
      console.log(`Query: "${testCase.query}"`);
      console.log('Job ID:', jobId);

      if (testCase.wantsDeepResearch) {
        console.log('User confirmed deep research, using sonar-deep-research model...');
      } else {
        console.log('Using default sonar model for quick research...');
      }
      
      const startTime = Date.now();
      
      try {
        const results = await perplexityService.performDeepResearch(testCase.query, jobId);
        const duration = Date.now() - startTime;
        
        console.log(`\nResearch completed in ${(duration / 1000).toFixed(3)} seconds`);
        console.log(`Model used: ${results.modelUsed}`);
        console.log(`Content length: ${results.content.length}`);
        console.log(`Number of sources: ${results.sources.length}\n`);
        
        // Show first 200 chars of content
        console.log('First 200 characters of content:');
        console.log(results.content.substring(0, 200) + '...\n');
        
        // Show sources
        console.log('Sources:');
        results.sources.forEach((source, i) => {
          console.log(`${i + 1}. ${source}`);
        });

        // Validate correct model usage
        const expectedModel = testCase.wantsDeepResearch ? 'sonar-deep-research' : 'sonar';
        if (results.modelUsed === expectedModel) {
          console.log(`✓ Correct model used: ${results.modelUsed}`);
        } else {
          console.log(`❌ Model mismatch - Expected: ${expectedModel}, Got: ${results.modelUsed}`);
        }

        // Add delay between requests to respect rate limit
        if (testCase.wantsDeepResearch) {
          console.log(`\nWaiting ${DELAY_BETWEEN_REQUESTS}ms before next request to respect rate limit...`);
          await delay(DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        console.error(`Error in ${mode} test:`, error.message);
      }
    }

    console.log('\n=== Research Mode Test Completed ===\n');
    
  } catch (error) {
    console.error('Test script error:', error);
    process.exit(1);
  }
}

// Run test when executed directly
if (process.argv[1] === import.meta.url) {
  Promise.all([testResearchModes(), testDeepResearch()]).then(()=>process.exit(0)).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testResearchModes, testDeepResearch };