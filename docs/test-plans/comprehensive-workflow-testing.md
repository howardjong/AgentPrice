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

3. **Data Extraction** (Claude Service)
   - Pattern recognition in research content
   - Data point identification and extraction
   - Statistical information formatting

4. **Visualization Creation** (Claude Service)
   - Chart type selection and configuration
   - Data transformation for visualization
   - Plotly configuration generation
   - Insight generation from visual data

## Two-Tier Testing Strategy

To effectively test this workflow, we employ a two-tier strategy:

### Tier 1: Mock-Based Testing

**Purpose:** Day-to-day development testing and CI/CD pipeline integration

**Characteristics:**
- Uses mock implementations of Claude and Perplexity services
- Deterministic responses based on input queries
- Fast execution time (seconds instead of minutes)
- No API costs or rate limits
- Suitable for automated testing

**Implementation Details:**
- Mock services simulate realistic processing times
- Response content scaled based on query complexity
- Fixed but representative data samples for visualization
- Configurable error scenarios for resilience testing

### Tier 2: Live API Testing

**Purpose:** Validate real-world behavior and performance

**Characteristics:**
- Uses actual Claude and Perplexity API services
- Production-equivalent environment
- Authentic API responses and error conditions
- Subject to real-world constraints (rate limits, timeouts)
- Used for release validation and periodic system checks

**Implementation Details:**
- Requires valid API keys for both services
- Executes complete end-to-end workflow
- Collects detailed metrics on API performance
- Retains sample output for regression testing

## Test Variants

Within each tier, we implement the following test variants:

### Basic End-to-End Test

- Executes the complete workflow with default settings
- Verifies successful completion of all stages
- Validates expected output format at each stage
- Confirms final visualization is properly generated

### Performance Test

- Measures execution time of each workflow component
- Records API response times and processing overhead
- Tracks token usage and other consumption metrics
- Establishes performance baselines for comparison

### Reliability Test

- Executes workflow repeatedly with variation
- Tests different query complexities and chart types
- Validates handling of edge cases (very long research, minimal data)
- Simulates error conditions and verifies recovery

### Deep Research Variation Test

- Tests multiple research depths (basic vs. comprehensive)
- Validates follow-up question generation and execution
- Measures impact of research depth on quality and performance
- Verifies citation processing and attribution

## Metrics Collection

During test execution, we collect the following metrics:

### Timing Metrics
- Total workflow execution time
- Per-component execution time
- API response latency
- Processing overhead

### Quality Metrics
- Research content length and relevance
- Citation count and quality
- Data point extraction accuracy
- Visualization clarity and appropriateness

### Resource Metrics
- Token usage by model
- API call count
- Request/response payload sizes
- Error rates and types

## Test Implementation Approach

Our implementation approach follows these principles:

1. **Service Abstraction**
   - Consistent interface for both mock and real services
   - Service factory pattern for easy switching between tiers
   - Clear separation between workflow logic and service implementation

2. **Deterministic Testing**
   - Seed values for consistent mock responses
   - Timestamp-based result tracking
   - Snapshots of expected outputs for comparison

3. **Comprehensive Logging**
   - Detailed progress tracking at each stage
   - Error capturing with context
   - Performance metric recording

4. **Result Storage**
   - Test results saved in structured format
   - Historical comparison capability
   - Sample output preservation for debugging

## Mock Implementation Strategy

Our mock services implement these features:

1. **Claude Service Mocks**
   - Deterministic response generation based on input
   - Realistic processing time simulation
   - Multiple chart type support
   - Configurable error injection

2. **Perplexity Service Mocks**
   - Query-relevant content generation
   - Follow-up question simulation
   - Citation generation
   - Variable response time based on query complexity

## Test Runner Implementation

The test runner implements these capabilities:

1. **Configuration**
   - Service tier selection (mock vs. real)
   - Query customization
   - Visualization type selection
   - Result storage options

2. **Execution Control**
   - Timeout handling
   - Error recovery
   - Progress reporting
   - Environment validation

3. **Results Processing**
   - Structured output format
   - Success/failure determination
   - Metrics compilation
   - Result storage

## CI/CD Integration

This testing strategy integrates with CI/CD as follows:

1. **Pull Request Validation**
   - Executes Tier 1 (mock) tests for each PR
   - Verifies workflow functionality with mocked services
   - Fast feedback loop for developers

