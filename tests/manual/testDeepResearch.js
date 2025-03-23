
/**
 * Manual test for Perplexity deep research functionality
 */

import perplexityService from '../../services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

async function testDeepResearch() {
  try {
    console.log('=== Testing Perplexity Deep Research ===');
    
    // Verify service status
    const status = perplexityService.getStatus();
    console.log('Service status:', status);
    
    if (!status.status === 'connected') {
      throw new Error('Perplexity service is not connected');
    }
    
    // Test queries
    const testQueries = [
      'What are the latest developments in quantum computing in 2025?',
      'Analyze the current state of renewable energy adoption globally',
      'What are the emerging trends in artificial intelligence and machine learning?'
    ];
    
    for (const query of testQueries) {
      const jobId = uuidv4();
      console.log(`\nTesting deep research with query: "${query}"`);
      console.log('Job ID:', jobId);
      
      const startTime = Date.now();
      
      try {
        const result = await perplexityService.performDeepResearch(query, jobId);
        const duration = Date.now() - startTime;
        
        console.log('\nResearch completed in', duration/1000, 'seconds');
        console.log('Model used:', result.modelUsed);
        console.log('Content length:', result.content.length);
        console.log('Number of sources:', result.sources.length);
        console.log('\nFirst 200 characters of content:');
        console.log(result.content.substring(0, 200) + '...');
        console.log('\nSources:');
        result.sources.forEach((source, i) => console.log(`${i+1}. ${source}`));
      } catch (error) {
        console.error(`Failed research for "${query}":`, error.message);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n=== Deep Research Test Completed ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDeepResearch()
    .then(() => setTimeout(() => process.exit(0), 1000))
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { testDeepResearch };
