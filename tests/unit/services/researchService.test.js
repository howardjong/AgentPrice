
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { AnthropicService } from '../../../services/anthropicService.js';
import { PerplexityService } from '../../../services/perplexityService.js';
import { ContextManager } from '../../../services/contextManager.js';
import { JobManager } from '../../../services/jobManager.js';
import { logger } from '../../../utils/logger.js';

jest.mock('../../../services/anthropicService.js');
jest.mock('../../../services/perplexityService.js');
jest.mock('../../../services/contextManager.js');
jest.mock('../../../services/jobManager.js');
jest.mock('../../../utils/logger.js');

describe('ResearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registers job processors on initialization', async () => {
    expect(JobManager.registerProcessor).toHaveBeenCalledWith(
      'research-jobs',
      expect.any(Function)
    );
  });

  test('processes research job successfully', async () => {
    const mockJob = {
      id: uuidv4(),
      data: {
        query: 'test query',
        options: {
          generateClarifyingQuestions: true,
          generateCharts: ['bar']
        }
      },
      progress: jest.fn()
    };

    const mockClarifyingQuestions = ['Question 1', 'Question 2'];
    AnthropicService.generateClarifyingQuestions.mockResolvedValue(mockClarifyingQuestions);

    const mockResearchResults = {
      content: 'Research results',
      sources: ['source1', 'source2']
    };
    PerplexityService.performDeepResearch.mockResolvedValue(mockResearchResults);

    const mockChartData = { data: [1, 2, 3] };
    AnthropicService.generateChartData.mockResolvedValue(mockChartData);

    await expect(jobProcessor(mockJob)).resolves.toEqual({
      query: mockJob.data.query,
      content: mockResearchResults.content,
      sources: mockResearchResults.sources,
      clarifyingQuestions: mockClarifyingQuestions,
      charts: { bar: mockChartData },
      timestamp: expect.any(String)
    });
  });
});
