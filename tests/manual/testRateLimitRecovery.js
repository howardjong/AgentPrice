
/**
 * Rate Limit Recovery Test
 * 
 * This script tests how the system recovers from rate limits by:
 * 1. Making multiple requests in quick succession to trigger rate limits
 * 2. Monitoring how the circuit breaker and retry mechanisms handle the rate limits
 * 3. Verifying successful recovery after waiting
 */

import perplexityService from '../../services/perplexityService.js';
import logger from '../../utils/logger.js';
import { CircuitBreaker } from '../../utils/monitoring.js';

// Configure logging
logger.level = 'debug';

// Test parameters
const TEST_QUERIES = [
  "What are the latest developments in artificial intelligence?",
  "Explain the concept of quantum computing",
  "What is the current state of climate change?",
  "How do electric vehicles impact the environment?",
  "What advances have been made in renewable energy?"
];

// Helper to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testRateLimitRecovery() {
  console.log("=== Rate Limit Recovery Test ===");
  
  // Verify Perplexity is initialized
  const status = perplexityService.getStatus();
  console.log("Perplexity service status:", status);
  
  if (!status.status === 'connected') {
    console.error("Perplexity service is not connected. Please check API key.");
    process.exit(1);
  }
  
  // Reset circuit breaker
  const circuitBreaker = new CircuitBreaker();
  circuitBreaker.reset('perplexity-deep');
  circuitBreaker.reset('POST:https://api.perplexity.ai/chat/completions');
  
  console.log("\nPhase 1: Triggering rate limits with multiple requests");
  
  // Track successful and failed requests
  const results = {
    success: 0,
    rateLimited: 0,
    otherErrors: 0,
    models: {}
  };
  
  // Make multiple requests in quick succession to trigger rate limits
  const requests = TEST_QUERIES.map(async (query, index) => {
    try {
      console.log(`Starting request ${index + 1}: "${query.substring(0, 30)}..."`);
      
      const start = Date.now();
      
      // Only use deep research for even-indexed queries
      const options = index % 2 === 0 ? { deepResearch: true } : {};
      
      const result = await perplexityService.performResearch([
        { role: 'user', content: query }
      ], options);
      
      const duration = Date.now() - start;
      results.success++;
      
      // Track model usage
      const model = result.modelUsed || 'unknown';
      results.models[model] = (results.models[model] || 0) + 1;
      
      console.log(`✅ Request ${index + 1} succeeded in ${duration}ms. Model: ${model}`);
      
    } catch (error) {
      const isRateLimit = error.message.includes('429') || 
                         error.message.includes('rate limit') || 
                         error.message.toLowerCase().includes('too many requests');
      
      if (isRateLimit) {
        results.rateLimited++;
        console.log(`⚠️ Request ${index + 1} rate limited: ${error.message}`);
      } else {
        results.otherErrors++;
        console.error(`❌ Request ${index + 1} failed: ${error.message}`);
      }
    }
  });
  
  await Promise.all(requests);
  
  console.log("\nPhase 1 Results:");
  console.log("- Successful requests:", results.success);
  console.log("- Rate limited requests:", results.rateLimited);
  console.log("- Other errors:", results.otherErrors);
  console.log("- Models used:", results.models);
  
  // Check circuit breaker status
  console.log("\nCircuit Breaker Status After Phase 1:");
  circuitBreaker.logCircuitStatus();
  
  if (results.rateLimited > 0) {
    console.log("\nRate limits detected! Testing recovery...");
    
    console.log("\nPhase 2: Wait for rate limit to reset (60-65 seconds)");
    console.log("Waiting 65 seconds before trying again...");
    await delay(65000);
    
    console.log("\nPhase 3: Testing recovery after waiting");
    
    // Try a single request after waiting
    try {
      const recoveryQuery = "What is the latest news in technology?";
      console.log(`Making recovery request: "${recoveryQuery}"`);
      
      const start = Date.now();
      const result = await perplexityService.performResearch([
        { role: 'user', content: recoveryQuery }
      ]);
      
      const duration = Date.now() - start;
      console.log(`✅ Recovery request succeeded in ${duration}ms. Model: ${result.modelUsed || 'unknown'}`);
      console.log("System has recovered from rate limiting!");
    } catch (error) {
      console.error(`❌ Recovery request failed: ${error.message}`);
      console.log("System has NOT recovered from rate limiting!");
    }
  } else {
    console.log("\nNo rate limits detected. Either the system is handling them well or the test didn't generate enough load.");
  }
  
  // Check circuit breaker status after recovery
  console.log("\nCircuit Breaker Status After Recovery:");
  circuitBreaker.logCircuitStatus();
  
  console.log("\nTest completed!");
  circuitBreaker.stop();
}

// Run the test
testRateLimitRecovery()
  .catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
  });
