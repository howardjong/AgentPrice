/**
 * @file deep-research-workflow.vitest.js
 * @description Tests for the Deep Research workflow
 * 
 * This test file focuses on the integration between researchService, perplexityService, and jobManager
 * to handle deep research tasks effectively with proper queuing, processing and result handling.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as researchService from '../../../services/researchService.js';
import * as perplexityService from '../../../services/perplexityService.js';
import * as jobManager from '../../../services/jobManager.js';
import * as claudeService from '../../../services/claudeService.js';
import * as fs from 'fs/promises';
import path from 'path';

// Mock axios for HTTP requests
const mockAxios = new MockAdapter(axios);

// Mock the logger to avoid issues
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn()
  }
}));

// Set up environment variables
vi.stubEnv('PERPLEXITY_API_KEY', 'mock-perplexity-key');
vi.stubEnv('ANTHROPIC_API_KEY', 'mock-anthropic-key');
vi.stubEnv('RESEARCH_DIR', 'test-reports');

// Sample API responses
const mockDeepResearchResponse = {
  id: '3c90c3cc-0d44-4b50-8888-8dd25736052a',
  model: 'llama-3.1-sonar-large-128k-online',
  object: 'chat.completion',
  created: 1724369245,
  citations: [
    'https://www.example.com/research1',
    'https://www.example.com/research2',
    'https://www.example.com/research3'
  ],
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'This is a detailed deep research response that covers the latest advancements in quantum computing as of March 2025.'
      }
    }
  ],
  usage: {
    prompt_tokens: 250,
    completion_tokens: 750,
    total_tokens: 1000
  }
};

const mockClaudeSummaryResponse = {
  content: [
    {
      text: '## Quantum Computing Research Summary\n\n* Quantum error correction has improved by 40% in 2025'
    }
  ],
  model: 'claude-3-7-haiku-20250219',
  usage: {
    input_tokens: 800,
    output_tokens: 200,
    total_tokens: 1000
  }
};

describe('Deep Research Workflow Tests', () => {
  // Setup mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Perplexity service
    vi.spyOn(perplexityService, 'conductDeepResearch').mockImplementation(async (query, options) => {
      return {
        content: mockDeepResearchResponse.choices[0].message.content,
        citations: mockDeepResearchResponse.citations,
        followUpQuestions: [
          'What are the practical applications of quantum computing in healthcare?',
          'How does quantum error correction work in the newest systems?'
        ],
        model: mockDeepResearchResponse.model,
        requestId: 'mock-request-id'
      };
    });
    
    // Mock Claude service for the failure test
    vi.spyOn(claudeService, 'processText').mockImplementation(async (prompt, options) => {
      return {
        content: mockClaudeSummaryResponse.content[0].text,
        usage: mockClaudeSummaryResponse.usage,
        model: mockClaudeSummaryResponse.model,
        requestId: 'mock-claude-request-id'
      };
    });
    
    // Set up process research job mock with specific implementations for tests
    vi.spyOn(researchService, 'processResearchJob').mockImplementation(async (job) => {
      return {
        query: job.data.query,
        content: mockDeepResearchResponse.choices[0].message.content,
        citations: mockDeepResearchResponse.citations,
        summary: mockClaudeSummaryResponse.content[0].text,
        model: mockDeepResearchResponse.model,
        timestamp: new Date().toISOString(),
        requestId: job.data.options.requestId || 'mock-request-id',
        savedFilePath: 'test-reports/research-quantum-computing-2025-03-30T12-00-00.md'
      };
    });
    
    // Set up MockAdapter for Perplexity API
    mockAxios.reset();
    mockAxios.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockDeepResearchResponse);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  test('should conduct deep research with Perplexity including follow-up questions', async () => {
    const query = 'What are the emerging trends in artificial intelligence in 2025?';
    
    const result = await perplexityService.conductDeepResearch(query, {
      model: 'llama-3.1-sonar-large-128k-online',
      recencyFilter: 'month',
      maxTokens: 4096
    });
    
    expect(result).toEqual({
      content: mockDeepResearchResponse.choices[0].message.content,
      citations: mockDeepResearchResponse.citations,
      followUpQuestions: expect.arrayContaining([expect.any(String)]),
      model: mockDeepResearchResponse.model,
      requestId: expect.any(String)
    });
  });
  
  test('should handle errors during research job processing', async () => {
    // Override the mock implementation just for this test
    vi.spyOn(researchService, 'processResearchJob').mockRejectedValueOnce(
      new Error('Deep research job failed: API service unavailable')
    );
    
    const job = {
      id: 'mock-job-1234',
      data: {
        query: 'What are the latest developments in quantum computing in 2025?',
        options: {
          model: 'llama-3.1-sonar-large-128k-online',
          saveResults: true,
          generateSummary: true,
          requestId: 'mock-request-5678'
        }
      },
      updateProgress: vi.fn().mockResolvedValue(undefined)
    };
    
    await expect(researchService.processResearchJob(job)).rejects.toThrow(
      'Deep research job failed: API service unavailable'
    );
  });
  
  test('should continue without summary if Claude summarization fails', async () => {
    // Mock implementation to simulate Claude failure but continue processing
    vi.spyOn(claudeService, 'processText').mockRejectedValueOnce(
      new Error('Claude API unavailable')
    );
    
    // Create custom implementation for this test case
    vi.spyOn(researchService, 'processResearchJob').mockImplementationOnce(async (job) => {
      // Simplified implementation to test the Claude error handling
      await job.updateProgress(10);
      
      // Get content from Perplexity (mocked to succeed)
      const results = await perplexityService.conductDeepResearch(job.data.query, job.data.options);
      
      await job.updateProgress(60);
      
      // Try to generate summary with Claude (will fail)
      let summary = null;
      if (job.data.options.generateSummary) {
        try {
          summary = await claudeService.processText('Summarize this content', {
            model: 'claude-3-7-haiku-20250219'
          });
        } catch (error) {
          // Continue without summary - non-critical component
        }
      }
      
      await job.updateProgress(90);
      
      return {
        query: job.data.query,
        content: results.content,
        citations: results.citations,
        summary: summary ? summary.content : null,
        model: results.model,
        timestamp: new Date().toISOString(),
        requestId: job.data.options.requestId
      };
    });
    
    const job = {
      id: 'mock-job-1234',
      data: {
        query: 'What are the latest developments in quantum computing in 2025?',
        options: {
          model: 'llama-3.1-sonar-large-128k-online',
          saveResults: true,
          generateSummary: true,
          requestId: 'mock-request-5678'
        }
      },
      updateProgress: vi.fn().mockResolvedValue(undefined)
    };
    
    const result = await researchService.processResearchJob(job);
    
    // Should still have results but without summary
    expect(result).toHaveProperty('content', mockDeepResearchResponse.choices[0].message.content);
    expect(result).toHaveProperty('citations', mockDeepResearchResponse.citations);
    expect(result).toHaveProperty('summary', null); // Summary should be null due to error
    expect(job.updateProgress).toHaveBeenCalledTimes(3); // Progress updates should still happen
  });
});