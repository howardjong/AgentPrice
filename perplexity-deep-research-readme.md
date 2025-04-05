# Perplexity Deep Research Implementation

This document provides an overview of the Perplexity Deep Research implementation in our multi-LLM research project.

## Current Status

As of April 5, 2025, we have:

- ✅ Successfully connected to the Perplexity API
- ✅ Working implementation for the `llama-3.1-sonar-small-128k-online` model
- ✅ Developed a robust polling mechanism for deep research
- ⚠️ Encountered issues with the deep research capability

## Implementation Notes

### Working Components

1. **Basic API Integration**
   - Authentication via API key
   - Error handling with retry logic
   - Circuit breaker pattern for API stability

2. **Standard Research**
   - Fast responses (seconds) using `llama-3.1-sonar-small-128k-online`
   - Citation extraction and processing
   - Content formatting

3. **Deep Research Infrastructure**
   - Request formatting with proper parameters
   - Poll URL extraction mechanism
   - Response processing logic
   - Results storage and organization

### Current Challenges

The `sonar-deep-research` model appears to either:

1. Not be available with our current API access
2. Have changed naming conventions in recent API updates
3. Require additional authentication or parameters

### Next Steps

1. **API Key Verification**
   - Confirm our API key has proper permissions for deep research
   - Request updated documentation on available models

2. **Alternative Implementation**
   - Use multiple standard research queries in sequence
   - Implement client-side result aggregation
   - Adapt the current polling mechanism for non-deep research requests

3. **Testing Strategy**
   - Continue testing with various model configurations
   - Implement detailed logging of all API interactions
   - Develop mock responses for testing without API access

## Usage

The `perplexityService.js` module provides:

- `query()` - Standard research queries (fast, seconds)
- `initiateDeepResearch()` - Start deep research (may take ~30min)
- `pollForResults()` - Check status of ongoing research
- `conductDeepResearch()` - End-to-end research with polling

Example:

```javascript
const perplexityService = require('./services/perplexityService');

// Quick standard query
const result = await perplexityService.query(
  "What are the latest pricing strategies for SaaS companies?",
  { model: "llama-3.1-sonar-small-128k-online" }
);

// Deep research (if available)
const deepResult = await perplexityService.conductDeepResearch(
  "Provide a comprehensive analysis of SaaS pricing strategies across different market segments in 2025, including examples and comparative data."
);
```

## Testing

To test the deep research functionality:

1. Run the test script:
   ```
   ./run-deep-research-background.sh
   ```

2. Monitor the logs:
   ```
   cat perplexity-deep-research-job-*.log | tail -50
   ```

3. Check for completed results:
   ```
   ls -la test-results/deep-research-results/
   ```