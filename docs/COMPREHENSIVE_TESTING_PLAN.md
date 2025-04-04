# Comprehensive Testing Plan for Single-Query Workflow

## Overview

This document outlines a comprehensive testing strategy for the Multi-LLM Research System's core capability: the single-query workflow that incorporates deep research and visualization generation. This workflow represents the primary value proposition of our application and requires thorough testing to ensure reliability and performance.

## Core Workflow Components

The single-query workflow consists of these major components:

1. **Query Processing** (Claude Service)
   - Clarifying question generation
   - User response processing
   - Optimized research prompt creation

2. **Deep Research** (Perplexity Service)
   - Initial broad research
   - Follow-up question generation
   - Follow-up research execution
   - Synthesis of research findings

3. **Chart Generation** (Claude Service)
   - Data extraction from research content
   - Chart data generation for various chart types
   - Plotly visualization configuration generation

4. **End-to-End Integration**
   - Seamless data flow between services
   - Proper error handling across boundaries
   - Performance and reliability characteristics

## Two-Tier Testing Approach

### Tier 1: Mock-Based Testing

**Purpose**: For rapid development, CI/CD integration, and testing without API keys

**Implementation**:
- Uses simulated responses for all external API calls
- Runs quickly and deterministically
- Does not incur API usage costs
- Tests sequence and logic, not actual API responses

**Test Scope**:
- Component integration
- Error handling
- Parameter validation
- Complex workflow logic
- Boundary conditions

### Tier 2: Live API Testing

**Purpose**: For validation of actual functionality with real data sources

**Implementation**:
- Uses real API calls to external services
- Validates that mocks accurately reflect real behavior
- Tests actual performance and behavior characteristics
- Validates full end-to-end functionality

**Test Scope**:
- Real-world performance
- Response quality validation
- Rate limit handling
- Integration with current API versions
- Credential validation

## Test Implementation Plan

### 1. Infrastructure Requirements

**Directory Structure**:
```
/tests/
  /workflows/
    /single-query-workflow/
      - mock-services.js            # Common mock implementations
      - test-runner.js              # Core test execution logic
      - test-suite.js               # Main test suite with variants
      - test-utils.js               # Helper functions
      - chart-validation.js         # Validation for chart data
      /tests/
        - basic.test.js             # Basic end-to-end test
        - performance.test.js       # Performance testing
        - reliability.test.js       # Testing across various query types
        - error-handling.test.js    # Error condition testing
      /fixtures/
        - test-queries.json         # Standard test queries
        - expected-responses.json   # Expected response patterns
```

**Environment Configuration**:
- `.env.test.mock` - For mock-based testing
- `.env.test.live` - For live API testing (with real API keys)

### 2. Mock Service Implementation

The mock service implementation will provide realistic simulation of:

**Claude Service Mocks**:
- Generate clarifying questions based on query content
- Process conversation history with context awareness
- Create chart data with realistic structure for different chart types
- Generate Plotly configurations with proper formatting

**Perplexity Service Mocks**:
- Simulate deep research process including multiple steps
- Return realistic citations and source information
- Implement follow-up question generation
- Return correctly formatted synthesis content

**Shared Mock Characteristics**:
- Realistic latency simulation
- Occasional error responses (for error handling testing)
- Consistent behavior for identical inputs
- Model information in responses

### 3. Test Runner Implementation

The test runner will provide a unified interface for both mock and live testing:

