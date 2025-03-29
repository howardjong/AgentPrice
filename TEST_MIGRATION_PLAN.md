# Test Migration and Mocking Improvement Plan

This document outlines our strategy for migrating to Vitest and enhancing our mocking capabilities for complex testing scenarios, including integration testing and long-running processes.

## Migration Goals

1. Complete migration from Jest to Vitest
2. Implement robust mocking for external services
3. Support testing of long-running operations
4. Create a foundation for comprehensive integration testing 
5. Reduce testing costs by minimizing actual API calls
6. Improve test reliability by removing external dependencies

## Implementation Phases

### Phase 1: Core Testing Infrastructure

These improvements focus on the essential tools needed for effective testing with Vitest.

#### 1. HTTP Request Mocking with Nock

**Implementation Details:**
- Install Nock as a development dependency
- Create test helpers for mocking Perplexity and Claude API responses
- Support mocking of different response types (success, error, timeout)

**Benefits:**
- Eliminates network dependencies during tests
- Provides precise control over API response scenarios
- Ensures tests run consistently regardless of API availability

#### 2. Enhanced Time Simulation

**Implementation Details:**
- Integrate our custom `performanceNowMock` with Vitest's fake timers
- Add support for simulating long-running operations
- Create helpers for time-based testing scenarios

**Benefits:**
- Tests can simulate 30-minute processes in milliseconds
- Maintains accurate timing without actual delays
- Supports testing time-dependent edge cases

#### 3. Standard Response Fixtures

**Implementation Details:**
- Create a fixtures directory with sample API responses
- Include response templates for common operations
- Add helpers to load and customize fixtures

**Benefits:**
- Consistent test data across all tests
- Reduces test maintenance burden
- Ensures realistic API response scenarios

### Phase 2: Advanced Mocking Capabilities

After establishing core infrastructure, these improvements enhance our testing capabilities.

#### 4. Request/Response Recording

**Implementation Details:**
- Add utilities to capture and sanitize real API responses
- Store responses as fixtures for test use
- Support parameterized fixture creation

**Benefits:**
- Captures realistic data patterns
- Reduces manual fixture creation effort
- Ensures tests use representative data

#### 5. MockServiceFactory

**Implementation Details:**
- Create factory class for service instantiation
- Pre-configure services with appropriate mocks
- Support different test scenarios (happy path, error cases)

**Benefits:**
- Simplifies test setup code
- Ensures consistent service mocking
- Reduces boilerplate in test files

#### 6. Integration Test Helpers

**Implementation Details:**
- Create utilities for multi-service test scenarios
- Support transaction-like setup and teardown
- Add middleware mocking capabilities

**Benefits:**
- Makes integration tests easier to write
- Reduces complexity in test files
- Supports testing of service interactions

### Phase 3: Infrastructure Optimization

These longer-term improvements focus on optimizing the testing infrastructure.

#### 7. Redis Cache Mocking

**Implementation Details:**
- Implement in-memory cache with Redis-compatible interface
- Support key operations (get, set, expire)
- Simulate cache behavior without Redis dependency

**Benefits:**
- Tests can verify caching logic
- No need for external Redis during testing
- Predictable cache behavior in tests

#### 8. Test Environment Configuration

**Implementation Details:**
- Create configuration system for test environments
- Support toggling between mock and real dependencies
- Allow fine-grained control over test isolation

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

1. Install and set up Nock for HTTP mocking
2. Enhance time simulation capabilities
3. Create initial response fixtures
4. Begin updating existing tests to use the new infrastructure