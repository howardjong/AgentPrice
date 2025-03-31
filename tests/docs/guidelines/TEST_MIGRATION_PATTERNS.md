# Vitest Migration Patterns and Best Practices

This document captures proven patterns and solutions used in our successful Vitest migrations, particularly focusing on workflow tests. These should be applied to remaining test migrations to ensure consistency and reliability.

## ES Module Import Handling

### Problem
- Vitest and ES modules require different mocking approaches compared to Jest
- Common error: `"default is not a constructor"` when trying to mock ES module exports

### Solution
```js
// WRONG - will cause "default is not a constructor" in many cases
import PerplexityService from '../../../services/perplexityService';
vi.mock('../../../services/perplexityService');

// RIGHT - use vi.mock with factory function that returns mocks for named exports
vi.mock('../../../services/perplexityService', () => {
  return {
    default: vi.fn(() => ({
      query: vi.fn().mockResolvedValue({ message: 'Mocked response' }),
      performDeepResearch: vi.fn().mockResolvedValue({ results: 'Mocked research' })
    }))
  };
});
```

## Mocking Time Functions

### Problem
- Time-based functions like `performance.now()` or timers need consistent handling
- Non-deterministic behavior in tests if time mocking isn't properly configured

### Solution
```js
// Set up time mocking in beforeEach
beforeEach(() => {
  // Create a controlled time environment
  vi.useFakeTimers();
  
  // For performance.now mocking
  const performanceNowMock = vi.spyOn(performance, 'now');
  let timeCounter = 0;
  performanceNowMock.mockImplementation(() => {
    timeCounter += 100; // increment by 100ms
    return timeCounter;
  });
});

// Clean up time mocking in afterEach
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

## HTTP Request Mocking with Nock

### Problem
- External API calls need to be mocked to avoid real network requests
- Complex response scenarios (success, error, timeout) need consistent simulation

### Solution
```js
import nock from 'nock';
import fs from 'fs/promises';
import path from 'path';

// Load fixtures
const loadFixture = async (name) => {
  const filePath = path.join(__dirname, '../../fixtures', name);
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
};

beforeEach(async () => {
  // Load test fixtures
  const standardResponse = await loadFixture('perplexity/standard-response.json');
  
  // Set up nock interceptor
  nock('https://api.perplexity.ai')
    .post('/chat/completions')
    .reply(200, standardResponse);
    
  // Error scenario
  nock('https://api.perplexity.ai')
    .post('/chat/completions', body => body.messages[0].content.includes('error'))
    .reply(500, { error: 'Server error' });
    
  // Rate limiting scenario  
  nock('https://api.perplexity.ai')
    .post('/chat/completions', body => body.messages[0].content.includes('rate limit'))
    .reply(429, { error: 'Too many requests' });
});

afterEach(() => {
  nock.cleanAll();
});
```

## Workflow Testing Pattern

### Problem
- Complex workflows involve multiple services and state management
- Tests need to validate the entire chain of operations without making real API calls

### Solution
```js
describe('Single Query Workflow', () => {
  // Step 1: Mock all external services
  let perplexityService;
  let anthropicService;
  let serviceRouter;
  
  beforeEach(() => {
    // Use factory implementation for consistent mocking
    perplexityService = {
      query: vi.fn().mockResolvedValue({ message: 'Perplexity response' }),
      getServiceStatus: vi.fn().mockReturnValue({ available: true, latency: 120 })
    };
    
    anthropicService = {
      generateResponse: vi.fn().mockResolvedValue({ text: 'Claude response' }),
      getServiceStatus: vi.fn().mockReturnValue({ available: true, latency: 200 })
    };
    
    // Create service router with mocked services
    serviceRouter = new ServiceRouter({
      perplexityService,
      anthropicService
    });
  });
  
  // Step 2: Test complete workflow paths
  test('should process a standard query through the appropriate service', async () => {
    // Setup inputs
    const query = "What is the capital of France?";
    const options = { deep_research: false };
    
    // Execute workflow
    const result = await serviceRouter.routeQuery(query, options);
    
    // Verify correct service was called
    expect(perplexityService.query).toHaveBeenCalledWith(
      expect.objectContaining({ 
        messages: expect.arrayContaining([
          expect.objectContaining({ content: query })
        ])
      }),
      expect.any(Object)
    );
    
    // Verify result was correctly processed
    expect(result).toHaveProperty('message');
    expect(result.message).toBe('Perplexity response');
  });
});
```

## External API Error Handling

### Problem
- External services can fail in various ways (timeout, rate limit, server error)
- Error handling needs to be thoroughly tested with different error types

### Solution
```js
// Test error handling
test('should handle API errors gracefully', async () => {
  // Setup service to throw error
  perplexityService.query.mockRejectedValueOnce(new Error('API error'));
  
  // Execute workflow with error-triggering input
  const result = await serviceRouter.routeQuery("Trigger an error", {});
  
  // Verify appropriate error handling
  expect(result).toHaveProperty('error');
  expect(result.error).toContain('API error');
  expect(result).toHaveProperty('fallbackUsed', true);
});