```javascript
async function testSingleQueryWorkflow({
  useRealAPIs = false,
  query = 'Default research query',
  visualizationType = 'bar',
  enableDeepResearch = true,
  saveResults = false,
  outputDir = './test-results'
}) {
  // Configure services based on mode
  const services = useRealAPIs 
    ? await initializeRealServices() 
    : initializeMockServices();
    
  console.log(`Running test in ${useRealAPIs ? 'LIVE API' : 'MOCK'} mode`);
  
  try {
    // Track test metrics
    const metrics = {
      startTime: Date.now(),
      stages: {}
    };
    
    // Stage 1: Initial Deep Research
    metrics.stages.research = { start: Date.now() };
    const researchResults = await services.perplexity.performDeepResearch(query, {
      enableChunking: true,
      model: enableDeepResearch ? 'llama-3.1-sonar-large-128k-online' : 'llama-3.1-sonar-small-128k-online'
    });
    metrics.stages.research.end = Date.now();
    
    // Stage 2: Data Extraction for Visualization
    metrics.stages.dataExtraction = { start: Date.now() };
    const chartData = await services.claude.generateChartData(
      researchResults.content,
      visualizationType
    );
    metrics.stages.dataExtraction.end = Date.now();
    
    // Stage 3: Chart Generation
    metrics.stages.chartGeneration = { start: Date.now() };
    const plotlyConfig = await services.claude.generatePlotlyVisualization(
      chartData.data,
      visualizationType,
      `${query} - ${visualizationType.toUpperCase()} Chart`,
      "Visualization based on deep research results"
    );
    metrics.stages.chartGeneration.end = Date.now();
    
    // Calculate total duration
    metrics.endTime = Date.now();
    metrics.totalDuration = metrics.endTime - metrics.startTime;
    
    // Assemble results
    const results = {
      query,
      researchContent: researchResults.content,
      chartData,
      plotlyConfig,
      metrics,
      sources: researchResults.citations || [],
      testMode: useRealAPIs ? 'LIVE' : 'MOCK'
    };
    
    // Optional: Save results to file for later analysis
    if (saveResults) {
      await saveTestResults(results, outputDir);
    }
    
    return results;
  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error.message,
      errorDetails: error,
      testMode: useRealAPIs ? 'LIVE' : 'MOCK'
    };
  }
}
```

### 4. Test Variants

#### Basic Test

Tests the complete workflow with a standard query:

```javascript
async function testBasicWorkflow(useLiveAPIs = false) {
  const results = await testSingleQueryWorkflow({
    useRealAPIs: useLiveAPIs,
    query: "What are the latest advancements in renewable energy storage technologies in 2025?",
    visualizationType: 'basic_bar',
    enableDeepResearch: true
  });
  
  // Validate results
  expect(results.success).not.toBe(false);
  expect(results.researchContent).toBeDefined();
  expect(results.researchContent.length).toBeGreaterThan(500);
  expect(results.chartData).toBeDefined();
  expect(results.plotlyConfig).toBeDefined();
  expect(results.plotlyConfig.data).toBeDefined();
  
  return results;
}
```

#### Performance Test

Measures performance characteristics across multiple runs:

```javascript
async function testWorkflowPerformance(useLiveAPIs = false) {
  const runs = 3;
  const results = [];
  
  for (let i = 0; i < runs; i++) {
    console.log(`Performance run ${i+1}/${runs}`);
    
    const result = await testSingleQueryWorkflow({
      useRealAPIs: useLiveAPIs,
      query: "Compare the environmental impact of electric vehicles vs hybrid vehicles in urban settings",
      enableDeepResearch: true,
      saveResults: true,
      outputDir: `./test-results/performance-run-${i+1}`
    });
    
    results.push(result);
  }
  
  // Calculate performance metrics
  const avgTotalDuration = results.reduce((sum, r) => sum + r.metrics.totalDuration, 0) / runs;
  const avgResearchDuration = results.reduce((sum, r) => sum + r.metrics.stages.research.duration, 0) / runs;
  const avgExtractionDuration = results.reduce((sum, r) => sum + r.metrics.stages.dataExtraction.duration, 0) / runs;
  const avgChartDuration = results.reduce((sum, r) => sum + r.metrics.stages.chartGeneration.duration, 0) / runs;
  
  return {
    mode: useLiveAPIs ? 'LIVE' : 'MOCK',
    runs,
    avgTotalDuration,
    avgResearchDuration,
    avgExtractionDuration,
    avgChartDuration,
    results
  };
}
```

#### Reliability Test

Tests across different query types and topics:

