# Test Coverage Plan

## Current Coverage Status
As of March 31, 2025, our coverage metrics are:
- Statements: 1.72%
- Branches: 18.93%
- Functions: 13.77% 
- Lines: 1.72%

**Goal**: Achieve at least 80% coverage for branches, functions, lines, and statements through targeted test implementation.

## High Priority Components
These components are the core of our application and require thorough testing first:

### 1. Service Layer (✓ = Completed, ⚠️ = In Progress, ❌ = Not Started)

| Component | Status | Coverage Priority | Notes |
|-----------|--------|-------------------|-------|
| serviceRouter.js | ⚠️ | Critical | Central component that routes requests between LLM services |
| claudeService.js | ✓ | Critical | Handles Claude AI interactions |
| perplexityService.js | ❌ | Critical | Manages Perplexity API for deep research |
| healthMonitor.js | ⚠️ | High | System health monitoring and reporting |
| jobManager.js | ❌ | High | Manages long-running job processes |
| contextManager.js | ❌ | High | Maintains conversation context |
| redisService.js | ⚠️ | High | Caching and persistence layer |

### 2. Controllers (✓ = Completed, ⚠️ = In Progress, ❌ = Not Started)

| Component | Status | Coverage Priority | Notes |
|-----------|--------|-------------------|-------|
| chartsController | ❌ | Critical | Visualization generation |
| queryController | ❌ | Critical | Handles query routing and responses |
| researchController | ❌ | Critical | Manages research workflows |

### 3. Server & WebSocket (✓ = Completed, ⚠️ = In Progress, ❌ = Not Started)

| Component | Status | Coverage Priority | Notes |
|-----------|--------|-------------------|-------|
| server/routes.ts | ⚠️ | Critical | API routing and WebSocket implementation |
| WebSocket Integration | ⚠️ | Critical | Real-time client-server communication |
| WebSocket Error Handling | ❌ | High | Error cases for WebSocket connections |

### 4. Utilities (✓ = Completed, ⚠️ = In Progress, ❌ = Not Started)

| Component | Status | Coverage Priority | Notes |
|-----------|--------|-------------------|-------|
| cost-optimization.js | ✓ | High | API cost reduction techniques |
| apiClient.js | ❌ | High | API request handling and retries |
| circuitBreaker.js | ❌ | Medium | Circuit breaker pattern for API calls |
| promptManager.js | ❌ | Medium | Managing prompts for LLM requests |

## Test Implementation Plan

### Phase 1: Core Service Tests

1. **Service Router Tests**
   - Test routing logic between Claude and Perplexity
   - Test fallback mechanisms
   - Test error handling
   
2. **Claude Service Tests**
   - Test basic query functionality with mocked API
   - Test error handling and retries
   - Test streaming responses
   
3. **Perplexity Service Tests**
   - Test deep research functionality with mocked API
   - Test rate limiting behavior
   - Test error handling

### Phase 2: Controller Tests

1. **Charts Controller Tests**
   - Test Van Westendorp chart generation
   - Test Conjoint Analysis chart generation
   - Test error handling for invalid data

2. **Query Controller Tests**
   - Test query dispatching
   - Test response formatting
   - Test error handling

3. **Research Controller Tests**
   - Test long-running research job creation
   - Test job status updates
   - Test research result retrieval

### Phase 3: WebSocket & Integration Tests

1. **WebSocket Basic Tests**
   - Test connection establishment ✓
   - Test message broadcasting ⚠️
   - Test client reconnection behavior

2. **WebSocket Error Tests**
   - Test connection failures
   - Test timeout handling
   - Test recovery mechanisms

3. **Integration Tests**
   - Test end-to-end query flow
   - Test research workflow
   - Test visualization generation

### Phase 4: Utility Tests

1. **API Client Tests**
   - Test request retry logic
   - Test timeout handling
   - Test response parsing

2. **Circuit Breaker Tests**
   - Test failure threshold behavior
   - Test recovery after failures
   - Test half-open state behavior

3. **Prompt Manager Tests**
   - Test prompt templating
   - Test dynamic variable substitution
   - Test prompt optimization

## Progress Tracking

| Phase | Target Completion | Status | Current Coverage |
|-------|-------------------|--------|------------------|
| Phase 1 | April 5, 2025 | In Progress | - Claude service: 75.35% Lines, 71.79% Branches, 100% Functions<br>- Router service: 61.67% Lines, 82.5% Branches, 100% Functions<br>- Perplexity service: 97.72% Lines, 76.66% Branches, 100% Functions |
| Phase 2 | April 10, 2025 | Not Started | |
| Phase 3 | April 15, 2025 | Started | 1.72% Statements, 18.93% Branches, 13.77% Functions, 1.72% Lines |
| Phase 4 | April 20, 2025 | Partially Started | Cost optimization tested |

## Coverage Measurement Process

1. After implementing each test file, run:
   ```
   npx vitest run <test-file-path> --coverage
   ```

2. For overall coverage assessment, run:
   ```
   npx vitest run --coverage
   ```

3. Update this document with progress after each significant test implementation.

## Test Implementation Guidelines

1. **Mocking External Services**:
   - Use `nock` for HTTP request mocking
   - Use appropriate mocks for Redis, WebSockets, etc.
   - Create reusable mock factories

2. **Preventing API Calls**:
   - No real API calls to Claude or Perplexity in tests
   - Use environment variables to control test modes
   - Create comprehensive mock response libraries

3. **Testing Asynchronous Code**:
   - Use proper async/await patterns in tests
   - Set appropriate timeouts for long-running operations
   - Implement proper cleanup after each test

4. **Error Handling Testing**:
   - Test both happy path and error scenarios
   - Verify error propagation
   - Test recovery mechanisms

## Next Steps

1. ✅ Implement basic tests for Claude service - COMPLETED
2. ✅ Implement basic tests for Perplexity service - COMPLETED
3. Complete service router tests by implementing proper mocks for routeMessage function
4. Continue improving WebSocket tests with error handling cases
5. Implement controller tests for charts and queries
6. Run comprehensive coverage report to check progress
7. Address any coverage gaps identified in the report