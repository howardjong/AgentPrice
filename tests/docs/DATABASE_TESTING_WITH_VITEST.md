# Database Testing with Vitest

This document outlines how to use Vitest for database testing in the Multi-LLM Research System. Vitest offers several advantages over Jest for testing database operations.

## Why Vitest for Database Testing?

Vitest has several advantages for database testing:

1. **Native ESM Support**: Vitest provides native support for ES Modules, which is essential for our modern TypeScript codebase.

2. **Better Async Handling**: Vitest has improved handling of asynchronous code and promises, which is crucial for database operations.

3. **Faster Execution**: Vitest is generally faster than Jest, which is important for database tests that can be time-consuming.

4. **TypeScript Integration**: Vitest works better with TypeScript, providing better type checking and error reporting.

5. **Improved Mocking**: Vitest has better mocking capabilities, especially for ES Modules.

6. **Better Error Messages**: Vitest provides more detailed and helpful error messages when tests fail.

## Setting Up Database Tests with Vitest

### Test Configuration

The project uses a custom Vitest configuration in `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000, // Increased timeout for database operations
    hookTimeout: 15000,  // Increased timeout for setup/teardown hooks
    poolOptions: {
      threads: {
        singleThread: true, // Database tests often need to run in a single thread
      },
    },
    // ... other configuration
  },
});
```

### Database Test Utilities

We've created several utilities to make database testing easier with Vitest:

```typescript
// Setting up a test database
const { getStorage } = setupTestDatabase();

// Creating test data
const user = await createTestData.user(storage);

// Mocking the database
const { mockStorage } = mockDatabase();

// Setting up transaction isolation
const { db } = setupTransactionTest();
```

### Test File Structure

Database test files should follow this general structure:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase } from '../utils/db-test-utils';

describe('Database Module Tests', () => {
  const { getStorage } = setupTestDatabase();
  let storage;

  beforeAll(() => {
    storage = getStorage();
  });

  it('should perform a database operation', async () => {
    // Test database operations
  });
});
```

## Working with Transactions

Vitest works well with database transactions for test isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { setupTransactionTest } from '../utils/db-test-utils';

describe('Transaction Tests', () => {
  const { db } = setupTransactionTest();

  it('should create and read data within a transaction', async () => {
    // Test code using db directly
    // Changes will be rolled back after the test
  });
});
```

## Mocking Database Operations

Vitest provides robust mocking capabilities:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDatabase } from '../utils/db-test-utils';

describe('Service with Mocked Database', () => {
  const { mockStorage } = mockDatabase();
  
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  it('should use the database correctly', async () => {
    // Setup mocks
    vi.mocked(mockStorage.getUser).mockResolvedValue({
      id: 1, username: 'testuser', password: 'password'
    });
    
    // Test code that uses mockStorage
    // ...
    
    // Verify mock was called correctly
    expect(mockStorage.getUser).toHaveBeenCalledWith(1);
  });
});
```

## Best Practices for Database Testing with Vitest

1. **Use Appropriate Timeouts**: Database operations can be slow, so set appropriate timeouts for tests and hooks.

```typescript
it('should perform a slow database operation', async () => {
  // Test code
}, { timeout: 10000 }); // 10 second timeout for this specific test
```

2. **Handle Async Operations Correctly**: Always use `async/await` with database operations and ensure all promises are properly resolved or rejected.

```typescript
it('should correctly handle async operations', async () => {
  // Good: Wait for the promise to resolve
  const result = await storage.getUser(1);
  
  // Bad: Not waiting for the promise
  // storage.getUser(1);
});
```

3. **Clean Up Database State**: Always clean up database state after tests, either using transactions or explicit cleanup.

```typescript
// Using afterEach for cleanup
afterEach(async () => {
  await db.delete(users).where(eq(users.username, 'testuser'));
});
```

4. **Isolate Test Runs**: Each test should run in isolation and not depend on state from other tests.

5. **Use Mock Reset**: Always reset mocks between tests to prevent test contamination.

```typescript
beforeEach(() => {
  vi.resetAllMocks();
});
```

6. **Check for Test Database**: Before running tests, verify that you're using a test database, not a production database.

```typescript
beforeAll(() => {
  if (!process.env.DATABASE_URL.includes('test')) {
    throw new Error('Tests should only run against a test database');
  }
});
```

## Migrating from Jest to Vitest

If you're migrating existing database tests from Jest to Vitest:

1. Replace Jest imports with Vitest:
   ```typescript
   // Change this
   import { describe, it, expect } from 'jest';
   // To this
   import { describe, it, expect } from 'vitest';
   ```

2. Update mocking syntax:
   ```typescript
   // Change this
   jest.mock('./module');
   jest.spyOn(object, 'method').mockImplementation(() => {});
   // To this
   vi.mock('./module');
   vi.spyOn(object, 'method').mockImplementation(() => {});
   ```

3. Update timer mocks:
   ```typescript
   // Change this
   jest.useFakeTimers();
   jest.advanceTimersByTime(1000);
   // To this
   vi.useFakeTimers();
   vi.advanceTimersByTime(1000);
   ```

4. Update test runner configuration in `package.json` or run script.

## Running Database Tests

Use the provided script to run database tests:

```bash
npm run test:db
```

Or run specific database tests:

```bash
npx vitest run tests/storage/pg-storage.test.ts
```

## Troubleshooting Common Issues

1. **Connection Issues**: If tests fail to connect to the database, check your `DATABASE_URL` environment variable.

2. **Timeout Errors**: If tests time out, increase the timeout in `vitest.config.js` or for specific tests.

3. **ESM Compatibility**: If you encounter ESM compatibility issues, make sure all imports and exports use the correct syntax.

4. **Transaction Isolation Failures**: If transaction isolation isn't working, ensure your database supports transactions and that you're properly beginning and rolling back transactions.

5. **Mock Issues**: If mocks aren't working as expected, check that you're using `vi.mocked()` and resetting mocks between tests.