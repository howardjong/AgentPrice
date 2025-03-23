
/**
 * Manual test for Perplexity research functionality
 * Tests both quick research and deep research modes
 */

import perplexityService from '../../services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

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
      
      const startTime = Date.now();

      try {
        let result;
        if (testCase.wantsDeepResearch) {
          console.log('User confirmed deep research, using sonar-deep-research model...');
          result = await perplexityService.performDeepResearch(testCase.query, jobId, {
            model: perplexityService.models.deepResearch,
            searchMode: perplexityService.searchModes.deepResearch
          });
        } else {
          console.log('Using default sonar model for quick research...');
          result = await perplexityService.performDeepResearch(testCase.query, jobId);
        }

        const duration = (Date.now() - startTime) / 1000;
        
        console.log('\nResearch completed in', duration, 'seconds');
        console.log('Model used:', result.modelUsed);
        console.log('Content length:', result.content.length);
        console.log('Number of sources:', result.sources.length);
        
        console.log('\nFirst 200 characters of content:');
        console.log(result.content.substring(0, 200) + '...');
        
        console.log('\nSources:');
        result.sources.forEach((source, i) => console.log(`${i+1}. ${source}`));

        // Verify correct model usage
        const expectedModel = testCase.wantsDeepResearch ? 
          perplexityService.models.deepResearch : 
          perplexityService.models.default;
          
        if (result.modelUsed !== expectedModel) {
          console.error(`❌ Model mismatch - Expected: ${expectedModel}, Got: ${result.modelUsed}`);
        } else {
          console.log(`✓ Correct model used: ${result.modelUsed}`);
        }

      } catch (error) {
        console.error(`Failed research for "${testCase.query}":`, error.message);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n=== Research Mode Test Completed ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testResearchModes()
    .then(() => setTimeout(() => process.exit(0), 1000))
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { testResearchModes };
