
# Workflow Testing Documentation

This directory contains tests for end-to-end workflows that run through our multi-LLM research system. The tests are designed to validate that the core workflows function correctly in different scenarios and configurations.

## Testing Approach

As documented in `docs/test-plans/comprehensive-workflow-testing.md`, our approach emphasizes:

1. Reusing existing test components rather than creating redundant tests
2. Dual-mode testing (mock and real API modes)
3. Comprehensive coverage of all workflow aspects
4. Consistent metrics collection

## Directory Structure

- `/workflows/single-query-workflow/` - Core test framework for the single-query workflow
  - `test-runner.js` - Dual-mode test runner that works with mocks or real APIs
  - `mock-services.js` - Mock implementations for testing
  - `test-config.js` - Configuration for different test variants
  - `metrics-collector.js` - Standardized metrics collection
  - `test-registry.js` - Registry of available tests and coverage gaps

## Available Tests

The workflow tests are implemented in several locations:

1. **Vitest Unit Tests**:
   - `/unit/workflows/single-query-workflow.vitest.js` - Basic workflow test
   - `/unit/workflows/claude-chart-generation.vitest.js` - Chart generation tests
   - `/unit/workflows/perplexity-deep-research.vitest.js` - Deep research tests
   - `/unit/workflows/enhanced-single-query-workflow.vitest.js` - Enhanced coverage tests

2. **Manual Test Runners**:
   - `/manual/test-single-query-workflow.js` - CLI interface for testing
   - `/manual/testDeepResearch.js` - Deep research testing
   - `/manual/test-plotly-integration.js` - Visualization testing

## Running Tests

### Mock Mode (No API Keys Required)

```bash
# Run basic workflow test with mocks
node tests/manual/test-single-query-workflow.js --variant=basic

# View available test variants
node tests/manual/test-single-query-workflow.js --variant=list
```

### Real API Mode (Requires API Keys)

```bash
# Run with real APIs
node tests/manual/test-single-query-workflow.js --variant=basic --use-real-apis

# Test with a specific query
node tests/manual/test-single-query-workflow.js --query="What are the latest developments in quantum computing?" --use-real-apis
```

## Implementation Plan Status

As outlined in our comprehensive testing plan, we are currently in **Phase 1: Audit & Organization**:

- [x] Initial plan documentation
- [x] Core testing framework implementation
- [ ] Complete audit of existing tests
- [ ] Creation of test registry
- [ ] Gap analysis documentation

Next will be **Phase 2: Structure & Enhancement**, followed by **Phase 3: Validation & Coverage** and **Phase 4: Documentation & Reporting**.
