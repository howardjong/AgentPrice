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

## Implementation Plan

The implementation sequence is as follows:

1. **Setup Testing Infrastructure**
   - Create test directory structure
   - Implement test result storage mechanism
   - Define metrics collection framework

2. **Implement Mock Services**
   - Create Claude service mocks
   - Create Perplexity service mocks
   - Implement realistic response generation

3. **Build Test Runner**
   - Implement configuration handling
   - Create service initialization logic
   - Build execution and metrics collection

4. **Create Test Variants**
   - Implement basic end-to-end test
   - Build performance test
   - Create reliability test
   - Implement research variation test

5. **Set Up CI/CD Integration**
   - Configure PR validation tests
   - Implement release validation
   - Configure scheduled testing

## Conclusion

This comprehensive testing strategy ensures that our single-query workflow maintains reliability, performance, and quality throughout the development lifecycle. By employing a two-tier approach, we balance the need for rapid development feedback with thorough validation of real-world behavior.
