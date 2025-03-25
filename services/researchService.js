import { v4 as uuidv4 } from 'uuid';
import claudeService from './claudeService.js';
import perplexityService from './perplexityService.js';
import contextManager from './contextManager.js';
import realJobManager from './jobManager.js';
import mockJobManager from './mockJobManager.js';
import logger from '../utils/logger.js';

// Debug environment variables
logger.info('Environment variables debug:', {
  USE_MOCK_JOB_MANAGER: process.env.USE_MOCK_JOB_MANAGER,
  REDIS_MODE: process.env.REDIS_MODE,
  NODE_ENV: process.env.NODE_ENV
});

// Force use of mock job manager for now
const useMockJobManager = true; // process.env.USE_MOCK_JOB_MANAGER === 'true' || process.env.REDIS_MODE === 'memory';
const jobManager = useMockJobManager ? mockJobManager : realJobManager;

logger.info(`Using ${useMockJobManager ? 'mock' : 'real'} job manager`);

// Register job processors
function registerJobProcessors() {
  // Register deep research processor
  jobManager.registerProcessor('research-jobs', async (job) => {
    const { query, options = {} } = job.data;
    const MAX_RESEARCH_TIME = 300000; // 5 minutes max for deep research

    try {
      job.progress(10);
      logger.info(`Starting deep research for job ${job.id}`, { jobId: job.id });

      // Step 1: Generate clarifying questions if enabled
      let clarifyingQuestions = [];
      if (options.generateClarifyingQuestions !== false) {
        try {
          clarifyingQuestions = await claudeService.generateClarifyingQuestions(query);
          job.progress(20);
        } catch (clarifyingError) {
          logger.error(`Error generating clarifying questions for job ${job.id}`, { 
            jobId: job.id, 
            error: clarifyingError.message 
          });
          // Continue even if this step fails
          job.progress(20);
        }
      }

      // Step 2: Perform deep research using Perplexity with timeout
      logger.info(`Performing deep research for job ${job.id}`, { jobId: job.id });
      job.progress(30);
      
      // Add a timeout wrapper around the deep research call
      const researchPromise = perplexityService.performDeepResearch(query, {
        ...options,
        jobId: job.id
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Deep research query timed out after ${MAX_RESEARCH_TIME/1000} seconds. The request to Perplexity API took too long to complete.`));
        }, MAX_RESEARCH_TIME);
      });
      
      // Race the research against the timeout
      const researchResults = await Promise.race([researchPromise, timeoutPromise]);
      job.progress(70);

      // Step 3: Generate any requested chart data
      const charts = {};
      if (options.generateCharts && Array.isArray(options.generateCharts) && options.generateCharts.length > 0) {
        logger.info(`Generating ${options.generateCharts.length} charts for job ${job.id}`, { jobId: job.id });

        let chartProgress = 70;
        const progressPerChart = 20 / options.generateCharts.length;

        // Process each requested chart type
        for (const chartType of options.generateCharts) {
          try {
            logger.info(`Generating chart data for ${chartType}`, { jobId: job.id });
            const chartData = await claudeService.generateChartData(
              researchResults.content,
              chartType
            );
            charts[chartType] = chartData;
          } catch (chartError) {
            logger.error(`Failed to generate ${chartType} chart`, { 
              jobId: job.id, 
              error: chartError.message 
            });
            charts[chartType] = { error: chartError.message };
          }

          chartProgress += progressPerChart;
          job.progress(Math.min(90, chartProgress));
        }
      }

      // Format and return the final results
      const result = {
        query,
        content: researchResults.content,
        sources: researchResults.sources || [],
        clarifyingQuestions,
        charts,
        timestamp: new Date().toISOString()
      };

      job.progress(100);
      return result;
    } catch (error) {
      logger.error(`Research job ${job.id} failed`, { error: error.message });
      throw error;
    }
  });
}

// Initialize processors on module load
registerJobProcessors();

// Service methods
async function initiateResearch(query, options = {}) {
  try {
    // Generate a unique job ID and session ID
    const jobId = uuidv4();
    const sessionId = options.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    logger.info('Initiating research', { query, jobId, sessionId });

    // Store initial context
    await contextManager.storeContext(sessionId, {
      originalQuery: query,
      jobId,
      options,
      history: [],
      createdAt: new Date().toISOString()
    });

    // Queue the research job
    await jobManager.enqueueJob('research-jobs', {
      query,
      options,
      sessionId
    });

    return { jobId, sessionId, status: 'PENDING' };
  } catch (error) {
    logger.error('Error initiating research', { query, error: error.message });
    throw error;
  }
}

async function getResearchStatus(jobId) {
  try {
    const status = await jobManager.getJobStatus('research-jobs', jobId);
    return status;
  } catch (error) {
    logger.error('Error getting research status', { jobId, error: error.message });
    throw error;
  }
}

async function answerWithContext(sessionId, query, answers = {}) {
  try {
    // Get the context for this session
    const context = await contextManager.getContext(sessionId);

    if (!context) {
      throw new Error('Research session not found');
    }

    // Get job results if they exist
    let jobResults = null;
    if (context.jobId) {
      const job = await jobManager.getJobStatus('research-jobs', context.jobId);
      if (job && job.status === 'completed') {
        jobResults = job.returnvalue;
      }
    }

    if (!jobResults) {
      throw new Error('Research results not found or research not complete');
    }

    // Prepare context from research results and additional answers
    const promptContext = prepareContext(jobResults, answers);

    // Generate tailored response using Claude
    const response = await claudeService.generateResponse(query, promptContext);

    // Update session context with this interaction
    await contextManager.updateContext(sessionId, (ctx) => {
      if (!ctx.history) ctx.history = [];

      ctx.history.push({
        query,
        answer: response,
        answers,
        timestamp: new Date().toISOString()
      });

      return ctx;
    });

    return {
      query,
      response,
      sources: jobResults.sources
    };
  } catch (error) {
    logger.error('Error generating response with context', { 
      sessionId, 
      query, 
      error: error.message 
    });
    throw error;
  }
}

// Helper functions
function prepareContext(results, answers) {
  let context = results.content;

  // Add user answers to context
  if (Object.keys(answers).length > 0) {
    context += '\n\nAdditional context provided by the user:\n';

    for (const [question, answer] of Object.entries(answers)) {
      context += `Question: ${question}\nAnswer: ${answer}\n\n`;
    }
  }

  return context;
}

export {
  initiateResearch,
  getResearchStatus,
  answerWithContext
};