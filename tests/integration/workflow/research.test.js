
import { jest } from '@jest/globals';
import { JobManager } from '../../../services/jobManager.js';
import { ResearchService } from '../../../services/researchService.js';

describe('Research Workflow Integration', () => {
  let jobManager;
  let researchService;

  beforeEach(() => {
    jobManager = new JobManager();
    researchService = new ResearchService();
  });

  test('complete research workflow', async () => {
    const query = 'Test research query';
    const job = await jobManager.createJob('research-jobs', {
      query,
      options: {
        generateClarifyingQuestions: true
      }
    });

    const result = await job.finished();
    
    expect(result).toMatchObject({
      query,
      content: expect.any(String),
      sources: expect.any(Array),
      clarifyingQuestions: expect.any(Array),
      timestamp: expect.any(String)
    });
  });
});
