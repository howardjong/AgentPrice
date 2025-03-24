
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import perplexityService from '../../services/perplexityService.js';

// Helper functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMockResearchTest() {
  try {
    logger.info("===== STARTING MOCK RESEARCH TEST =====");
    
    // Clear any existing rate limit state
    perplexityService.circuitBreaker.reset('POST:https://api.perplexity.ai/chat/completions');
    logger.info("Circuit breaker reset for Perplexity API");
    
    // Create multiple mock research jobs to test rate limiting
    const testJobs = [
      {
        jobId: uuidv4(),
        query: "What are the latest trends in pricing strategy optimization for SaaS products?"
      },
      {
        jobId: uuidv4(),
        query: "How can customer segmentation improve profitability for B2B companies?"
      },
      {
        jobId: uuidv4(),
        query: "What are the most effective product discovery frameworks in 2025?"
      },
      {
        jobId: uuidv4(),
        query: "How is AI being used to improve customer experience in 2025?"
      }
    ];
    
    logger.info(`Created ${testJobs.length} mock research jobs`);
    
    // Run the jobs in parallel to trigger rate limits
    const results = await Promise.allSettled(testJobs.map(async (job, index) => {
      logger.info(`Starting job ${index + 1}: ${job.jobId}`);
      const startTime = Date.now();
      
      try {
        const result = await perplexityService.performDeepResearch(job.query, job.jobId);
        const duration = (Date.now() - startTime) / 1000;
        
        logger.info(`Job ${job.jobId} completed in ${duration.toFixed(1)} seconds with ${result.sources.length} citations`);
        return {
          jobId: job.jobId,
          status: 'completed',
          duration,
          citationsCount: result.sources.length,
          modelRequested: result.requestedModel,
          modelUsed: result.modelUsed
        };
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        logger.error(`Job ${job.jobId} failed after ${duration.toFixed(1)} seconds: ${error.message}`);
        return {
          jobId: job.jobId,
          status: 'failed',
          duration,
          error: error.message
        };
      }
    }));
    
    // Log summary of results
    logger.info("===== TEST RESULTS SUMMARY =====");
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const jobResult = result.value;
        console.log(`Job ${index + 1}: Status=${jobResult.status}, Duration=${jobResult.duration.toFixed(1)}s, Citations=${jobResult.citationsCount}, Model=${jobResult.modelUsed}`);
      } else {
        console.log(`Job ${index + 1}: FAILED - ${result.reason}`);
      }
    });
    
    // Check for rate limit recovery
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const fallbackCount = results.filter(r => r.status === 'fulfilled' && r.value.modelUsed !== r.value.modelRequested).length;
    
    console.log("\n===== RATE LIMIT HANDLING SUMMARY =====");
    console.log(`Total jobs: ${results.length}`);
    console.log(`Successful completions: ${successCount}`);
    console.log(`Failed jobs: ${results.length - successCount}`);
    console.log(`Jobs using fallback models: ${fallbackCount}`);
    
    if (fallbackCount > 0) {
      console.log("✅ Rate limit fallback mechanism worked correctly");
    }
    
    logger.info("===== COMPLETED MOCK RESEARCH TEST =====");
    
  } catch (error) {
    logger.error("Error in mock research test", { error: error.message, stack: error.stack });
  } finally {
    // Ensure the process exits after a short delay to allow logs to flush
    console.log("Test completed, exiting in 2 seconds...");
    await delay(2000);
    process.exit(0);
  }
}

// Auto-run if this script is executed directly
runMockResearchTest();
