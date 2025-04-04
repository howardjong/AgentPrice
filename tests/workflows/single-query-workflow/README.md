# Single Query Workflow Test Framework

A comprehensive testing framework for validating the multi-LLM research system's single-query workflow functionality. This framework provides both mock-based tests for CI/CD and real API tests for validation.

## Overview

The single-query workflow consists of four major steps:

1. **Query Clarification** (Claude): Refines user queries to make them more specific and searchable
2. **Deep Research** (Perplexity): Performs comprehensive internet research on the clarified query
3. **Data Extraction** (Claude): Analyzes research content to extract structured data for visualization
4. **Chart Generation** (Claude): Creates Plotly chart configurations based on the extracted data

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Access to Anthropic Claude and Perplexity APIs (for real API tests)
- API keys configured in Replit Secrets or .env file

### Installation

Clone the repository and install dependencies:

```bash
# Install dependencies
npm install
```

## Running Tests

### Basic Mock-Based Tests

Run tests with mock services (default):

```bash
# Run all tests with default mocks
node tests/workflows/single-query-workflow/run-tests.js

# Run specific test variant
node tests/workflows/single-query-workflow/run-tests.js --variant=basic
```

Available test variants:
- `basic`: Core functionality test
- `performance`: Measures execution time of each stage
- `reliability`: Tests fault tolerance and recovery
- `error-handling`: Verifies proper error handling

### Real API Tests

To run tests with real APIs (requires API keys):

```bash
# Run with real APIs
node tests/workflows/single-query-workflow/run-tests.js --use-real-apis

# Specific variant with real APIs
node tests/workflows/single-query-workflow/run-tests.js --variant=basic --use-real-apis
```

⚠️ **Important**: Real API tests will consume API credits and are subject to rate limits. Use them sparingly.

### Custom Query Tests

Test with a specific query:

```bash
node tests/workflows/single-query-workflow/run-tests.js --query="What are the environmental impacts of cryptocurrency mining?"
```

### Saving Test Results

To save test results to a file:

```bash
node tests/workflows/single-query-workflow/run-tests.js --save-results
```

Results will be saved to `test-results/single-query-workflow/` directory.

## Test Architecture

### Key Components

1. **test-runner.js**: Core test execution engine
2. **mock-services.js**: Mock implementations of Claude and Perplexity APIs
3. **check-api-credentials.js**: Utility to verify API key availability
4. **test-suite.js**: Collection of all tests
5. **run-tests.js**: Command-line interface for running tests

### Real API Integration

For real API tests, the framework:

1. Verifies API keys are available in environment
2. Extends timeouts to accommodate API latency
3. Implements proper error handling and retries
4. Uses polling for Perplexity deep research

### Socket Testing

For testing Socket.IO integrations:

1. Provides utilities for waiting for socket events
2. Simulates connection/disconnection scenarios
3. Validates event payloads against schemas
4. Tests reconnection behavior

## Test Variants

### Basic Tests

Verify core functionality with simple queries and typical content:

```javascript
test('should complete the entire workflow with expected content', async () => {
  const results = await runTest({ variant: 'basic' });
  expect(results.success).toBe(true);
  expect(results.clarifiedQuery).toBeDefined();
  expect(results.researchContent).toBeDefined();
  expect(results.extractedData).toBeDefined();
  expect(results.plotlyConfig).toBeDefined();
});
```

### Performance Tests

Measure execution time of each workflow stage:

```javascript
test('should complete all stages within acceptable time limits', async () => {
  const results = await runTest({ variant: 'performance' });
  
  expect(results.stageTiming.clarification.end - results.stageTiming.clarification.start).toBeLessThan(MAX_CLARIFICATION_TIME);
  expect(results.stageTiming.research.end - results.stageTiming.research.start).toBeLessThan(MAX_RESEARCH_TIME);
  // Additional timing checks...
});
```

### Reliability Tests

Test fault tolerance and recovery:

```javascript
test('should handle temporary service unavailability', async () => {
  // Setup service with intermittent failures
  mockServiceWithFailures();
  
  // Run test
  const results = await runTest({ variant: 'reliability' });
  
  // Expect successful completion despite failures
  expect(results.success).toBe(true);
  expect(results.retryAttempts).toBeGreaterThan(0);
});
```

### Error Handling Tests

Verify proper error handling:

```javascript
test('should handle invalid API responses', async () => {
  // Setup mock to return invalid data
  mockInvalidResponses();
  
  // Run test (should still complete with fallbacks)
  const results = await runTest({ variant: 'error-handling' });
  
  // Check that errors were handled
  expect(results.success).toBe(true);
  expect(results.fallback).toBeDefined();
});
```

## Environment Configuration

Configure test behavior with environment variables:

- `ENABLE_LIVE_API_TESTS`: Set to 'true' to enable real API tests
- `TEST_VARIANT`: Default test variant to run
- `TEST_QUERY`: Custom query to use
- `SAVE_TEST_RESULTS`: Set to 'true' to save results

## Additional Documentation

- [API Integration Guide](API_INTEGRATION.md): Details on integrating with real APIs
- [Socket Testing Guide](SOCKET_TESTING.md): Best practices for testing Socket.IO
- [Test Fixtures](fixtures/README.md): Description of test data and fixtures

## Contributing

1. Ensure all tests pass with `npm test`
2. Add tests for new features
3. Maintain high code coverage (target: >80%)
4. Document API changes

## License

This project is licensed under the MIT License.