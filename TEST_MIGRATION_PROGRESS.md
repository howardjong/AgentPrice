# Test Migration Progress

This document tracks the progress of migrating Jest unit tests to Vitest.

## Migration Status

| Service/Component | Jest Test | Vitest Test | Status | Date Completed |
|-------------------|-----------|-------------|--------|----------------|
| anthropicService  | N/A       | ✅ anthropicService.vitest.js | Complete | March 28, 2025 |
| perplexityService | ✅ Removed | ✅ perplexityService.vitest.js | Complete | March 28, 2025 |
| logger            | ✅ Removed | ✅ logger.vitest.js | Complete | March 28, 2025 |
| apiClient         | ✅ Backup  | ✅ apiClient.vitest.js | Complete | March 28, 2025 |
| circuitBreaker    | ✅ Backup  | ✅ circuitBreaker.vitest.js | Complete | March 28, 2025 |
| costTracker       | ✅ Migrated | ✅ costTracker.vitest.js | Complete | March 28, 2025 |
| tokenOptimizer    | ✅ Migrated | ✅ tokenOptimizer.vitest.js | Complete | March 28, 2025 |
| tieredResponseStrategy | ✅ Migrated | ✅ tieredResponseStrategy.vitest.js | Complete | March 28, 2025 |
| serviceRouter     | ✅ Migrated | ✅ serviceRouter.vitest.js | Complete | March 28, 2025 |

## Migration Plan

1. **Phase 1: Critical Services** ✅
   - Prioritize core services that interact with external APIs
   - Focus on anthropicService and perplexityService

2. **Phase 2: Utility Functions** ✅
   - Migrate utility function tests
   - Focus on circuitBreaker, apiClient, costTracker, tokenOptimizer, tieredResponseStrategy

3. **Phase 3: Integration Points** ⏳
   - Migrate services that tie multiple components together
   - Focus on serviceRouter, contextManager, etc.

4. **Phase 4: Application Logic** ⏳
   - Migrate business logic and application-specific components
   - Focus on controllers, middleware, etc.

## Completed Migrations

### March 28, 2025
- Successfully migrated perplexityService tests
- Successfully migrated logger tests
- Created backups of original Jest test files
- Confirmed Vitest tests pass with all test cases covered
- Migrated circuitBreaker tests for both implementations
- Completed migration of costTracker tests (16 tests passing)
- Completed migration of tokenOptimizer tests (18 tests passing)
- Completed migration of tieredResponseStrategy tests (13 tests passing)
- Completed migration of apiClient tests, including advanced HTTP retry tests with axios-mock-adapter
- Successfully completed Phase 2 of the migration plan
- Started Phase 3 with serviceRouter tests (14 tests passing)
- Fixed mocking approach for promise rejections in Vitest (different from Jest)

## Known Issues

- Some tests may show unhandled promise rejections related to Vite's development server connection.
  These are benign and don't affect test results, but could be addressed in future refinements.
- Vitest requires a different approach for mocking promise rejections compared to Jest:
  - Using `mockRejectedValueOnce` directly on a mock function can cause issues
  - Instead, use `vi.spyOn()` with `mockImplementation(() => { throw new Error() })` for more reliable error simulation
  - Alternatively, use `mockImplementationOnce(() => Promise.reject(new Error()))` pattern

## Next Steps

1. Continue Phase 3 migration with contextManager, jobManager, and promptManager
2. Update the test scripts to better handle error cases and promise rejections
3. Implement formal guidelines for mocking in Vitest vs Jest to prevent future issues
4. Implement websocket tests with the migration approach established for HTTP requests