```javascript
async function testWorkflowReliability(useLiveAPIs = false) {
  const testQueries = [
    // Factual query
    "What are the top 5 cloud computing providers in 2025?",
    
    // Complex analytical query
    "Analyze the impact of generative AI on content creation industries between 2020-2025",
    
    // Numeric/statistical query (good for charts)
    "Compare the market share of major smartphone manufacturers in 2025",
    
    // Technical query
    "Explain the most promising quantum computing advancements of 2025",
    
    // Query with potential rate limiting
    "Provide a detailed analysis of climate change mitigation technologies with effectiveness statistics"
  ];
  
  const results = [];
  
  for (const query of testQueries) {
    console.log(`Testing query: "${query}"`);
    
    const result = await testSingleQueryWorkflow({
      useRealAPIs: useLiveAPIs,
      query,
      enableDeepResearch: true,
      saveResults: true
    });
    
    results.push({
      query,
      success: result.success !== false,
      error: result.error,
      duration: result.metrics?.totalDuration,
      sourcesCount: result.sources?.length
    });
  }
  
  // Calculate reliability statistics
  const successRate = results.filter(r => r.success).length / results.length;
  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
  
  return {
    mode: useLiveAPIs ? 'LIVE' : 'MOCK',
    queries: testQueries.length,
    successRate,
    avgDuration,
    results
  };
}
```

#### Error Handling Test

Tests the system's response to various error conditions:

```javascript
async function testErrorHandling(useLiveAPIs = false) {
  // Test 1: Invalid API Keys
  const invalidApiKeyTest = async () => {
    const originalKey = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = 'invalid-key';
    
    try {
      const result = await testSingleQueryWorkflow({
        useRealAPIs: useLiveAPIs,
        query: "Short test query for error handling"
      });
      
      return {
        test: 'invalidApiKey',
        detectedError: !!result.error,
        errorMessage: result.error,
        status: !!result.error ? 'passed' : 'failed'
      };
    } finally {
      // Restore original key
      process.env.PERPLEXITY_API_KEY = originalKey;
    }
  };
  
  // Test 2: Rate Limiting
  const rateLimitTest = async () => {
    // For mock mode, simulate rate limiting
    // For live mode, this may actually trigger rate limits
    
    try {
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await testSingleQueryWorkflow({
          useRealAPIs: useLiveAPIs,
          query: `Rate limit test query ${i+1}`,
          enableDeepResearch: false // Use simpler queries to avoid excessive usage
        });
        results.push(result);
      }
      
      const errors = results.filter(r => r.error && r.error.includes('rate'));
      
      return {
        test: 'rateLimit',
        queriesRun: results.length,
        errorsEncountered: errors.length,
        errorMessage: errors[0]?.error,
        status: errors.length > 0 ? 'passed' : 'skipped'
      };
    } catch (error) {
      return {
        test: 'rateLimit',
        error: error.message,
        status: error.message.includes('rate') ? 'passed' : 'failed'
      };
    }
  };
  
  // Run all tests
  const testResults = await Promise.all([
    invalidApiKeyTest(),
    rateLimitTest()
  ]);
  
  return {
    mode: useLiveAPIs ? 'LIVE' : 'MOCK',
    results: testResults,
    passedTests: testResults.filter(t => t.status === 'passed').length,
    failedTests: testResults.filter(t => t.status === 'failed').length,
    skippedTests: testResults.filter(t => t.status === 'skipped').length
  };
}
```

### 5. Visualization Validation

Special attention is needed for validating chart data and Plotly configurations:

