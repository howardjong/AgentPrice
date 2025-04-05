# Perplexity Deep Research System

This system provides a robust, asynchronous deep research capability using Perplexity's API, specifically with the `sonar-deep-research` model that can take up to 30 minutes to complete a comprehensive research task.

## Overview

The Deep Research System consists of multiple components that work together:

1. **Initial Request**: The `enhanced-polling-deep-research.js` script initiates deep research requests and stores intermediate state data.
2. **Asynchronous Processing**: Deep research often takes 20-30 minutes to complete, so we use a shell script that runs in the background.
3. **Status Checking**: The `check-deep-research-status.js` script allows you to check the status of ongoing research requests.
4. **Results Collection**: The `collect-deep-research-results.js` script gathers all research results into a comprehensive report.

## Key Files

- `enhanced-polling-deep-research.js`: Main script for initiating deep research requests
- `check-deep-research-status.js`: Script to check the status of research requests
- `collect-deep-research-results.js`: Script to collect and organize results
- `run-perplexity-deep-research.sh`: Shell script to run the entire process asynchronously

## Usage

### Running a Deep Research Request

To initiate a new deep research request:

```bash
node enhanced-polling-deep-research.js
```

This will start a research request with the default query about SaaS pricing strategies.

#### Command-line Options

- `--skip-polling`: Initiate the request but don't wait for completion (useful for long research)
- `--quick`: Use a simpler query for faster results
- `--query="Your research question here"`: Specify a custom research question

### Checking Research Status

To check the status of ongoing research requests:

```bash
node check-deep-research-status.js
```

### Collecting Results

To generate a report of all completed research:

```bash
node collect-deep-research-results.js
```

This will create a `deep-research-report.md` file that contains all the research results.

### Running the Entire Process in Background

To run the entire process asynchronously in the background:

```bash
./run-perplexity-deep-research.sh &
```

This will:
1. Initiate a deep research request
2. Wait 10 minutes
3. Check the status
4. Generate a report

## Data Storage

All data is stored in the following locations:

- `test-results/deep-research/`: Contains intermediate state data for research requests
- `test-results/deep-research-results/`: Contains completed research results
- `deep-research-report.md`: Final report with all research results

## Error Handling

The system is designed to handle various errors:

- API rate limiting
- Network failures
- Invalid model specifications
- Long-running requests that exceed normal timeouts

When errors occur, they are logged and saved to files for later inspection.

## Log Files

- `perplexity-deep-research-job-*.log`: Contains logs from the background job
- `enhanced-deep-research-test.log`: Contains logs from the enhanced polling script
- `perplexity-deep-research.log`: General logs about deep research operations

## Dependencies

- Node.js
- Axios for API requests
- UUID for generating unique request IDs
- Dotenv for environment variable management
- fs/promises for file operations

## Environment Setup

Make sure you have the Perplexity API key set in your environment:

```
PERPLEXITY_API_KEY=your_api_key_here
```

This can be set in the `.env` file or directly in the environment.
