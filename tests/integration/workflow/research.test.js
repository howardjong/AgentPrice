
import { jest } from '@jest/globals';
import { initiateResearch, getResearchStatus, answerWithContext } from '../../../services/researchService.js';
import jobManager from '../../../services/jobManager.js';
import contextManager from '../../../services/contextManager.js';
import logger from '../../../utils/logger.js';

jest.mock('../../../services/jobManager.js');
jest.mock('../../../services/contextManager.js');
jest.mock('../../../utils/logger.js');

describe('Research Workflow Integration', () => {
  jest.setTimeout(30000);

  beforeAll(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    jobManager.getJobStatus.mockResolvedValue({
      status: 'completed',
      progress: 100,
      returnvalue: {
        content: 'Test research results',
        sources: ['source1', 'source2']
      }
    });

    contextManager.getContext.mockResolvedValue({
      jobId: 'test-job',
      originalQuery: 'test query'
    });
    
    jobManager.enqueueJob.mockResolvedValue('test-job-id');
  });

  it('should complete a full research workflow', async () => {
    const query = 'What are the latest developments in quantum computing?';
    
    const { jobId, sessionId } = await initiateResearch(query);
    expect(jobId).toBeTruthy();
    expect(sessionId).toBeTruthy();

    const status = await getResearchStatus(jobId);
    expect(status.status).toBe('completed');
    expect(status.progress).toBe(100);
    expect(status.returnvalue.content).toBe('Test research results');
    expect(status.returnvalue.sources).toEqual(['source1', 'source2']);

    const followUpResponse = await answerWithContext(sessionId, 'Tell me more about that');
    expect(followUpResponse).toEqual({
      query: 'Tell me more about that',
      response: expect.any(String),
      sources: expect.any(Array)
    });
  });
});
