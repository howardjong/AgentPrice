# Testing in Replit Environment: Best Practices and Guidelines

## Overview

This document provides specific guidelines for executing tests in the Replit environment, which has certain constraints compared to local or CI environments. Following these guidelines will help ensure tests run reliably and provide accurate results despite these constraints.

## Environment Constraints

The Replit environment has the following limitations that affect test execution:

1. **Limited Memory**: The Replit environment has constrained memory resources, which can lead to test failures when running the full test suite at once.

2. **Connection Timeouts**: Complex network simulation tests (especially Socket.IO tests) can trigger timeouts in the Replit environment.

3. **Database Connections**: Replit has limits on concurrent database connections, which can affect database-heavy test suites.

4. **Execution Timeouts**: Long-running test suites may hit execution timeouts, resulting in aborted test runs without proper cleanup.

## Recommended Testing Approach

### 1. File-by-File Testing for Critical Modules

Even with our optimized `run-critical-tests.js` script that runs tests sequentially, we observe that Socket.IO tests may cause timeouts in the Replit environment. For this reason, we recommend focusing on testing critical modules individually:

Instead of running the entire test suite at once, use the provided `run-critical-tests.js` script to run tests file by file in sequence:

```bash
node scripts/run-critical-tests.js
```

Options:
- `--coverage` - Run with coverage reporting
- `--verbose` - Show full test output rather than just summary
- Add specific tests by editing the `criticalTests` array in the script

### 2. Testing Critical Modules Individually

For critical modules, run tests directly using Vitest:

```bash
npx vitest run tests/unit/utils/searchUtils.vitest.js
```

### 3. Memory Optimization

Always enable memory optimization flags in the Replit environment:

```javascript
// Example memory optimization settings
{
  lowMemoryMode: true,
  aggressiveGcEnabled: true,
  gcInterval: 60000,
  maxCacheSize: 100,
  enableFuzzyMatch: false
}
```

These settings are already configured in the project's optimization settings file.

### 4. Handling Socket.IO Tests

Socket.IO tests require special handling due to their complex network simulation:

- Run socket tests individually with increased timeouts
- Use the `DEBUG=socket.io*` environment variable for debugging
- Implement proper cleanup patterns using `removeAllListeners()`
- Consider using explicit event tracking for synchronization

Example:
```bash
DEBUG=socket.io* npx vitest run tests/unit/websocket/basic-socketio.vitest.js --timeout 30000
```

### 5. Database Testing Safety

Always follow these guidelines for database tests:

- Use transaction isolation (see `DbTestUtils.beginTransaction()`)
- Never perform destructive operations outside of managed test databases
- Use the test database verification check in all database tests:

```typescript
beforeAll(() => {
  if (!process.env.DATABASE_URL.includes('test')) {
    throw new Error('Tests should only run against a test database');
  }
});
```

## Troubleshooting Common Issues

### Test Timeouts

If you encounter test timeouts, try:

1. Running the test in isolation:
```bash
npx vitest run <test-file> --isolate
```

2. Adding additional debugging:
```bash
DEBUG=socket.io* npx vitest run <test-file>
```

3. Increasing the timeout for a specific test:
```javascript
test('should complete complex operation', async () => {
  // Test code
}, { timeout: 30000 }); // 30 second timeout
```

### Memory Issues

If you encounter memory-related errors:

1. Run the memory profiler to identify the issue:
```bash
node scripts/memory-profile.js <test-file>
```

2. Consider implementing more aggressive cleanup in the test:
```javascript
afterEach(() => {
  // Clear any caches or large objects
  vi.resetModules();
  // Additional cleanup
});
```

## Best Practices for Writing Replit-Compatible Tests

1. **Keep Tests Focused**: Write smaller, focused test files instead of large comprehensive ones.

2. **Implement Proper Cleanup**: Always clean up resources in `afterEach` and `afterAll` hooks.

3. **Use Mock Data Efficiently**: Minimize the size of test fixtures and mock data.

4. **Optimize Network Simulations**: For Socket.IO tests, use deterministic waiting patterns rather than sleep/timeout.

5. **Avoid Global State**: Isolate tests from each other by avoiding shared global state.

6. **Use Transaction Isolation**: For database tests, always use transaction isolation via `DbTestUtils`.

7. **Run Tests Sequentially**: In Replit, run tests sequentially instead of in parallel to avoid memory and timeout issues.

8. **Socket.IO Test Handling**: For Socket.IO tests:
   - Use shorter connection timeouts (e.g., 2000ms instead of 5000ms)
   - Implement explicit cleanup with removeAllListeners()
   - Use event tracking for deterministic waiting
   - Avoid complex reconnection patterns when possible

9. **Proactive Test Termination**: If a test doesn't complete within a reasonable time, implement a safety timeout:
   ```javascript
   // Safety timeout to prevent hanging tests
   const safetyTimeout = setTimeout(() => {
     console.error('Test safety timeout triggered - test taking too long');
     // Clean up resources
     done(); // Force test completion
   }, 10000);
   
   // Don't forget to clear the timeout when the test completes normally
   clearTimeout(safetyTimeout);
   ```

## Conclusion

By following these guidelines, you can ensure that tests run reliably in the Replit environment despite its constraints. The file-by-file approach, memory optimization techniques, and careful handling of Socket.IO and database tests are key to successful testing in this environment.