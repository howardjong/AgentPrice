/**
 * Perplexity Model Extraction Tests
 * 
 * Tests the model extraction functionality in the Perplexity service.
 * 
 * This test verifies that:
 * 1. The perplexity service properly identifies and reports model information
 * 2. Model information is correctly included in response content
 * 3. Both standard and deep research modes correctly extract model information
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
    default: function CircuitBreaker() {
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
    default: function RobustAPIClient() {
      return {
        execute: (fn) => fn()
      };
    }
  };
});

// Import perplexity service functions
import { 
  processWebQuery,
  conductDeepResearch
} from '../../../services/perplexityService.js';

// Mock API responses
const mockStandardResponse = {
  id: 'perp-12345',
  model: 'llama-3.1-sonar-small-128k-online',
  created: Date.now(),
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Today is March 30, 2025.'
      }
    }
  ]
};

const mockDeepResearchResponse = {
  id: 'perp-67890',
  model: 'llama-3.1-sonar-small-128k-online',
  created: Date.now(),
  citations: [
    'https://example.com/article1',
    'https://example.com/article2'
  ],
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'The most important technology advances in 2025 so far include quantum computing breakthroughs, advanced AR/VR integration, and new battery technologies.'
      }
    }
  ]
};

describe('Perplexity Model Extraction', () => {
  // Setup before each test
  beforeEach(() => {
    // Reset nock
    nock.cleanAll();
    
    // Mock environment variables
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Intercept Perplexity API calls
    nock('https://api.perplexity.ai')
      .persist()
      .post('/chat/completions')
      .reply(200, mockStandardResponse);
  });
  
  it('should extract model information from standard web query response', async () => {
    // Using processWebQuery since it doesn't have the message alternation requirement
    const response = await processWebQuery(
      'What is the current date today? Please be brief.'
    );
    
    // Verify model information is extracted
    expect(response.model).toBe('llama-3.1-sonar-small-128k-online');
    expect(response.content).toBe('Today is March 30, 2025.');
  });
  
  it('should handle API responses without model information', async () => {
    // Intercept with response missing model info
    nock.cleanAll();
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, {
        id: 'perp-no-model',
        created: Date.now(),
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response without model info'
            }
          }
        ]
      });
    
    // Using processWebQuery to avoid message validation issues
    const response = await processWebQuery(
      'What is the current date today?'
    );
    
    // Even without explicit model info in the response, service should handle it
    expect(response.model).toBeUndefined(); // Model might be undefined or use a default
    expect(response.content).toBe('Response without model info');
  });
  
  it('should extract model and citation information from deep research response', async () => {
    // Set up multiple mock responses for the deep research flow
    nock.cleanAll();
    
    // Initial research query
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, mockDeepResearchResponse);
    
    // Follow-up questions generation
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, {
        id: 'perp-followup',
        model: 'llama-3.1-sonar-small-128k-online',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '1. What are the key applications of quantum computing in 2025?\n2. How has AR/VR integration changed consumer behavior?'
            }
          }
        ]
      });
    
    // Follow-up research 1
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, {
        id: 'perp-followup-1',
        model: 'llama-3.1-sonar-small-128k-online',
        citations: ['https://example.com/quantum-apps'],
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Quantum computing applications in 2025 include cryptography and drug discovery.'
            }
          }
        ]
      });
    
    // Follow-up research 2
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, {
        id: 'perp-followup-2',
        model: 'llama-3.1-sonar-small-128k-online',
        citations: ['https://example.com/ar-vr-trends'],
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'AR/VR has transformed retail and education sectors with immersive experiences.'
            }
          }
        ]
      });
    
    // Final synthesis
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, {
        id: 'perp-synthesis',
        model: 'llama-3.1-sonar-large-128k-online',
        citations: [
          'https://example.com/research1',
          'https://example.com/research2',
          'https://example.com/quantum-apps',
          'https://example.com/ar-vr-trends'
        ],
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Comprehensive report on 2025 technology advances including quantum computing and AR/VR integration.'
            }
          }
        ]
      });
    
    // Perform deep research request
    const result = await conductDeepResearch(
      'Summarize briefly the most important technology advances from 2025 so far.'
    );
    
    // Verify model information is extracted
    // The model should match the one used in the final synthesis
    expect(result.model).toBe('llama-3.1-sonar-large-128k-online');
    
    // Verify synthesis content
    expect(result.content).toBe('Comprehensive report on 2025 technology advances including quantum computing and AR/VR integration.');
    
    // Verify citations are collected
    expect(result.citations).toBeInstanceOf(Array);
    expect(result.citations.length).toBeGreaterThan(0);
  });
  
  it('should handle API errors gracefully during model extraction', async () => {
    // Intercept with error response
    nock.cleanAll();
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(500, { error: 'Internal Server Error' });
    
    // Expect the request to be rejected
    await expect(
      processWebQuery('What is the current date today?')
    ).rejects.toThrow();
  });
  
  it('should handle rate limit errors during model extraction', async () => {
    // Intercept with rate limit response
    nock.cleanAll();
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(429, { error: 'Too Many Requests' }, { 'Retry-After': '60' });
    
    // Expect the request to be rejected with rate limit error
    await expect(
      processWebQuery('What is the current date today?')
    ).rejects.toThrow(/perplexity|rate limit|too many requests/i);
  });
});