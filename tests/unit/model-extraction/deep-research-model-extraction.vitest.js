/**
 * Deep Research Model Extraction Tests
 * 
 * Tests the model extraction functionality specifically in deep research mode.
 * 
 * This test verifies that:
 * 1. The deep research mode properly identifies and reports model information
 * 2. Model information is correctly included in deep research response content
 * 3. Sources are properly extracted from deep research responses
 * 4. The system handles different deep research scenarios appropriately
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import nock from 'nock';
import axios from 'axios';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    configure: vi.fn()
  }
}));

vi.mock('../../../utils/costTracker.js', () => ({
  trackAPIUsage: vi.fn()
}));

// Mock CircuitBreaker
vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    default: function() {
      return {
        execute: (fn) => fn(),
        getState: () => 'closed'
      };
    }
  };
});

// Mock RobustAPIClient
vi.mock('../../../utils/apiClient.js', () => {
  return {
    default: function() {
      return {
        execute: (fn) => fn()
      };
    }
  };
});

// Import perplexity service functions
import { 
  conductDeepResearch,
  SONAR_MODELS
} from '../../../services/perplexityService.js';

// Sample deep research responses
const createDeepResearchResponse = (model = 'llama-3.1-sonar-small-128k-online', withSources = true) => ({
  id: `perp-${uuidv4()}`,
  model,
  created: Date.now(),
  citations: withSources ? [
    'https://example.com/research1',
    'https://example.com/research2',
    'https://example.com/research3'
  ] : [],
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Technology advances in 2025 include quantum computing breakthroughs with 500-qubit stability, new AR neural interfaces, and solid-state batteries with 800Wh/kg energy density.'
      }
    }
  ]
});

// Sample follow-up questions response
const createFollowUpQuestionsResponse = (model = 'llama-3.1-sonar-small-128k-online') => ({
  id: `perp-followup-${uuidv4()}`,
  model,
  created: Date.now(),
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: '1. How has quantum computing impacted cryptography in 2025?\n2. What are the main applications of the new AR neural interfaces?\n3. How have solid-state batteries changed the electric vehicle market?'
      }
    }
  ]
});

// Sample follow-up research response
const createFollowUpResearchResponse = (model = 'llama-3.1-sonar-small-128k-online', withSources = true) => ({
  id: `perp-followup-research-${uuidv4()}`,
  model,
  created: Date.now(),
  citations: withSources ? [
    'https://example.com/research4',
    'https://example.com/research5'
  ] : [],
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Quantum computing in 2025 has made encryption more secure with post-quantum algorithms standardized by NIST, while also enabling breakthroughs in materials science and drug discovery.'
      }
    }
  ]
});

// Sample synthesis response
const createSynthesisResponse = (model = 'llama-3.1-sonar-large-128k-online', withSources = true) => ({
  id: `perp-synthesis-${uuidv4()}`,
  model,
  created: Date.now(),
  citations: withSources ? [
    'https://example.com/research1',
    'https://example.com/research2',
    'https://example.com/research3',
    'https://example.com/research4',
    'https://example.com/research5'
  ] : [],
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Comprehensive analysis of 2025 technology advancements, including quantum computing breakthroughs, AR neural interfaces, and solid-state battery developments.'
      }
    }
  ]
});

describe('Deep Research Model Extraction', () => {
  // Setup before each test
  beforeEach(() => {
    // Reset nock
    nock.cleanAll();
    
    // Mock environment variables
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
  });
  
  it('should extract model information from deep research response', async () => {
    // Need to set up multiple API responses for the stages of deep research
    
    // Initial research query
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createDeepResearchResponse());
    
    // Follow-up questions generation
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpQuestionsResponse());
    
    // Follow-up research 1
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse());
    
    // Follow-up research 2
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse());
    
    // Final synthesis
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createSynthesisResponse());
    
    // Perform deep research request
    const result = await conductDeepResearch(
      'Summarize the most important technology advances from 2025 so far.'
    );
    
    // Verify model information is returned
    expect(result.model).toBe('llama-3.1-sonar-large-128k-online');
    
    // Verify content
    expect(result.content).toBe('Comprehensive analysis of 2025 technology advancements, including quantum computing breakthroughs, AR neural interfaces, and solid-state battery developments.');
    
    // Verify sources/citations
    expect(result.citations).toBeInstanceOf(Array);
    expect(result.citations.length).toBeGreaterThan(0);
    
    // Verify follow-up questions were generated
    expect(result.followUpQuestions).toBeInstanceOf(Array);
    expect(result.followUpQuestions.length).toBeGreaterThan(0);
  });
  
  it('should handle deep research with alternative model', async () => {
    // Set up with an alternative model for all stages
    const alternativeModel = 'llama-3.1-sonar-huge-128k-online';
    
    // Initial research query
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createDeepResearchResponse(alternativeModel));
    
    // Follow-up questions generation
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpQuestionsResponse(alternativeModel));
    
    // Follow-up research 1
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse(alternativeModel));
    
    // Follow-up research 2
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse(alternativeModel));
    
    // Final synthesis
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createSynthesisResponse(alternativeModel));
    
    // Perform deep research with specified model
    const result = await conductDeepResearch(
      'Summarize the most important technology advances from 2025 so far.',
      { model: alternativeModel }
    );
    
    // Verify model extraction for the specified model
    expect(result.model).toBe(alternativeModel);
  });
  
  it('should handle deep research without sources', async () => {
    // Create responses without sources
    
    // Initial research query
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createDeepResearchResponse('llama-3.1-sonar-small-128k-online', false));
    
    // Follow-up questions generation
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpQuestionsResponse());
    
    // Follow-up research 1
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse('llama-3.1-sonar-small-128k-online', false));
    
    // Follow-up research 2
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse('llama-3.1-sonar-small-128k-online', false));
    
    // Final synthesis
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createSynthesisResponse('llama-3.1-sonar-large-128k-online', false));
    
    // Perform deep research request
    const result = await conductDeepResearch(
      'Summarize the most important technology advances from 2025 so far.'
    );
    
    // Verify empty citations array
    expect(result.citations).toBeInstanceOf(Array);
    expect(result.citations.length).toBe(0);
  });
  
  it('should handle API errors during deep research', async () => {
    // Intercept with error response for the initial research
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(500, { error: 'Internal Server Error' });
    
    // Expect the request to be rejected
    await expect(
      conductDeepResearch(
        'Summarize the most important technology advances from 2025 so far.'
      )
    ).rejects.toThrow();
  });
  
  it('should handle rate limit errors during deep research', async () => {
    // Intercept with rate limit response
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(429, { error: 'Too Many Requests' }, { 'Retry-After': '60' });
    
    // Expect the request to be rejected with rate limit error
    await expect(
      conductDeepResearch(
        'Summarize the most important technology advances from 2025 so far.'
      )
    ).rejects.toThrow(/perplexity|web query|rate limit|too many requests/i);
  });
  
  it('should include model info in deep research with follow-up query', async () => {
    // Set up the entire deep research process for the initial query
    
    // Initial research query
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createDeepResearchResponse());
    
    // Follow-up questions generation
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpQuestionsResponse());
    
    // Follow-up research 1
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse());
    
    // Follow-up research 2
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse());
    
    // Final synthesis for initial query
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createSynthesisResponse('llama-3.1-sonar-large-128k-online'));
    
    // Perform initial deep research
    const initialResult = await conductDeepResearch(
      'What are the key technology advances in quantum computing from 2025?'
    );
    
    // Now set up a follow-up deep research with a different model
    
    // Clean nock and set up for a new deep research process
    nock.cleanAll();
    
    // Initial research query for follow-up
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createDeepResearchResponse('llama-3.1-sonar-huge-128k-online'));
    
    // Follow-up questions for follow-up
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpQuestionsResponse('llama-3.1-sonar-huge-128k-online'));
    
    // Follow-up research 1 for follow-up
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse('llama-3.1-sonar-huge-128k-online'));
    
    // Follow-up research 2 for follow-up
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createFollowUpResearchResponse('llama-3.1-sonar-huge-128k-online'));
    
    // Final synthesis for follow-up
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createSynthesisResponse('llama-3.1-sonar-huge-128k-online'));
    
    // Perform a new deep research query as follow-up
    const followUpResult = await conductDeepResearch(
      'Provide more details about the quantum computing advances mentioned.',
      { model: 'llama-3.1-sonar-huge-128k-online' }
    );
    
    // Verify model extraction for follow-up
    expect(followUpResult.model).toBe('llama-3.1-sonar-huge-128k-online');
  });
});