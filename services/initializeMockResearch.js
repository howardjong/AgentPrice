/**
 * Initialize Mock Research
 * 
 * This module provides functions to populate the research system with mock questions
 * and research topics for testing purposes.
 */

import { initiateResearch } from './researchService.js';
import mockJobManager from './mockJobManager.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

// Flag to indicate if we're using direct mock approach
const USE_DIRECT_MOCK = process.env.NODE_ENV === 'development' || process.env.REDIS_MODE === 'memory';

// Mock product questions for business research
const MOCK_PRODUCT_QUESTIONS = [
  "Tell us about your product or service. (With a brief example and 3-5 sentence guideline)",
  "Who are your target customers and what problem are you solving for them?",
  "What existing solutions or alternatives do customers currently use, and at what price points? (Provide a simple table template)",
  "What pricing model are you considering and what's your rough price range? (Multiple choice for model + simple input for range)",
  "What are 3-5 key features or benefits of your solution that might influence what customers would pay?"
];

// Mock research topics for deep research processing
const MOCK_RESEARCH_TOPICS = [
  "I need comprehensive research on pricing for full-day camps (9am-3pm) for elementary school children in Greater Vancouver, BC, Canada, including suburbs. This research will inform pricing decisions for a new business entering this market."
];

/**
 * Initialize mock product research questions directly in the mock job manager
 */
async function initializeMockProductQuestions() {
  try {
    logger.info('Initializing mock product questions');
    
    const results = [];
    
    if (USE_DIRECT_MOCK) {
      // Direct mock approach that doesn't rely on the Redis-based job queue
      for (const question of MOCK_PRODUCT_QUESTIONS) {
        const jobId = uuidv4();
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // Add job directly to mock job manager
        await mockJobManager.enqueueJob('research-jobs', {
          query: question,
          options: {
            generateClarifyingQuestions: true,
            origin: 'mock-initialization',
            priority: 'low'
          },
          sessionId
        }, { jobId });
        
        results.push({ question, jobId, sessionId });
        logger.info(`Directly enqueued mock product question`, { question: question.substring(0, 50), jobId });
      }
    } else {
      // Standard approach using initiateResearch which will use the job system
      for (const question of MOCK_PRODUCT_QUESTIONS) {
        const result = await initiateResearch(question, {
          generateClarifyingQuestions: true,
          origin: 'mock-initialization',
          priority: 'low' // Lower priority for mock questions
        });
        
        results.push({ question, jobId: result.jobId, sessionId: result.sessionId });
        logger.info(`Enqueued mock product question`, { question: question.substring(0, 50), jobId: result.jobId });
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error initializing mock product questions', { error: error.message });
    throw error;
  }
}

/**
 * Initialize mock research topics in the mock job manager
 */
async function initializeMockResearchTopics() {
  try {
    logger.info('Initializing mock research topics');
    
    const results = [];
    
    if (USE_DIRECT_MOCK) {
      // Direct mock approach that doesn't rely on the Redis-based job queue
      for (const topic of MOCK_RESEARCH_TOPICS) {
        const jobId = uuidv4();
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // Add job directly to mock job manager
        await mockJobManager.enqueueJob('research-jobs', {
          query: topic,
          options: {
            generateClarifyingQuestions: true,
            generateCharts: ['bar', 'pie'],
            origin: 'mock-initialization',
            priority: 'low'
          },
          sessionId
        }, { jobId });
        
        results.push({ topic, jobId, sessionId });
        logger.info(`Directly enqueued mock research topic`, { topic: topic.substring(0, 50), jobId });
      }
    } else {
      // Standard approach
      for (const topic of MOCK_RESEARCH_TOPICS) {
        const result = await initiateResearch(topic, {
          generateClarifyingQuestions: true,
          generateCharts: ['bar', 'pie'],
          origin: 'mock-initialization',
          priority: 'low' // Lower priority for mock research
        });
        
        results.push({ topic, jobId: result.jobId, sessionId: result.sessionId });
        logger.info(`Enqueued mock research topic`, { topic: topic.substring(0, 50), jobId: result.jobId });
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error initializing mock research topics', { error: error.message });
    throw error;
  }
}

/**
 * Initialize all mock research data
 */
async function initializeAllMockResearch() {
  try {
    logger.info('Initializing all mock research data');
    
    const productQuestions = await initializeMockProductQuestions();
    const researchTopics = await initializeMockResearchTopics();
    
    return {
      productQuestions,
      researchTopics,
      total: productQuestions.length + researchTopics.length
    };
  } catch (error) {
    logger.error('Error initializing all mock research', { error: error.message });
    throw error;
  }
}

export {
  initializeMockProductQuestions,
  initializeMockResearchTopics,
  initializeAllMockResearch
};