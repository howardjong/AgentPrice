
import { jest } from '@jest/globals';
import { initiateResearch, getResearchStatus, answerWithContext } from '../../../services/researchService.js';
import jobManager from '../../../services/jobManager.js';
import logger from '../../../utils/logger.js';

jest.mock('../../../services/jobManager.js');
jest.mock('../../../utils/logger.js');

describe('Research Workflow Integration', () => {
  jest.setTimeout(30000); // Increase timeout for integration tests
  
  beforeAll(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    // Mock job status response
    jobManager.getJobStatus = jest.fn().mockResolvedValue({
      status: 'completed',
      progress: 100,
      returnvalue: {
        content: 'Test research results',
        sources: ['source1', 'source2']
      }
    });
    
    // Mock job creation
    jobManager.enqueueJob = jest.fn().mockResolvedValue('test-job-id');
  });

  it('should complete a full research workflow', async () => {
    const query = 'What are the latest developments in quantum computing?';
    
    // Initialize research
    const { jobId, sessionId } = await initiateResearch(query);
    expect(jobId).toBeTruthy();
    expect(sessionId).toBeTruthy();

    // Poll for completion
    let status;
    let attempts = 0;
    const maxAttempts = 10;

    expect(status.returnvalue.content).toBe('Test research results');
    expect(status.returnvalue.sources).toEqual(['source1', 'source2']);

    // Test follow-up question
    const followUpResponse = await answerWithContext(sessionId, 'Tell me more about that');
    expect(followUpResponse).toHaveProperty('response');
    expect(followUpResponse).toHaveProperty('sources');

    while (attempts < maxAttempts) {
      status = await getResearchStatus(jobId);
      if (status.status === 'completed') break;
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    expect(status.status).toBe('completed');
    expect(status.progress).toBe(100);
  });
});
