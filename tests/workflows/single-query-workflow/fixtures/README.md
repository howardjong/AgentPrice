# Test Fixtures for Single Query Workflow

This directory contains test fixtures and sample data used for testing the single-query workflow. These fixtures enable consistent and repeatable tests by providing standardized inputs and expected outputs.

## Available Fixtures

### test-queries.json

A collection of predefined test queries for various domains:

- General knowledge queries
- Technical and scientific queries
- Current events queries
- Complex multi-part queries
- Edge case queries (very short, very long, etc.)

Each query includes:
- `id`: Unique identifier
- `text`: The actual query text
- `category`: Domain category (e.g., "science", "technology")
- `complexity`: Rating of query complexity (1-5)
- `expectedTopics`: Key topics the response should cover

### expected-responses.json

Expected response patterns for test queries:

- Expected clarified queries
- Sample research content snippets
- Representative data extraction results
- Chart configuration templates

This file helps validate that the workflow produces reasonable and consistent outputs across test runs.

### mock-api-responses.json

Pre-defined mock responses from Claude and Perplexity APIs:

- Claude query clarification responses
- Perplexity research results with sources
- Claude data extraction responses
- Claude chart generation responses

These mocks simulate API behavior without making actual calls, making tests faster and more reliable.

### error-scenarios.json

Scenarios for testing error handling:

- Invalid API inputs
- Service timeouts
- Rate limit errors
- Malformed responses
- Empty or insufficient results

Used to verify the system's fault tolerance and error recovery mechanisms.

## Usage in Tests

### Loading Test Fixtures

```javascript
import { readFile } from 'fs/promises';
import path from 'path';

// Load test queries
const testQueries = JSON.parse(
  await readFile(
    path.join(__dirname, 'fixtures', 'test-queries.json'),
    'utf-8'
  )
);

// Use a test query
const scienceQuery = testQueries.find(q => q.category === 'science');
```

### Using Mock Responses

```javascript
import { mockResponses } from './mock-services.js';

// Configure mocks for a specific query
mockResponses.configureMockForQuery('What are the latest advancements in renewable energy storage?', {
  clarification: {
    // Mock data for Claude clarification
  },
  research: {
    // Mock data for Perplexity research
  }
  // Additional mocks...
});
```

## Updating Fixtures

When adding new test scenarios:

1. Add corresponding queries to `test-queries.json`
2. Create appropriate mock responses in `mock-api-responses.json`
3. Define expected results in `expected-responses.json`
4. Update error scenarios if testing new error conditions

## Future Enhancements

Planned improvements to test fixtures:

- Additional domain categories
- More complex multi-part queries
- Expanded chart types and visualization scenarios
- Additional error cases including partial failures
- Structured schema validation for fixture data