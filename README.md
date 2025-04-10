# Multi-LLM Research System

A sophisticated multi-AI chatbot backend service with advanced conversational intelligence, focusing on intelligent routing and multi-service AI interactions with enhanced model selection capabilities.

## Large Files Not Included in Repository

The following large files and directories are excluded from the repository but may be necessary for the application to function properly:

- **Test Output Files**: Large test result JSON files in `tests/output/` and `test-results/`
- **Coverage Reports**: Coverage data in `coverage/`, `coverage-report/`, and `reports/coverage/`
- **Log Files**: Application logs in `logs/` directory and any `*.log` files
- **Uploaded Content**: Any files in `uploads/` and `content-uploads/` directories
- **Attached Assets**: Reference files in `attached_assets/` directory
- **Deep Research Results**: Generated in `deep-research-*.log` and `perplexity-*.log` files
- **Asset Files**: Generated visualization assets in various `*/assets/` directories
- **Chart Data**: Visualization JSON files for Plotly charts and other visualization formats
- **Response Data**: Large API response files in `*-response-*.json` and `*-response-*.txt`

### Accessing Large Assets

When you need to work with the large files excluded from the repository, you can:

1. **Generate Test Data**: Run the appropriate workflow to generate the required test data:
   ```bash
   # For deep research results
   node tests/reset-circuit-breaker.js perplexity
   node tests/manual/test-improved-deep-research.js
   
   # For chart visualizations
   node tests/manual/test-plotly-integration-minimal.js
   ```

2. **Access Asset Files**: Asset files for visualizations can be generated and viewed using:
   ```bash
   # Generate visualization data
   node tests/manual/test-plotly-integration.js
   
   # Start a simple chart viewer server
   node tests/manual/serve-charts.js
   ```

3. **System Health and Memory Management**: Before working with large assets, run the memory optimization workflow:
   ```bash
   # Run memory optimization before processing large files
   node --expose-gc scripts/aggressive-memory-relief.js
   ```

4. **Temporary Storage**: Large files should be stored in the appropriate directories:
   - Research results: `test-results/` directory
   - Chart data: `tests/output/` directory
   - Uploaded files: `uploads/` or `content-uploads/` directory

5. **Cleanup Procedure**: Large files should be periodically cleaned up to maintain system performance:
   ```bash
   # Check file system health and identify cleanup candidates
   node tests/manual/fileSystemCheck.js
   ```

Note: When committing changes, ensure any large generated files are properly excluded according to the `.gitignore` patterns to avoid repository bloat.

## Technologies

- Node.js with ESM support
- TypeScript for type safety
- Multiple AI service integrations (Claude, Perplexity, Llama 3.1)
- Comprehensive unit and integration testing suite
- Advanced routing and service selection algorithms
- Intelligent prompt management framework
- Cost-optimized API interaction strategies
- React frontend with dynamic visualizations

## LLM Services

The system uses two primary LLM services:

### Claude Service (claudeService.js)

- Default model: `claude-3-7-sonnet-20250219` (released February 24, 2025)
- Fallback model: `claude-3-5-haiku-20241022`
- Used for conversation processing, chart generation, and data visualization
- Includes circuit breaker and robust API client implementations
- Model note: Testing has shown that the Claude API occasionally serves a different model than requested

### Perplexity Service (perplexityService.js)

- Basic model: `sonar` (default for most queries)
- Deep research model: `sonar-deep-research` (only used when deep research is explicitly requested)
- Provides internet research capabilities with configurable search modes
- Implements circuit breaker pattern and robust API client for reliability

## Research Service

- Coordinates between Claude and Perplexity services
- Intelligently routes requests based on need for internet access
- Manages job queues for long-running research tasks
- Implements both real and mock job managers for testing

## Testing

- Full test suite using Vitest (migrated from Jest)
- Unit tests for all services and utilities
- Integration tests for workflow verification
- Manual test scripts for specific workflows
- WebSocket event handler testing with event-driven patterns

### Testing Documentation

Detailed documentation has been created to explain testing patterns and improvements:

- [WebHook Event Handler Testing Improvements](docs/WEBHOOK_EVENT_HANDLER_TESTING_IMPROVEMENTS.md) - Best practices for Socket.IO testing
- [Context Manager Coverage Report](docs/CONTEXT_MANAGER_COVERAGE_REPORT.md) - Coverage improvement strategies
- [Prompt Manager Test Fixes](docs/PROMPT_MANAGER_TEST_FIXES.md) - Fixes for flaky prompt manager tests
- [Circuit Breaker Testing Patterns](docs/CIRCUIT_BREAKER_TESTING_PATTERNS.md) - Deterministic testing patterns

## Usage Guidelines

- The system defaults to using the `sonar` model for basic queries
- For deep research needs, the system automatically uses `sonar-deep-research`
- Visualization capabilities include both Van Westendorp and Conjoint Analysis chart types
- Cost optimization features help minimize API spending while maximizing capabilities

## Environment Variables

- `ANTHROPIC_API_KEY`: Required for Claude service
- `PERPLEXITY_API_KEY`: Required for Perplexity service
- `USE_MOCK_JOB_MANAGER`: Set to 'true' to use mock job manager (default: true)
- `REDIS_MODE`: Set to 'memory' for in-memory mode (default: 'memory')

## License

Proprietary - All rights reserved.