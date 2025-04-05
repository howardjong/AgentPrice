# Perplexity Deep Research Testing Guide

This document provides a comprehensive guide to testing the Perplexity deep research functionality with real API calls, using our job queue infrastructure.

## Overview

The Perplexity deep research capability is implemented using the `sonar-deep-research` model with high search context settings. This mode can take up to 30 minutes to complete for complex queries, requiring special handling:

1. **Asynchronous Processing**: Requests are queued and processed in the background using Bull job queues
2. **Job Management**: Jobs are tracked, progress is monitored, and results are stored for retrieval
3. **Polling Mechanism**: Long-running jobs are handled through polling to avoid timeout issues

## System Architecture

Our implementation consists of several key components:

- **perplexityService.js**: Core service for interacting with the Perplexity API, including the `conductDeepResearch` function that manages the multi-step research process
- **researchService.js**: Manages research jobs, integrating with the job queue system and handling result storage
- **jobManager.js**: Bull-based job queue system for processing background tasks
- **mockJobManager.js**: In-memory implementation for testing without Redis dependencies

## Testing With Real APIs

We have two main approaches for testing the deep research functionality:

### 1. Direct API Testing

For testing the direct interaction with the Perplexity API:

- `perplexity-deep-research-polled-test.js`: Tests the direct API calls with polling for completion
- `simple-perplexity-deep-research-test.js`: A simplified test focusing on the core deep research workflow

### 2. Full Workflow Testing

For testing the complete system with our job infrastructure:

- `test-deep-research-job-workflow.js`: Tests the entire workflow from job creation to result retrieval

## Running the Tests

### Prerequisites

1. Set the Perplexity API key in your environment:
   ```
   export PERPLEXITY_API_KEY=your_api_key_here
   ```

2. Ensure Redis is available or set USE_MOCK_JOB_MANAGER=true to use the in-memory job manager:
   ```
   export USE_MOCK_JOB_MANAGER=true
   ```

### Running the Tests

To test with direct API calls:
```
node perplexity-deep-research-polled-test.js
```

To test the full workflow with job queues:
```
node test-deep-research-job-workflow.js
```

## Expected Results

A successful test will:

1. Create a research job
2. Process the job through the Perplexity API
3. Poll for completion
4. Retrieve and format results
5. Save results to the `test-results/deep-research-workflow` directory

The results will include:
- The original query
- The research content
- Citations from credible sources
- Model information
- Processing metadata

## Troubleshooting

Common issues and solutions:

- **API Key Issues**: Ensure your Perplexity API key is valid and has access to the `sonar-deep-research` model
- **Redis Connection**: For workflow testing, ensure Redis is available or use the mock job manager
- **Rate Limiting**: The Perplexity API has a limit of 5 requests per minute; our implementation includes rate limiting
- **Timeout Errors**: Deep research can take 20-30 minutes; ensure polling parameters are set appropriately

## Implementation Details

### Deep Research Workflow

The deep research process consists of multiple steps:

1. **Initial Research**: First pass research on the main query
2. **Follow-up Questions**: Generation of follow-up questions to explore subtopics
3. **Follow-up Research**: Research on each follow-up question
4. **Synthesis**: Combining all research into a comprehensive answer

This workflow is implemented in `perplexityService.js` in the `conductDeepResearch` function.

### Job Queue Integration

The job queue integration manages the long-running process:

1. `researchService.startResearchJob()` creates a job in the queue
2. The job processor in `researchService.js` executes the deep research
3. Progress is updated throughout the process (10%, 60%, 90%, etc.)
4. Results are saved and returned upon completion

## Performance Considerations

- The `sonar-deep-research` model with high search context can take 20-30 minutes to complete
- Rate limiting is essential to avoid API timeouts (5 requests per minute)
- Results can be large, typically 4000-8000 tokens for comprehensive research