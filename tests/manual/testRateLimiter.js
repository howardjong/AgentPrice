
/**
 * Test the Perplexity rate limiter
 */
import perplexityRateLimiter from '../../utils/rateLimiter.js';
import logger from '../../utils/logger.js';

// Configure logger to output to console
logger.configure({
  level: 'info',
  format: 'simple',
  console: true
});

async function testRateLimiter() {
  console.log('Testing Perplexity Rate Limiter');
  console.log('-------------------------------');
  
  // Create 10 test requests
  const requests = Array(10).fill().map((_, i) => ({
    id: i + 1,
    task: async () => {
      console.log(`Executing request ${i + 1}`);
      // Simulate API request time
      await new Promise(resolve => setTimeout(resolve, 500));
      return `Result for request ${i + 1}`;
    }
  }));
  
  console.log(`Scheduling ${requests.length} requests with rate limiter`);
  console.log('Initial status:', perplexityRateLimiter.getStatus());
  
  // Execute all requests through the rate limiter
  const startTime = Date.now();
  
  const results = await Promise.all(
    requests.map(request => 
      perplexityRateLimiter.schedule(async () => {
        const startTime = Date.now();
        const result = await request.task();
        const endTime = Date.now();
        
        return {
          id: request.id,
          result,
          executionTime: endTime - startTime,
          totalElapsedTime: endTime - startTime
        };
      })
    )
  );
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  console.log('\nResults:');
  results.forEach((result, i) => {
    console.log(`Request ${result.id}: Completed in ${result.executionTime}ms`);
  });
  
  console.log(`\nTotal execution time: ${totalTime}ms`);
  console.log('Final status:', perplexityRateLimiter.getStatus());
  
  // Calculate average time between requests
  let timeBetweenRequests = [];
  for (let i = 1; i < results.length; i++) {
    timeBetweenRequests.push(results[i].totalElapsedTime - results[i-1].totalElapsedTime);
  }
  
  const avgTimeBetweenRequests = timeBetweenRequests.reduce((sum, time) => sum + time, 0) / timeBetweenRequests.length;
  console.log(`Average time between requests: ${avgTimeBetweenRequests}ms`);
  
  console.log('\nTest completed');
}

// Run the test
testRateLimiter().catch(console.error);
