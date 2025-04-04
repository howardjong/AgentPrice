/**
 * Query Workflow Test Guide
 * ========================
 *
 * This document provides comprehensive guidance on using the single query workflow test
 * system, which allows both mock-based testing (default for CI/CD) and live API testing
 * (for validation and verification with real data).
 */

/**
 * Overview
 * --------
 * 
 * The Single Query Workflow Test verifies the complete path of a search query through the system:
 * 
 * 1. Generation of clarifying questions (Claude API)
 * 2. Collection of user responses (simulated)
 * 3. Creation of an optimized research prompt (Claude API)
 * 4. Deep research query execution (Perplexity API)
 * 5. Analysis and visualization of results (Claude API)
 * 
 * This test has been implemented in two forms:
 * 
 * 1. The original manual test (tests/manual/test-single-query-workflow.js)
 * 2. The new Vitest-based test (tests/vitest/workflows/single-query-workflow.vitest.js)
 * 
 * The Vitest version supports both mock and live API modes and is integrated into our CI/CD pipeline.
 */

/**
 * Key Features
 * ------------
 * 
 * - Default Mock Mode: Uses pre-defined mock data for all API calls
 * - Optional Live Mode: Can use real API calls for validation with actual data
 * - Comprehensive Test Coverage: Tests all steps of the workflow
 * - Explicit Control: Live API calls are only made when explicitly enabled
 * - Output Preservation: All test results are saved to the tests/output directory
 * - Convenient Runner: Simple script to run the test with different options
 */

/**
 * Running the Tests
 * ----------------
 * 
 * The test can be run in multiple ways:
 * 
 * 1. Using the convenience script (easiest):
 * 
 * ```bash
 * # Run with mock data (default, recommended for most cases)
 * node scripts/run-query-workflow-test.js
 * 
 * # Run with live APIs (requires API keys, may incur costs)
 * node scripts/run-query-workflow-test.js --live
 * 
 * # Show help information
 * node scripts/run-query-workflow-test.js --help
 * ```
 * 
 * 2. Using Vitest directly:
 * 
 * ```bash
 * # Run with mock data
 * USE_LIVE_APIS=false npx vitest run tests/vitest/workflows/single-query-workflow.vitest.js
 * 
 * # Run with live APIs
 * USE_LIVE_APIS=true npx vitest run tests/vitest/workflows/single-query-workflow.vitest.js
 * ```
 * 
 * 3. Programmatically from other scripts:
 * 
 * ```javascript
 * const { runWithLiveApis } = require('../tests/vitest/workflows/single-query-workflow.vitest.js');
 * 
 * // Run the test with live APIs
 * await runWithLiveApis();
 * ```
 */

/**
 * Required Environment Variables for Live Mode
 * -------------------------------------------
 * 
 * To run the test with live APIs, the following environment variables must be set:
 * 
 * - ANTHROPIC_API_KEY: API key for Anthropic/Claude
 * - PERPLEXITY_API_KEY: API key for Perplexity
 * 
 * These can be set in your .env file or directly in your environment.
 */

/**
 * Test Output
 * -----------
 * 
 * All test results are saved to the tests/output directory:
 * 
 * - clarifying-questions.json: Generated clarifying questions
 * - optimized-query.txt: Enhanced research prompt
 * - research-results.json: Results from the deep research
 * - van_westendorp-chart.json: Price sensitivity chart data
 * - conjoint-chart.json: Attribute importance chart data
 * - basic_bar-chart.json: Competitive pricing chart data
 * - complete-workflow-results.json: Complete workflow results
 * 
 * These files can be examined to see the detailed outputs at each step.
 */

/**
 * When to Use Each Mode
 * --------------------
 * 
 * Mock Mode:
 * - CI/CD pipelines
 * - Local development
 * - Test structure validation
 * - Fast feedback loops
 * - No API costs incurred
 * 
 * Live Mode:
 * - Integration validation
 * - Data format validation
 * - Performance testing
 * - Pre-release verification
 * - Checking for API changes
 * 
 * Note: Live mode should be used sparingly as it may incur API costs.
 */

/**
 * Implementation Details
 * --------------------
 * 
 * The test uses Vitest's mocking capabilities to replace API calls with mock data:
 * 
 * ```javascript
 * // Example of mock implementation
 * vi.spyOn(claudeService, 'generateClarifyingQuestions').mockResolvedValue(MOCK_DATA.clarifyingQuestions);
 * ```
 * 
 * All mocks are conditionally applied based on the USE_LIVE_APIS environment variable:
 * 
 * ```javascript
 * if (!USE_LIVE_APIS) {
 *   // Apply mocks
 * } else {
 *   console.log('Using LIVE API calls');
 * }
 * ```
 * 
 * This ensures that actual API calls are only made when explicitly requested.
 */

/**
 * Best Practices
 * -------------
 * 
 * 1. Always use mock mode for regular development and testing
 * 2. Reserve live mode for final validation before releases
 * 3. Update mock data when API responses change
 * 4. Keep sensitive API keys out of source control
 * 5. Periodically validate that mock data matches real responses
 * 6. Use timeouts that account for real API latency in live mode
 * 7. Save and compare outputs between mock and live modes to identify discrepancies
 */

/**
 * Example: Adding a New Test Case
 * ------------------------------
 * 
 * To add a new test case to the workflow:
 * 
 * 1. Add a new test in the describe block:
 * 
 * ```javascript
 * it('should handle a new capability', async () => {
 *   // Test implementation
 * });
 * ```
 * 
 * 2. Add corresponding mock data to the MOCK_DATA object:
 * 
 * ```javascript
 * const MOCK_DATA = {
 *   // Existing mock data...
 *   
 *   // New mock data
 *   newFeatureResponse: {
 *     // Mock response data
 *   }
 * };
 * ```
 * 
 * 3. Apply conditional mocking:
 * 
 * ```javascript
 * if (!USE_LIVE_APIS) {
 *   vi.spyOn(someService, 'newMethod').mockResolvedValue(MOCK_DATA.newFeatureResponse);
 * }
 * ```
 * 
 * 4. Add the test logic that works with both mock and live modes
 */

/**
 * Troubleshooting
 * --------------
 * 
 * Common Issues:
 * 
 * 1. Missing API Keys
 *    - Error: "Missing required API keys for live mode"
 *    - Solution: Set the required environment variables or run in mock mode
 * 
 * 2. API Rate Limiting
 *    - Error: "429 Too Many Requests"
 *    - Solution: Add delay between API calls or reduce test frequency
 * 
 * 3. Mock Data Mismatch
 *    - Error: "Expected property X but got undefined"
 *    - Solution: Update mock data to match current API responses
 * 
 * 4. Timeout Issues
 *    - Error: "Timeout waiting for test completion"
 *    - Solution: Increase test timeout for live API tests (e.g., `60000` for 60 seconds)
 */

/**
 * References
 * ---------
 * 
 * - Vitest Documentation: https://vitest.dev/
 * - Anthropic API Docs: https://docs.anthropic.com/
 * - Perplexity API Docs: https://docs.perplexity.ai/
 * - Original Test Implementation: tests/manual/test-single-query-workflow.js
 * - Vitest Implementation: tests/vitest/workflows/single-query-workflow.vitest.js
 */

// This file is documentation only and does not export any functionality
console.log('This file contains documentation in comments and should not be executed directly.');

// Export empty object for ESM compatibility
module.exports = {};