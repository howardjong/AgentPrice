# Jest to Vitest Migration and Mocking Improvement Plan

This document outlines the comprehensive plan for migrating our test suite from Jest to Vitest, while enhancing our mocking capabilities for complex testing scenarios, including integration testing and long-running processes.

## Why Migrate to Vitest?

- **✅ Performance**: Vitest leverages Vite's dev server for significantly faster test execution
- **✅ ESM Compatibility**: Better support for ES modules without configuration workarounds
- **✅ Memory Efficiency**: Reduced memory footprint, especially important for our resource-intensive tests
- **✅ Watch Mode**: Improved watch mode with faster reloads
- **✅ Similar API**: Vitest has a Jest-compatible API that minimizes code changes

## Migration Goals

1. Complete migration from Jest to Vitest
2. Implement robust mocking for external services
3. Support testing of long-running operations
4. Create a foundation for comprehensive integration testing 
5. Reduce testing costs by minimizing actual API calls
6. Improve test reliability by removing external dependencies

## Focus Area: test-single-query-workflow.js

Our immediate focus is migrating the `test-single-query-workflow.js` test to Vitest with improved mocking. This test is critical because:

1. It tests a core workflow that powers many user-facing features
2. It currently makes actual API calls to external services
3. It requires sophisticated mocking of both time and network responses
4. It serves as an excellent template for our other workflow tests

### Key Components to Mock

- **Perplexity API calls**: We need to simulate both standard and deep research responses
- **Long-running operations**: The workflow can take up to 30 minutes in real-time
- **Job processing**: Multiple stages of processing need to be simulated
- **Webhook callbacks**: External service callbacks need proper simulation

## Implementation Phases

### Phase 1: Core Testing Infrastructure

These improvements focus on the essential tools needed for effective testing with Vitest.

#### 1. HTTP Request Mocking with Nock (✅ Completed)

**Implementation Details:**
- ✅ Install Nock as a development dependency
- ✅ Create test helpers for mocking Perplexity and Claude API responses
- ✅ Support mocking of different response types (success, error, timeout, rate limit)

**Benefits:**
- Eliminates network dependencies during tests
- Provides precise control over API response scenarios
- Ensures tests run consistently regardless of API availability

#### 2. Enhanced Time Simulation (✅ Completed)

**Implementation Details:**
- ✅ Integrate our custom `performanceNowMock` with Vitest's fake timers
- ✅ Add support for simulating long-running operations
- ✅ Create helpers for time-based testing scenarios

**Benefits:**
- Tests can simulate 30-minute processes in milliseconds
- Maintains accurate timing without actual delays
- Supports testing time-dependent edge cases

#### 3. Standard Response Fixtures (✅ Completed)

**Implementation Details:**
- ✅ Create a fixtures directory with sample API responses
- ✅ Include response templates for common operations
- ✅ Add helpers to load and customize fixtures

**Benefits:**
- Consistent test data across all tests
- Reduces test maintenance burden
- Ensures realistic API response scenarios

### Phase 2: Advanced Mocking Capabilities

After establishing core infrastructure, these improvements enhance our testing capabilities.

#### 4. Request/Response Recording (⬜ Not Started)

**Implementation Details:**
- ⬜ Add utilities to capture and sanitize real API responses
- ⬜ Store responses as fixtures for test use
- ⬜ Support parameterized fixture creation

**Benefits:**
- Captures realistic data patterns
- Reduces manual fixture creation effort
- Ensures tests use representative data

#### 5. MockServiceFactory (⬜ Not Started)

**Implementation Details:**
- ⬜ Create factory class for service instantiation
- ⬜ Pre-configure services with appropriate mocks
- ⬜ Support different test scenarios (happy path, error cases)

**Benefits:**
- Simplifies test setup code
- Ensures consistent service mocking
- Reduces boilerplate in test files

#### 6. Integration Test Helpers (⬜ Not Started)

**Implementation Details:**
- ⬜ Create utilities for multi-service test scenarios
- ⬜ Support transaction-like setup and teardown
- ⬜ Add middleware mocking capabilities