2. **Release Validation**
   - Executes both Tier 1 and limited Tier 2 tests
   - Validates with real APIs before deployment
   - Generates performance and quality metrics

3. **Schedule Testing**
   - Periodic Tier 2 tests with various queries
   - Tracks performance trends over time
   - Identifies degradation early

## Implementation Approach

Rather than creating redundant test files, we'll enhance and organize existing workflow test components to achieve comprehensive coverage while maintaining a clean, maintainable test suite.

### Leveraging Existing Components

We already have several critical workflow test components in place:

1. **Core Test Structure**:
   - `/tests/workflows/single-query-workflow/test-runner.js` - Dual-mode test runner that works with mocks or real APIs
   - `/tests/workflows/single-query-workflow/mock-services.js` - Mock implementations for testing

2. **Manual Test Runners**:
   - `/tests/manual/test-single-query-workflow.js` - CLI interface for manual workflow testing
   - `/tests/manual/testDeepResearch.js` - Tests for deep research functionality

3. **Vitest/Jest Workflow Tests**:
   - `/tests/unit/workflows/single-query-workflow.vitest.js`
   - `/tests/unit/workflows/claude-chart-generation.vitest.js`
   - `/tests/unit/workflows/perplexity-deep-research.vitest.js`

### Enhancement Strategy

Instead of creating new, potentially redundant tests, we'll:

1. **Enhance Existing Components**:
   - Extend the dual-mode test runner to support all test variants (basic, performance, reliability, error)
   - Add consistent metrics collection to existing workflow tests
   - Ensure existing tests can run in both mock and real API modes

2. **Structure Test Output**:
   - Standardize result formats for easier analysis
   - Implement comprehensive logging for debugging
   - Create consistent test results storage

3. **Categorize Tests**:
   - Organize existing tests into logical categories
   - Document test coverage by workflow component
   - Create an index of available tests and what they validate

### Integration with CI/CD

We'll adapt existing GitHub Actions to run our workflow tests:
- Mock mode for regular PR validation
- Real API mode for scheduled validation (less frequent)

## Implementation Plan

### Phase 1: Audit & Organization (Week 1)
- Audit existing test files to identify coverage gaps
- Document existing test capabilities and parameters
- Create a centralized registry of workflow tests

### Phase 2: Structure & Enhancement (Week 2)
- Enhance test-runner.js to support additional test types
- Standardize metrics collection across all workflow tests
- Implement standardized test result storage and formatting

### Phase 3: Validation & Coverage (Week 3)
- Run comprehensive test suite to identify any remaining gaps
- Add targeted tests for any uncovered workflow paths
- Validate dual-mode operation (mock and real API)

### Phase 4: Documentation & Reporting (Week 4)
- Create comprehensive documentation of test suite
- Implement test reporting dashboard
- Document best practices for workflow testing


## Benefits of This Approach

1. **Reuse over redundancy**: Leverages existing test components to avoid duplication
2. **Dual-mode testing**: Consistently supports both mock and live API modes
3. **Comprehensive coverage**: Organizes tests to ensure coverage of all workflow aspects
4. **Reduced maintenance burden**: Fewer files and more focused test variations
5. **Consistent metrics**: Standardized performance and reliability measurements
6. **CI/CD friendly**: Mock-based tests run quickly without API keys
7. **Real-world validation**: Ability to validate against actual APIs when needed
8. **Visualization validation**: Specialized validation for Plotly charts
9. **Streamlined documentation**: Clearer organization of testing capabilities

## Implementation Notes

### Accommodating Real API Calls

Our testing strategy requires only minor adjustments to support real API calls:

1. **Environment Variable Support**:
   - The test-runner.js already includes support for loading environment variables
   - Tests can switch between mock and real mode with a simple flag

2. **Rate Limiting Considerations**:
   - When running with real APIs, tests automatically use more conservative batching
   - API key validation occurs before any tests execute

3. **Error Handling**:
   - Tests include robust error handling for both mock and real API failures
   - Detailed logs capture actual API responses for debugging

## Conclusion

This comprehensive testing approach ensures that our application's core functionality - the single-query workflow incorporating deep research and visualization - is thoroughly tested using both mock-based and live API approaches. By building on our existing test infrastructure rather than creating redundant tests, we maintain a cleaner, more maintainable codebase while ensuring comprehensive test coverage. This approach will let us confidently make changes to the system while ensuring that core workflows continue to function correctly.