// Test rate limiting
test('should handle rate limiting with appropriate retry', async () => {
  // First call fails with rate limit, second succeeds
  perplexityService.query
    .mockRejectedValueOnce(new Error('Rate limit exceeded'))
    .mockResolvedValueOnce({ message: 'Success after retry' });
  
  // Execute workflow
  const result = await serviceRouter.routeQuery("Test rate limit", {});
  
  // Verify retry succeeded
  expect(result).toHaveProperty('message');
  expect(result.message).toBe('Success after retry');
  expect(perplexityService.query).toHaveBeenCalledTimes(2);
});
```

## WebSocket Testing Approach

### Problem
- WebSocket tests require simulating both server and client
- Event-based communication is hard to test deterministically

### Solution
```js
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

describe('WebSocket Integration', () => {
  let server;
  let wss;
  let port;
  
  beforeEach((done) => {
    // Create HTTP server
    server = createServer();
    
    // Listen on a random port
    server.listen(0, '127.0.0.1', () => {
      // Get randomly assigned port
      port = server.address().port;
      
      // Create WebSocket server
      wss = new WebSocketServer({ server, path: '/ws' });
      
      // Configure WS behavior
      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          // Parse message
          const data = JSON.parse(message.toString());
          
          // Send appropriate response based on message type
          if (data.type === 'subscribe') {
            ws.send(JSON.stringify({ type: 'subscription_success', channel: data.channel }));
          }
        });
        
        // Send welcome message
        ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to test server' }));
      });
      
      done();
    });
  });
  
  afterEach((done) => {
    wss.close();
    server.close(done);
  });
  
  test('should establish connection and receive welcome message', (done) => {
    // Create client
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    
    // Setup event handlers
    ws.on('open', () => {
      console.log('Connection established');
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      
      // Verify welcome message
      expect(message).toHaveProperty('type', 'welcome');
      ws.close();
      done();
    });
  });
});
```

## Controller Testing with Supertest

### Problem
- API endpoints need to be tested without running a full server
- Request/response flow needs verification with mocked dependencies

### Solution
```js
import express from 'express';
import request from 'supertest';

describe('Query Controller', () => {
  let app;
  let mockPerplexityService;
  let mockStorage;
  
  beforeEach(() => {
    // Create mocks
    mockPerplexityService = {
      query: vi.fn().mockResolvedValue({ message: 'Test response' })
    };
    
    mockStorage = {
      createConversation: vi.fn().mockResolvedValue('new-convo-id'),
      getConversation: vi.fn().mockResolvedValue({ id: 'test-id', messages: [] }),
      addMessageToConversation: vi.fn().mockResolvedValue(true)
    };
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Setup routes with mocked dependencies
    const queryController = new QueryController({
      perplexityService: mockPerplexityService,
      storage: mockStorage
    });
    
    // Register routes
    app.post('/api/conversation', queryController.processQuery);
    app.get('/api/status', queryController.getStatus);
  });
  
  test('should process query and return results', async () => {
    const response = await request(app)
      .post('/api/conversation')
      .send({
        query: 'Test question',
        conversationId: null
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Test response');
    expect(mockPerplexityService.query).toHaveBeenCalled();
  });
});
```

## General Best Practices

1. **Clean up after each test** - Always restore mocks and reset state
2. **Isolate tests** - Each test should run independently
3. **Avoid real API calls** - Use nock or mock implementations
4. **Use consistent patterns** - Apply the same mocking pattern across similar tests
5. **Handle async properly** - Use async/await for all asynchronous tests
6. **Mock at the appropriate level** - Mock at service boundaries, not internal functions
7. **Test edge cases** - Include error handling, rate limiting, and fallback scenarios
8. **Keep fixtures updated** - Ensure test fixtures match current API response formats

By following these patterns consistently, we can ensure reliable, maintainable tests across our entire application.