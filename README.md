# Multi-LLM Research System

A sophisticated multi-AI chatbot backend service with advanced conversational intelligence, focusing on intelligent routing and multi-service AI interactions with enhanced model selection capabilities.

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

- Full test suite using Vitest
- Unit tests for all services and utilities
- Integration tests for workflow verification
- Manual test scripts for specific workflows

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