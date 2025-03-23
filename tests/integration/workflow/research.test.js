
import { jest } from '@jest/globals';
import { initiateResearch, getResearchStatus } from '../../../services/researchService.js';

describe('Research Workflow Integration', () => {
  jest.setTimeout(30000); // Increase timeout for integration tests

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
