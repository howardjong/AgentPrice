/**
 * Initialize Mock Research
 * 
 * This module provides functions to populate the research system with mock questions
 * and research topics for testing purposes.
 */

import { initiateResearch } from './researchService.js';
import logger from '../utils/logger.js';

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
 * Initialize mock product research questions in the research queue
 */
async function initializeMockProductQuestions() {
  try {
    logger.info('Initializing mock product questions');
    
    const results = [];
    for (const question of MOCK_PRODUCT_QUESTIONS) {
      const result = await initiateResearch(question, {
        generateClarifyingQuestions: true,
        origin: 'mock-initialization',
        priority: 'low' // Lower priority for mock questions
      });
      
      results.push({ question, jobId: result.jobId, sessionId: result.sessionId });
      logger.info(`Enqueued mock product question`, { question: question.substring(0, 50), jobId: result.jobId });
    }
    
    return results;
  } catch (error) {
    logger.error('Error initializing mock product questions', { error: error.message });
    throw error;
  }
}

/**
 * Initialize mock research topics in the research queue
 */
async function initializeMockResearchTopics() {
  try {
    logger.info('Initializing mock research topics');
    
    const results = [];
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