```javascript
// Chart data validation
function validateChartData(chartData, chartType) {
  // Common validations
  expect(chartData).toBeDefined();
  expect(chartData.data).toBeDefined();
  expect(chartData.insights).toBeDefined();
  expect(Array.isArray(chartData.insights)).toBe(true);
  
  // Type-specific validations
  switch (chartType) {
    case 'van_westendorp':
      expect(chartData.data.x_values).toBeDefined();
      expect(Array.isArray(chartData.data.x_values)).toBe(true);
      expect(chartData.data.too_cheap).toBeDefined();
      expect(chartData.data.bargain).toBeDefined();
      expect(chartData.data.expensive).toBeDefined();
      expect(chartData.data.too_expensive).toBeDefined();
      break;
      
    case 'conjoint':
      expect(chartData.data.attributes).toBeDefined();
      expect(Array.isArray(chartData.data.attributes)).toBe(true);
      expect(chartData.data.importance).toBeDefined();
      expect(Array.isArray(chartData.data.importance)).toBe(true);
      expect(chartData.data.part_worths).toBeDefined();
      break;
      
    case 'basic_bar':
      expect(chartData.data.competitors).toBeDefined();
      expect(Array.isArray(chartData.data.competitors)).toBe(true);
      expect(chartData.data.prices).toBeDefined();
      expect(Array.isArray(chartData.data.prices)).toBe(true);
      break;
  }
  
  return true;
}

// Plotly configuration validation
function validatePlotlyConfig(plotlyConfig, chartType) {
  expect(plotlyConfig).toBeDefined();
  expect(plotlyConfig.data).toBeDefined();
  expect(Array.isArray(plotlyConfig.data)).toBe(true);
  expect(plotlyConfig.layout).toBeDefined();
  expect(plotlyConfig.config).toBeDefined();
  
  // Type-specific validations
  switch (chartType) {
    case 'van_westendorp':
      expect(plotlyConfig.data.length).toBeGreaterThanOrEqual(4); // Four curves
      expect(plotlyConfig.pricePoints).toBeDefined();
      break;
      
    case 'conjoint':
      expect(plotlyConfig.optimalCombination).toBeDefined();
      break;
      
    case 'basic_bar':
      expect(plotlyConfig.data[0].type).toBe('bar');
      break;
  }
  
  return true;
}
```

## Integration and CI/CD

### GitHub Actions Workflow

```yaml
name: Single Query Workflow Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:
    inputs:
      run_live_tests:
        description: 'Run tests with live APIs'
        required: false
        default: 'false'

jobs:
  mock-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
      - name: Run mock-based workflow tests
        run: npm run test:workflow:mock
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: mock-test-results
          path: ./test-results

  live-tests:
    if: github.event.inputs.run_live_tests == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
      - name: Run live API workflow tests
        run: npm run test:workflow:live
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }}
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: live-test-results
          path: ./test-results
```

## Implementation Roadmap

### Phase 1: Basic Framework (Week 1)
- Create directory structure
- Implement mock services
- Create basic test runner
- Implement first basic test

### Phase 2: Extended Test Variants (Week 2)
- Implement performance test
- Implement reliability test
- Implement error handling test
- Develop test result storage/analysis

### Phase 3: CI/CD Integration (Week 3)
- Create GitHub Action workflow
- Configure environment variables
- Setup artifact storage
- Document CI/CD process

### Phase 4: Validation and Refinement (Week 4)
- Run live API tests
- Compare mock vs live behavior
- Refine mocks based on real behavior
- Update documentation

## Benefits of This Approach

1. **Dual-mode testing**: Run tests in both mock and live API modes
2. **Comprehensive coverage**: Test all aspects of the workflow
3. **Realistic simulation**: Mock behavior closely matches real services
4. **Performance measurement**: Consistent metrics for benchmarking
5. **Reliability testing**: Systematic testing of diverse query types
6. **CI/CD friendly**: Mock-based tests run quickly without API keys
7. **Visualization validation**: Specialized validation for Plotly charts

## Recommendations for Future Enhancement

1. **Expansion to Additional Chart Types**: Add tests for new visualization types
2. **Historical Performance Tracking**: Store and analyze performance over time
3. **Parameterized Testing**: Generate test cases from parameters for greater coverage
4. **Integration with Monitoring**: Use test results to inform monitoring thresholds
5. **Mock Fidelity Improvement**: Continuously refine mocks to match real API behavior

## Conclusion

This comprehensive testing plan ensures that our application's core functionality - the single-query workflow incorporating deep research and visualization - is thoroughly tested using both mock-based and live API approaches. By implementing this plan, we can confidently make changes to the system while ensuring that the core workflow continues to function correctly.