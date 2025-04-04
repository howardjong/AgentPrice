# Single Query Workflow Test Suite

This directory contains a comprehensive test suite for the single-query workflow, which is a core component of the multi-LLM research system.

## Overview

The single-query workflow consists of several stages:

1. **Query Clarification** (Claude): Refines the user query for better search results
2. **Deep Research** (Perplexity): Performs in-depth research on the clarified query
3. **Data Extraction** (Claude): Extracts structured data from the research results
4. **Chart Generation** (Claude): Creates visualizations based on the extracted data

This test suite validates the entire workflow end-to-end, as well as individual components.

## Test Organization

The test suite is organized into:

- **Test Variants**: Different test configurations (basic, performance, reliability, error-handling)
- **Mock Services**: Simulated versions of the AI services (Claude, Perplexity)
- **Fixtures**: Sample data for testing (queries, expected responses)
- **Utilities**: Helper functions for running and validating tests

## Running Tests

### Using the Test Runner

The easiest way to run tests is with the provided test runner script:

```bash
node tests/workflows/single-query-workflow/run-tests.js [options]
```

Options:
- `--variant=NAME`: Test variant to run (basic, performance, reliability, errorHandling)
- `--use-real-apis`: Use real APIs instead of mocks (requires API keys)
- `--query="..."`: Custom query to test
- `--test-file=FILE`: Specific test file to run
- `--save-results`: Save test results to file

Examples:
```bash
# Run basic test with mock services
node tests/workflows/single-query-workflow/run-tests.js --variant=basic

# Run performance test with a custom query
node tests/workflows/single-query-workflow/run-tests.js --variant=performance --query="What are the latest advances in fusion energy?"

# List available test variants
node tests/workflows/single-query-workflow/run-tests.js --variant=list

# Run with real APIs (needs API keys in environment)
node tests/workflows/single-query-workflow/run-tests.js --use-real-apis
```

### Using the Manual Test Script

For more detailed output, use the manual test script:

```bash
node tests/manual/test-single-query-workflow.js [variant] [options]
```

Examples:
```bash
# Run basic test
node tests/manual/test-single-query-workflow.js basic

# Run reliability test with custom query
node tests/manual/test-single-query-workflow.js reliability --query="How do neural networks work?"
```

### Using Vitest

To run the tests with Vitest:

```bash
# Run all tests
npx vitest run tests/workflows/single-query-workflow/test-suite.js

# Run specific test file
npx vitest run tests/workflows/single-query-workflow/tests/basic.test.js
```

## Test Variants

### Basic Tests

Basic end-to-end tests that verify the workflow functions correctly.

### Performance Tests

Tests focusing on performance metrics and response times. Runs multiple iterations and calculates statistics.

### Reliability Tests

Tests the workflow across different types of queries (factual, analytical, numeric, technical) to ensure consistent results.

### Error Handling Tests

Tests the system's response to various error conditions and validates fallback mechanisms.

## Mock Services

The test suite includes mock implementations of:

- **Claude Service**: For query clarification, data extraction, and chart generation
- **Perplexity Service**: For deep research with the Perplexity API

These mocks simulate the behavior of the real services without external dependencies, making tests reproducible and fast.

## Using Real APIs

To test with real APIs:

1. Ensure API keys are set in the environment:
   - `ANTHROPIC_API_KEY` for Claude
   - `PERPLEXITY_API_KEY` for Perplexity

2. Run tests with the `--use-real-apis` flag:
   ```bash
   node tests/workflows/single-query-workflow/run-tests.js --use-real-apis
   ```

Note: Real API tests are rate-limited and may take longer to run.

## Adding New Tests

To add a new test:

1. Create a new test file in the `tests/` directory
2. Import the test utilities from `test-utils.js`
3. Use the `runAndValidateTest` function to execute the workflow
4. Add assertions to validate the results

## Test Results

Test results are saved in the `test-results/single-query-workflow/` directory by default. Each result file contains:

- Query information
- Full workflow results
- Timing data for each stage
- Validation results