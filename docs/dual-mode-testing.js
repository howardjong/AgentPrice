/**
 * Dual-Mode Testing Documentation
 * ==============================
 *
 * This document describes the dual-mode testing approach used for testing the multi-LLM
 * research system, which supports both mock API testing and live API testing modes.
 */

/**
 * Overview
 * --------
 *
 * The dual-mode testing approach allows tests to be run in either:
 * 
 * 1. Mock Mode: Uses Nock to intercept HTTP requests and return pre-defined responses
 * 2. Live Mode: Makes actual API calls to external services (Claude, Perplexity, etc.)
 *
 * This approach provides several benefits:
 * - Fast, deterministic testing with mocks during development
 * - Verification with real APIs before deployment
 * - Realistic test data for edge case handling
 * - Continuous validation of API contract changes
 */

/**
 * Configuration
 * -------------
 *
 * Tests can be configured through environment variables:
 *
 * - USE_LIVE_API=true|false
 *   Whether to use real API calls or mock responses
 *
 * - SKIP_EXPENSIVE_CALLS=true|false
 *   When true, skips tests that would make expensive API calls
 *   Typically used with USE_LIVE_API=true to run only essential tests
 *
 * - API keys (ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, etc.)
 *   Required when USE_LIVE_API=true
 */

/**
 * Running Dual-Mode Tests
 * ----------------------
 *
 * The project includes a helper script for running dual-mode tests:
 *
 * ```bash
 * # Run in mock mode (default)
 * ./scripts/run-dual-mode-tests.sh mock
 *
 * # Run in live mode, skip expensive calls
 * export ANTHROPIC_API_KEY=your_key_here
 * export PERPLEXITY_API_KEY=your_key_here
 * ./scripts/run-dual-mode-tests.sh live-cheap
 *
 * # Run in live mode, including all tests (expensive)
 * export ANTHROPIC_API_KEY=your_key_here
 * export PERPLEXITY_API_KEY=your_key_here
 * ./scripts/run-dual-mode-tests.sh live-full
 * ```
 */

/**
 * Test Output
 * ----------
 *
 * Tests generate output files in the tests/output directory:
 *
 * - optimized-query-[live|mock].txt
 *   The optimized research query generated by Claude
 *
 * - deep-research-[live|mock].json
 *   The research results from Perplexity
 *
 * - [chart_type]-chart-[live|mock].json
 *   The chart data generated by Claude
 *
 * - complete-workflow-[live|mock].json
 *   The complete workflow results
 */

/**
 * Implementation Details
 * --------------------
 *
 * The dual-mode tests are implemented with several key patterns:
 *
 * 1. Conditional Service Loading
 *    ```javascript
 *    if (USE_LIVE_API) {
 *      // Import and use real services
 *      service = await import('../../services/realService.js');
 *    } else {
 *      // Use mock implementations
 *      service = { method: vi.fn().mockResolvedValue(mockResponse) };
 *    }
 *    ```
 *
 * 2. Test Skipping Logic
 *    ```javascript
 *    if (USE_LIVE_API && SKIP_EXPENSIVE_CALLS) {
 *      console.log('Skipping expensive API call');
 *      return;
 *    }
 *    ```
 * 
 * 3. Output File Differentiation
 *    ```javascript
 *    const outputPath = path.join(outputDir, `result-${USE_LIVE_API ? 'live' : 'mock'}.json`);
 *    ```
 *
 * 4. Nock Setup for Mock Mode
 *    ```javascript
 *    if (!USE_LIVE_API) {
 *      nock('https://api.example.com')
 *        .post('/endpoint')
 *        .reply(200, mockResponse);
 *    }
 *    ```
 */

/**
 * Best Practices
 * -------------
 *
 * 1. Make tests runnable in both modes when possible
 * 2. Use meaningful mock data that resembles real API responses
 * 3. Handle API key validation early and provide clear error messages
 * 4. Include reasonable timeouts for live API calls
 * 5. Save outputs for debugging and analysis
 * 6. Run tests in mock mode before committing changes
 * 7. Run tests in live mode before deploying to production
 */

// Export some utility functions that can be used by tests
module.exports = {
  /**
   * Utility to conditionally skip a test if in live mode with expensive calls disabled
   */
  skipIfExpensiveLiveTest: function(testFn, useRealApi, skipExpensive) {
    if (useRealApi && skipExpensive) {
      console.log('⏭️ Skipping expensive API call');
      return Promise.resolve();
    }
    return testFn();
  },
  
  /**
   * Formats a filename with mode suffix
   */
  getModeSuffixedFilename: function(basename, useRealApi, extension) {
    return `${basename}-${useRealApi ? 'live' : 'mock'}.${extension}`;
  }
};