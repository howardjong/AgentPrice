import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import perplexityService from '../../services/perplexityService.js';

// Helper functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRateLimitRecoveryTest() {
  try {
    console.log("\n===== RATE LIMIT RECOVERY TEST =====");

    // Reset circuit breaker state
    perplexityService.circuitBreaker.reset('POST:https://api.perplexity.ai/chat/completions');
    console.log("✅ Circuit breaker reset for Perplexity API");

    // Force high rate limit test - send 6 requests in rapid succession
    // Perplexity typically limits to 5 requests per minute
    console.log("\nSending 6 requests rapidly to trigger rate limit...");

    const testJobs = Array(6).fill(0).map((_, i) => ({
      jobId: uuidv4(),
      query: `What are the latest trends in ${['finance', 'marketing', 'technology', 'healthcare', 'education', 'retail'][i]} industry in 2025?`
    }));

    const startTime = Date.now();

    // Run jobs sequentially to clearly see the rate limit behavior
    for (let i = 0; i < testJobs.length; i++) {
      const job = testJobs[i];
      console.log(`\nStarting job ${i+1}: ${job.jobId}`);
      const jobStartTime = Date.now();

      try {
        // Wait for the job to complete or fail
        const result = await perplexityService.performDeepResearch(job.query, job.jobId);
        const duration = (Date.now() - jobStartTime) / 1000;

        console.log(`✅ Job ${i+1} completed in ${duration.toFixed(1)} seconds`);
        console.log(`   Model requested: ${result.requestedModel}`);
        console.log(`   Model used: ${result.modelUsed}`);
        console.log(`   Citations: ${result.sources.length}`);

        if (result.requestedModel !== result.modelUsed) {
          console.log(`   ✅ FALLBACK SUCCESS: Used ${result.modelUsed} instead of ${result.requestedModel}`);
        }

      } catch (error) {
        const duration = (Date.now() - jobStartTime) / 1000;
        console.log(`❌ Job ${i+1} failed after ${duration.toFixed(1)} seconds`);
        console.log(`   Error: ${error.message}`);

        // If we got a 429 error that didn't trigger fallback, log more details
        if (error.message.includes('429')) {
          console.log(`   Rate limited detected. Circuit breaker status:`);
          const status = perplexityService.circuitBreaker.getCircuitStatus('POST:https://api.perplexity.ai/chat/completions');
          console.log(`   - Rate limited: ${status.rateLimited}`);
          console.log(`   - Reset time: ${status.rateLimitResetTime}`);
        }
      }

      // Brief pause between jobs (not enough to avoid rate limits)
      if (i < testJobs.length - 1) {
        await delay(1000);
      }
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`\n===== TEST COMPLETED in ${totalDuration.toFixed(1)} seconds =====`);

    // Show circuit breaker status
    console.log("\nFinal circuit breaker status:");
    const status = perplexityService.circuitBreaker.getCircuitStatus('POST:https://api.perplexity.ai/chat/completions');
    console.log(JSON.stringify(status, null, 2));

  } catch (error) {
    console.error("Error in rate limit recovery test:", error);
  } finally {
    // Ensure the process exits
    await delay(1000);
    process.exit(0);
  }
}

runRateLimitRecoveryTest();