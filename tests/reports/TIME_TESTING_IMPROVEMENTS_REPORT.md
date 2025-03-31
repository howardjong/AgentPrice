# Time Testing Improvement Report

Found 25 potential issues in 17 files.

## Issue Types

- **dateNowUsage**: 52 occurrences
- **setTimeoutWithoutMock**: 11 occurrences
- **setIntervalWithoutMock**: 2 occurrences
- **directPerformanceNow**: 18 occurrences
- **advanceTimersByTime**: 17 occurrences
- **realTimeDependentTests**: 1 occurrences

## Files with Issues

### tests/examples/improved-time-testing-example.vitest.js

✅ Already imports time-testing-utils

Issues:

- **directPerformanceNow** (2 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock performance.now for consistent test results
- **dateNowUsage** (1 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results
- **setTimeoutWithoutMock** (1 occurrences)
  - Suggestion: Ensure setTimeout is properly mocked using TimeController or vi.useFakeTimers
- **setIntervalWithoutMock** (1 occurrences)
  - Suggestion: Ensure setInterval is properly mocked using TimeController or vi.useFakeTimers
- **advanceTimersByTime** (3 occurrences)
  - Suggestion: Consider using timeController.advanceTime for more control over time progression

### tests/unit/utils/apiClient.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (8 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results
- **setTimeoutWithoutMock** (3 occurrences)
  - Suggestion: Ensure setTimeout is properly mocked using TimeController or vi.useFakeTimers
- **setIntervalWithoutMock** (1 occurrences)
  - Suggestion: Ensure setInterval is properly mocked using TimeController or vi.useFakeTimers

### tests/unit/utils/performanceNowMock.vitest.js

❌ Does not import time-testing-utils

Issues:

- **directPerformanceNow** (16 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock performance.now for consistent test results
- **dateNowUsage** (4 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/websocket/system-monitoring.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (4 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results
- **realTimeDependentTests** (1 occurrences)
  - Suggestion: This test may be time-dependent. Consider using time-testing-utils.js for deterministic results

### tests/unit/services/researchService.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (1 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/services/jobManager.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (3 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/services/redisClient.vitest.js

❌ Does not import time-testing-utils

Issues:

- **setTimeoutWithoutMock** (5 occurrences)
  - Suggestion: Ensure setTimeout is properly mocked using TimeController or vi.useFakeTimers

### tests/unit/utils/monitoring.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (10 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/utils/mockJobManager.vitest.js

❌ Does not import time-testing-utils

Issues:

- **advanceTimersByTime** (14 occurrences)
  - Suggestion: Consider using timeController.advanceTime for more control over time progression

### tests/unit/circuitBreaker.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (2 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/workflows/perplexity-deep-research.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (3 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/workflows/claude-chart-generation.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (3 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/controllers/researchController.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (8 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/websocket/websocket-simplified.vitest.js

❌ Does not import time-testing-utils

Issues:

- **setTimeoutWithoutMock** (2 occurrences)
  - Suggestion: Ensure setTimeout is properly mocked using TimeController or vi.useFakeTimers

### tests/unit/websocket/websocket-fixed.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (2 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/unit/websocket/websocket-integration.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (2 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

### tests/integration/services/jobManager-integration.vitest.js

❌ Does not import time-testing-utils

Issues:

- **dateNowUsage** (1 occurrences)
  - Suggestion: Consider using time-testing-utils.js to mock Date.now for consistent test results

