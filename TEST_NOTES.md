# Test Notes

## Current Test Status

### Passing Tests
- apiClient.test.js - Tests for the RobustAPIClient class
- logger.test.js - Tests for the logging functionality
- circuitBreaker.test.js - Tests for the CircuitBreaker functionality

### Known Issues
- researchService.test.js - Having issues with ES module compatibility
- research.test.js (integration) - Similar issues with ES module compatibility

## Approach
Due to ongoing module teardown issues with the research service tests, we've decided to:

1. Continue development of the core functionality while ensuring manual testing via the API endpoints
2. Document research service test issues for future resolution
3. Use the passing basic tests to ensure stability of utility functions
4. Implement proper error handling in the research service to ensure robustness despite test issues

## Running Tests
To run the working tests:

```bash
NODE_OPTIONS=--experimental-vm-modules jest --config=jest.config.js -t "CircuitBreaker|Logger|RobustAPIClient"
```

## Future Improvements
- Refactor research service tests to be fully compatible with ES modules
- Address any module teardown issues in the Jest configuration
- Implement additional integration tests for the API endpoints

## Outstanding Issues (March 23, 2025)
1. Unhandled Promise Rejections
   - Multiple unhandled rejections in client code
   - Need to add proper error boundaries and promise catching

2. Model Mismatches
   - Claude model mismatches between requested and actual versions
   - Perplexity model fallback from sonar-deep-research to sonar-pro
   - Need to implement model version validation

3. Rate Limiting
   - Perplexity API hitting rate limits (429 errors)
   - Need to implement better rate limiting and queuing strategy

4. Test Coverage
   - research.test.js (integration) needs ES module compatibility fixes
   - researchService.test.js needs proper async handling