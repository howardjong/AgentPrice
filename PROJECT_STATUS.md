# Multi-LLM Research System Project Status

## Project Overview
This project is a sophisticated multi-AI chatbot backend service that leverages both Claude and Perplexity APIs to provide intelligent responses. The system includes:

1. **Intelligent Request Routing**: Routes requests between Claude and Perplexity based on query content
2. **Deep Research Capabilities**: Supports long-running research tasks using Perplexity's advanced capabilities
3. **Visualization Generation**: Creates interactive visualizations using Plotly.js
4. **Cost Optimization**: Implements various strategies to minimize API usage costs
5. **Real-time System Monitoring**: Monitors system health and API status via WebSockets

## Current Progress

### Completed Items
- ✅ Test suite migration from Jest to Vitest (71+ passing tests)
- ✅ Intelligent routing between Claude and Perplexity APIs based on query content
- ✅ Deep research workflow with follow-up capabilities
- ✅ Cost optimization implementation (prompt optimization, model tiering, caching)
- ✅ Visualization generation framework with support for:
  - Van Westendorp price sensitivity analysis
  - Conjoint analysis visualization
  - Custom chart generation
- ✅ Socket.IO implementation for real-time status updates
- ✅ System health monitoring dashboard
- ✅ Circuit breaker pattern for API resilience
- ✅ Robust error handling with graceful fallbacks

### In Progress
- ➡️ WebSocket connection stability improvements
- ➡️ Additional visualization types
- ➡️ TypeScript compatibility fixes
- ➡️ Documentation improvement

## Architecture Overview

### Backend Components
1. **Service Router**: Determines which AI service to use based on query content
   - Located in `server/services/router.ts`
   - Analyzes messages for research keywords and visualization requests
   - Supports explicit service selection via API

2. **Claude Service**: Manages communication with Claude AI
   - Located in `server/services/claude.ts`
   - Handles conversation processing and visualization generation
   - Supports model transparency (preserves model identity)

3. **Perplexity Service**: Manages communication with Perplexity AI
   - Located in `server/services/perplexity.ts`
   - Handles research queries with citation support
   - Supports both basic and deep research modes

4. **Job Manager**: Manages long-running research tasks
   - Uses Bull queue for job processing
   - Provides progress tracking and status reporting
   - Includes automatic recovery for stalled jobs

5. **Cost Optimization**: Reduces API usage costs
   - Implements prompt optimization techniques
   - Uses model tiering (smaller models for simpler tasks)
   - Caches responses to minimize duplicate API calls

### Frontend Components
1. **Dashboard**: Main administrative interface
   - Shows system status and API availability
   - Lists available endpoints and their functions
   - Provides chat interface for testing

2. **System Status Monitor**: Real-time system monitoring
   - Located in `client/src/components/SystemStatusMonitor.tsx`
   - Connects via Socket.IO for real-time updates
   - Displays API status, memory usage, and health metrics

3. **Chat Interface**: Testing interface for API services
   - Supports direct interaction with both Claude and Perplexity
   - Shows service selection and response details

## API Endpoints

### Primary Endpoints
- **POST /api/chat**: Intelligently routes between Claude and Perplexity
- **POST /api/conversation**: Direct conversation with Claude
- **POST /api/research**: Direct research queries with Perplexity
- **POST /api/visualize**: Generate visualizations using Claude

### Status and Testing Endpoints
- **GET /api/status**: Get current status of all connected services
- **GET /api/health**: Simplified health check for external monitoring
- **GET /api/assistant/health**: Health check that avoids API calls

### Visualization Testing
- **GET /api/test-visualization/van-westendorp**: Test Van Westendorp visualization
- **GET /api/test-visualization/conjoint**: Test Conjoint Analysis visualization

## High Priority Items Remaining

1. **API Key Management**:
   - Ensure proper handling of environment variables for API keys
   - Add key validation and error reporting

2. **Response Caching Implementation**:
   - Complete response caching system to reduce API calls
   - Implement cache invalidation logic

3. **Documentation**:
   - Create comprehensive API documentation
   - Add usage examples and best practices

4. **Performance Testing**:
   - Conduct load testing to validate system stability
   - Optimize response times for high-traffic scenarios

5. **UI Polish**:
   - Enhance dashboard layout and visualization
   - Improve mobile responsiveness

## Next Steps
1. Start the application and verify all components are functioning properly
2. Test Claude and Perplexity API connectivity with appropriate credentials
3. Complete any remaining high-priority items
4. Document deployment process and requirements