**Benefits:**
- Makes integration tests easier to write
- Reduces complexity in test files
- Supports testing of service interactions

### Phase 3: Diagnostic Tools and Testing Utilities

These improvements focus on creating diagnostic tools for system testing and monitoring.

#### 7. Socket.IO Diagnostic Framework (✅ Complete)

**Implementation Details:**
- ✅ Create browser-based diagnostic tools for Socket.IO testing
- ✅ Implement detailed connection state monitoring
- ✅ Design centralized navigation hub for all testing utilities
- ✅ Support simulation of different system health states

**Benefits:**
- Real-time verification of Socket.IO connections
- Visual confirmation of system health status
- Improved debugging of connection issues
- One-stop access to all testing utilities

#### 8. System Health Monitoring (✅ Complete)

**Implementation Details:**
- ✅ Create detailed health score calculation
- ✅ Implement real-time status updates via Socket.IO
- ✅ Fix health score to accurately reflect API status
- ✅ Create comprehensive test suite for health calculation

**Benefits:**
- Accurate real-time system status reporting
- Better visibility into system performance
- Proactive identification of API service issues
- Clear indicators of system recovery and degradation

### Phase 4: Infrastructure Optimization

These longer-term improvements focus on optimizing the testing infrastructure.

#### 9. Improved Error Handling and Promise Rejection (🟢 In Progress)

**Implementation Details:**
- ✅ Create comprehensive error handling best practices documentation
- ✅ Develop utility library for standardized error handling in tests
- 🟢 Create tools to scan and identify suboptimal error handling patterns
- ⬜ Apply improved patterns to existing test files
- ⬜ Add support for non-deterministic error testing

**Benefits:**
- More reliable and deterministic tests
- Better error messages when tests fail
- Simplified testing of failure scenarios
- Consistent approach to error handling across the test suite
- Improved testing of error propagation and recovery mechanisms

#### 10. Redis Cache Mocking (⬜ Not Started)

**Implementation Details:**
- ⬜ Implement in-memory cache with Redis-compatible interface
- ⬜ Support key operations (get, set, expire)
- ⬜ Simulate cache behavior without Redis dependency

**Benefits:**
- Tests can verify caching logic
- No need for external Redis during testing
- Predictable cache behavior in tests

#### 10. Test Environment Configuration (⬜ Not Started)

**Implementation Details:**
- ⬜ Create configuration system for test environments
- ⬜ Support toggling between mock and real dependencies
- ⬜ Allow fine-grained control over test isolation

**Benefits:**
- Better control over test behavior
- Support for different testing strategies
- Flexibility for development vs. CI environments

## Implementation Approach

For each component, we will:

1. Create and document a clear design
2. Implement the functionality with comprehensive tests
3. Update existing tests to use the new capabilities
4. Document usage patterns and best practices

## Success Criteria

Our test migration will be considered successful when:

1. All tests are migrated to Vitest
2. Tests run reliably without external dependencies
3. Test execution time is optimized for CI/CD pipelines
4. Complex integration scenarios are adequately tested
5. The test suite provides comprehensive coverage

## Next Steps

1. ✅ Complete Nock setup for HTTP mocking in the Perplexity workflow test
2. ✅ Create comprehensive fixtures for both standard and deep research responses
3. ✅ Implement the nock-based versions of workflow tests
   - ✅ perplexity-workflow-nock.vitest.js (5 tests passing)
   - ✅ single-query-workflow-nock.vitest.js (8 tests passing)
   - ✅ claude-chart-workflow-nock.vitest.js (5 tests passing)
4. ✅ Document the patterns used for future test migrations
5. ✅ Complete remaining test fixes for the nock-based workflow tests
6. ✅ Create diagnostic tools for WebSocket/Socket.IO connection verification
7. ✅ Create centralized tools directory for navigating diagnostic utilities
8. ✅ Update System Health calculation to properly report status in real-time
9. ✅ Implement integration tests for skipped mockJobManager functionality (9 tests passing)
10. ✅ Update test scripts to better handle error cases and promise rejections
11. ✅ Add workarounds for performance.now mocking in time-sensitive tests
12. ⬜ Complete migration of remaining utility tests