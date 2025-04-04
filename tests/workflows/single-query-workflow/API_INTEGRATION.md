# API Integration for Single Query Workflow Tests

This document describes how to integrate real API services with the test framework for validating the single-query workflow.

## Overview

The test framework supports two modes of operation:
1. **Mock Mode**: Uses simulated services without making actual API calls (default)
2. **Real API Mode**: Connects to actual Claude and Perplexity services for live testing

Real API testing is valuable for validating:
- Actual API behavior and response formats
- Rate limiting and error handling
- End-to-end workflow performance with real services

## Required API Keys

To use real API services, you need:

1. **Claude API Key (Anthropic)**
   - Environment variable: `ANTHROPIC_API_KEY`
   - Used for query clarification, data extraction, and chart generation

2. **Perplexity API Key**
   - Environment variable: `PERPLEXITY_API_KEY`
   - Used for deep research with the sonar-deep-research model

These keys should be stored in Replit Secrets or your `.env` file.

## Running Tests with Real APIs

To run tests with real APIs:

```bash
# Run specific test variant with real APIs
node tests/workflows/single-query-workflow/run-tests.js --variant=basic --use-real-apis

# Run manual test with real APIs
node tests/manual/test-single-query-workflow.js basic --use-real-apis
```

⚠️ **Important:** Using real APIs will:
1. Consume API tokens/credits
2. Be subject to rate limits
3. Take longer to execute
4. Potentially yield different results than mock services

## API Integration Implementation

The real API services are implemented in `test-runner.js` using the `loadRealServices()` function. When running with `--use-real-apis`:

1. The function verifies API keys are available in the environment
2. It creates service implementations that connect to the actual APIs
3. Each service method handles API communication and response parsing

## Perplexity Deep Research Integration

### Using the sonar-deep-research Model

The Perplexity integration uses the "sonar-deep-research" model, which:
- Provides more comprehensive research results
- Uses an asynchronous polling mechanism (not immediate responses)
- Is subject to a 5 requests per minute rate limit
- Requires 10-30 seconds to complete a request

### Polling Implementation

Deep research requests use a polling pattern:

1. Initial request starts the research task
2. The API returns a `task_id` and status "processing"
3. The client polls for results using the task_id
4. When complete, the API returns the research content and sources

## Claude Integration

The Claude integration uses the Anthropic API for:

1. **Query Clarification**
   - Uses Claude to refine the original query
   - Improves specificity and focus for research

2. **Data Extraction**
   - Analyzes research content to identify key data points
   - Extracts structured data suitable for visualization

3. **Chart Generation**
   - Generates Plotly chart configurations based on extracted data
   - Selects appropriate chart types and styling

## Timeout Considerations

Real API tests require longer timeouts:
- Perplexity deep research can take 10-30 seconds
- Claude processing for data extraction can take 3-8 seconds
- Chart generation can take 5-10 seconds

The test framework automatically extends timeouts for real API tests.

## Error Handling

The real API implementation includes error handling for:
- Missing or invalid API keys
- Rate limiting (429 errors)
- Service unavailability (5xx errors)
- Polling timeouts for deep research
- Invalid response formats

## Testing API Integration Without Making Calls

For verifying the API integration code without consuming API credits:

1. Review the implementation in `test-runner.js`
2. Ensure error handling is robust
3. Check that API keys are properly verified and used

## Best Practices

1. **Limit Real API Tests**
   - Only run real API tests when necessary
   - Use mock services for regular development and CI/CD

2. **Handle Rate Limits**
   - Add delays between tests (especially for Perplexity)
   - Implement exponential backoff for retries

3. **Secure API Keys**
   - Never commit API keys to the repository
   - Use environment variables or secrets management

4. **Cache Results When Possible**
   - Save API responses to avoid redundant calls
   - Implement a caching layer for frequently used queries