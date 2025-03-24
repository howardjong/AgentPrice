/**
 * Manual test utility for mock research initialization
 * 
 * This script can be used to test the mock research initialization functionality
 * and check the status of jobs in the research queue.
 */


// Main test function
async function runMockResearchTest() {
  logger.info("===== STARTING MOCK RESEARCH INITIALIZATION TEST =====");
  
  try {
    // Verify perplexity service is configured for deep research
    logger.info("Verifying perplexity service configuration");
    const perplexityStatus = perplexityService.getStatus();
    logger.info("Perplexity status", {
      status: perplexityStatus.status,
      model: perplexityStatus.model
    });
    
    logger.info("Initializing mock research with deep research option enabled");
    const result = await initializeAllMockResearch({
      deepResearch: true  // Explicitly enable deep research
    });
    
    logger.info("Mock research initialization completed", {
      researchCount: result.researchTopics.length,
      success: result.success
    });
    
    if (result.researchTopics.length > 0) {
      const sampleResearchJob = result.researchTopics[0];
      const jobStatus = await jobManager.getJobStatus('research-jobs', sampleResearchJob.jobId);
      logger.info("Sample research topic job status", { 
        jobId: sampleResearchJob.jobId,
        topic: sampleResearchJob.topic.substring(0, 50),
        status: jobStatus.status,
        progress: jobStatus.progress
      });
    }
    
    logger.info("===== COMPLETED MOCK RESEARCH INITIALIZATION TEST =====");
  } catch (error) {
    logger.error("Error in mock research test", { error: error.message, stack: error.stack });
  } finally {
    // Don't exit process immediately so that logs can flush
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run the test when the script is executed directly
runMockResearchTest();

import { initializeAllMockResearch } from '../../services/initializeMockResearch.js';
import jobManager from '../../services/jobManager.js';
import logger from '../../utils/logger.js';
import perplexityService from '../../services/perplexityService.js';

async function testMockResearchInitialization() {
  try {
    logger.info("===== STARTING MOCK RESEARCH INITIALIZATION TEST =====");
    
    // Step 1: Initialize all mock research data
    logger.info("Initializing mock research data...");
    const result = await initializeAllMockResearch();
    logger.info("Mock research data initialized", { 
      totalJobs: result.total,
      productQuestions: result.productQuestions.length,
      researchTopics: result.researchTopics.length
    });
    
    // Step 2: Wait a bit and then check job status
    logger.info("Waiting 3 seconds to check job status...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Check queue status
    const researchQueue = jobManager.createQueue('research-jobs');
    const counts = await researchQueue.getJobCounts();
    logger.info("Research job queue status", { counts });
    
    // Step 4: Print job IDs and track one job
    logger.info("Tracking a sample job from each category...");
    
    // Product question job
    if (result.productQuestions.length > 0) {
      const sampleProductJob = result.productQuestions[0];
      const jobStatus = await jobManager.getJobStatus('research-jobs', sampleProductJob.jobId);
      logger.info("Sample product question job status", { 
        jobId: sampleProductJob.jobId,
        question: sampleProductJob.question.substring(0, 50),
        status: jobStatus.status,
        progress: jobStatus.progress
      });
    }
    
    // Research topic job
    if (result.researchTopics.length > 0) {
      const sampleResearchJob = result.researchTopics[0];
      const jobStatus = await jobManager.getJobStatus('research-jobs', sampleResearchJob.jobId);
      logger.info("Sample research topic job status", { 
        jobId: sampleResearchJob.jobId,
        topic: sampleResearchJob.topic.substring(0, 50),
        status: jobStatus.status,
        progress: jobStatus.progress
      });
    }
    
    logger.info("===== COMPLETED MOCK RESEARCH INITIALIZATION TEST =====");
  } catch (error) {
    logger.error("Error in mock research test", { error: error.message, stack: error.stack });
  } finally {
    // Don't exit process immediately so that logs can flush
    setTimeout(() => process.exit(0), 1000);
  }
}

// Execute test if this module is run directly
if (process.argv[1].includes('mockResearchTest')) {
  testMockResearchInitialization();
}

export { testMockResearchInitialization };