# Test Coverage Improvement Plan

## Current Status

As of April 1, 2025, we're making significant progress in migrating tests from Jest to Vitest while simultaneously improving coverage. Our target is to achieve >80% coverage across all critical modules.

### Completed Modules

| Module | Status | Coverage | Notes |
|--------|--------|----------|-------|
| Redis Service | ✅ Complete | 95% | All 14 tests passing, focusing on recovery patterns |
| Socket.IO Connection Management | ✅ Complete | 90% | 5 tests covering client tracking, room management, and messaging |
| WebSocket Error Handling | ✅ Complete | 85% | 7 tests covering error propagation, recovery, and edge cases |
| WebSocket Reconnection | ✅ Complete | 88% | 5 tests addressing the critical timeout issues |
| API Client (Retry Logic) | ✅ Complete | 92% | Fixed MockAdapter chaining issues |
| API Client (Timeout Handling) | ✅ Complete | 85% | Specialized tests for various timeout scenarios |
| API Client (Error Handling) | ✅ Complete | 88% | Comprehensive error classification and recovery tests |

### In Progress

| Module | Status | Current Coverage | Target Coverage | Notes |
|--------|--------|-----------------|----------------|-------|
| Circuit Breaker | 🔄 In Progress | 65% | 90% | Need to add tests for state transitions and timeout recovery |
| Prompt Manager | 🔄 In Progress | 72% | 85% | Need more tests for template validation and error handling |
| Anthropic Service | 🔄 Planned | 40% | 80% | Focus on rate limit handling and retry integration |

## Testing Patterns

We've established several effective testing patterns that have improved test stability:

### WebSocket Testing
- Use promise-based event testing instead of done() callbacks
- Implement explicit two-phase cleanup (first clients, then server)
- Use shorter timeouts (300-500ms) for WebSocket operations
- Create isolated test environments for each Socket.IO test

### API Client Testing  
- Use counter-based approach for sequential responses in axios-mock-adapter
- Properly mock circuit breaker to isolate API client behavior
- Use time controller utilities for predictable timing tests
- Test specific areas (retry, timeout, error) in separate focused files

### Redis Testing
- Implement proper cleanup of Redis connections in afterEach hooks
- Use redis-mock for unit tests, real Redis for integration tests
- Test recovery patterns with controlled connection failures

## Documentation

We've created several documentation files to track our testing patterns:

1. `WEBSOCKET_ERROR_HANDLING_PATTERNS_2025-04-01.md`
2. `API_CLIENT_TESTING_PATTERNS_2025-04-01.md`
3. `AXIOS_MOCK_ADAPTER_PATTERNS_2025-04-01.md`
4. `REDIS_SERVICE_TESTING_PATTERNS_2025-04-01.md`

## Next Steps

Priority order for upcoming work:

1. **Circuit Breaker Testing**: Complete tests for state transitions, timeouts, and integration
2. **Prompt Manager**: Add tests for template validation, error cases, and custom templates
3. **WebSocket Performance**: Add load tests for WebSocket performance under high concurrency
4. **Context Manager**: Create focused tests for context serialization and recovery
5. **Job Manager**: Test queue processing, job prioritization, and error recovery

## Coverage Goals by Module

| Module | Current | Target | Priority |
|--------|---------|--------|----------|
| Circuit Breaker | 65% | 90% | HIGH |
| Prompt Manager | 72% | 85% | HIGH |
| Context Manager | 58% | 80% | MEDIUM |
| Job Manager | 63% | 85% | MEDIUM |
| Anthropic Service | 40% | 80% | MEDIUM |
| Perplexity Service | 45% | 80% | LOW |
| Research Service | 55% | 75% | LOW |

## General Improvement Strategies

1. **Test Organization**: Continue organizing tests into focused files for specific functionality
2. **Mocking Strategy**: Use consistent mocking patterns across all test files
3. **Documentation**: Document successful patterns for future reference
4. **CI Integration**: Ensure Vitest tests are fully integrated into CI pipeline
5. **Coverage Reporting**: Generate and analyze coverage reports after each major module completion