# Perplexity Deep Research Integration

This document provides information about the Perplexity Deep Research integration in our application, which enables advanced AI-powered research capabilities with comprehensive sourcing.

## Overview

The Perplexity deep research integration uses the `sonar-deep-research` model to perform comprehensive research on complex topics with multiple sources. This model:

1. Searches the internet for up-to-date information
2. Aggregates information from multiple credible sources
3. Synthesizes findings into a coherent response
4. Provides citations to the original sources

## API Details

- **Model Name**: `sonar-deep-research`
- **Endpoint**: `https://api.perplexity.ai/chat/completions`
- **Authentication**: Bearer token authentication with your Perplexity API key
- **Response Format**: Responses include poll URLs for long-running research
- **Polling Mechanism**: Research can take up to 30 minutes to complete

## Testing Scripts

Several scripts have been developed to test and verify the deep research capabilities:

1. `check-official-models.js` - Tests all Perplexity model names to verify which are available with current API key
2. `check-deep-research-status.js` - Checks the status of ongoing research requests
3. `enhanced-polling-deep-research.js` - Full implementation of deep research with polling mechanism
4. `collect-deep-research-results.js` - Collects and organizes all deep research results
5. `complete-perplexity-deep-research.cjs` - End-to-end solution for initiating and monitoring research

## Usage Example

To start a deep research query:

```javascript
node complete-perplexity-deep-research.cjs "What are the latest SaaS pricing strategies in 2025?"
```

This will:
1. Submit the query to Perplexity's deep research model
2. Store the poll URL for status checking
3. Set up a background process to monitor completion
4. Save results to the `test-results/deep-research` directory

## Response Format

Deep research responses include:

- `model` - The model used for the research
- `completion.text` - The comprehensive research result
- `completion.links` - Array of citation sources with URLs
- `completion.search_queries` - The search queries used to find information

## Limitations and Considerations

1. **Processing Time**: Deep research requests can take 15-30 minutes to complete
2. **API Limits**: There are rate limits on the number of deep research requests
3. **Polling Required**: All deep research requests require polling for completion
4. **Research Quality**: The quality depends on available sources for the topic
5. **API Key Permissions**: Only specific API keys have access to deep research models

## Development Notes

- For production use, implement proper job queue management with Redis
- Consider implementing webhook callbacks when available
- Log and monitor all research requests for tracking
- Implement proper error handling for long-running requests
- Store intermediate results for research that exceeds timeout limits