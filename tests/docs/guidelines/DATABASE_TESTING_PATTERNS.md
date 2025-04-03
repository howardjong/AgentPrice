# Database Testing Patterns with Vitest

## Overview

This document outlines the standardized patterns for database testing in our application. Following these patterns ensures consistent, reliable, and isolated database tests.

## Core Principles

1. **Isolation**: Every test must be isolated from other tests
2. **Performance**: Tests should execute quickly by optimizing database operations
3. **Cleanup**: All test resources must be properly cleaned up
4. **Reliability**: Tests should produce consistent results on every run
5. **Clarity**: Test intent should be clear and easy to understand

## Standard Testing Patterns

### Pattern 1: Isolated Test Database

For thorough testing with complete isolation, use a dedicated test database:

```javascript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase, clearTestData } from '../utils/db-test-utils.js';

describe('User Repository', () => {
  let testDb;
  
  // Setup once for the whole suite
  beforeAll(async () => {
    testDb = await createTestDatabase();
    await testDb.initialize();
  });
  
  // Clean up after all tests
  afterAll(async () => {
    await testDb.cleanup();
  });
  
  // Reset data before each test
  beforeEach(async () => {
    await clearTestData(testDb.client);
  });
  
  test('should create a new user', async () => {
    // Test implementation
  });
});
```

### Pattern 2: Transaction-Based Testing

For faster tests that don't need to persist data between tests, use transactions:

```javascript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { setupTestTransaction } from '../utils/db-test-utils.js';

describe('Post Repository', () => {
  const txHelper = setupTestTransaction();
  let client;
  
  // Start a fresh transaction for each test
  beforeEach(async () => {
    client = await txHelper.setup();
  });
  
  // Roll back after each test
  afterEach(async () => {
    await txHelper.teardown();
  });
  
  test('should create a new post', async () => {
    // Test using client - changes will be rolled back
  });
});
```

### Pattern 3: Fixtures and Factories

For tests that require complex data relationships:

```javascript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase, createFixtures, clearTestData } from '../utils/db-test-utils.js';

describe('Comment Repository', () => {
  let testDb;
  let fixtures;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
    await testDb.initialize();
    fixtures = createFixtures(testDb.client);
  });
  
  afterAll(async () => {
    await testDb.cleanup();
  });
  
  beforeEach(async () => {
    await clearTestData(testDb.client);
  });
  
  test('should retrieve comments for a post', async () => {
    // Create test data with relationships
    const user = await fixtures.createUser();
    const post = await fixtures.createPost({ user_id: user.id });
    await fixtures.createComment({ post_id: post.id, user_id: user.id });
    
    // Test implementation
  });
});
```

### Pattern 4: Integration Testing with API

For testing the complete stack with database access:

```javascript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData, clearTestData } from '../utils/db-test-utils.js';
import { app } from '../../server/app.js';
import supertest from 'supertest';

describe('User API', () => {
  let testDb;
  let request;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
    await testDb.initialize();
    
    // Configure app to use test database
    process.env.TEST_MODE = 'true';
    process.env.TEST_DB_CLIENT = testDb.client;
    
    request = supertest(app);
  });
  
  afterAll(async () => {
    delete process.env.TEST_MODE;
    delete process.env.TEST_DB_CLIENT;
    await testDb.cleanup();
  });
  
  beforeEach(async () => {
    await clearTestData(testDb.client);
  });
  
  test('GET /api/users should return all users', async () => {
    // Seed test data
    await seedTestData(testDb.client, {
      users: [{ name: 'Test User', email: 'test@example.com' }]
    });
    
    // Make API request
    const response = await request.get('/api/users');
    
    // Assert response
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Test User');
  });
});
```

## Common Patterns to Avoid

### 1. Global Database Connection

**AVOID THIS:**

```javascript
// Shared connection for all tests
const db = new Pool();

describe('Test Suite 1', () => {
  test('test 1', async () => {
    await db.query('INSERT INTO...');
  });
});

describe('Test Suite 2', () => {
  test('test 2', async () => {
    // Will see data from Test Suite 1
  });
});
```

**USE THIS INSTEAD:**

```javascript
import { createTestDatabase } from '../utils/db-test-utils.js';

describe('Test Suite 1', () => {
  let testDb;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
    await testDb.initialize();
  });
  
  afterAll(async () => {
    await testDb.cleanup();
  });
  
  test('test 1', async () => {
    await testDb.query('INSERT INTO...');
  });
});
```

### 2. Missing Cleanup

**AVOID THIS:**

```javascript
describe('Test Suite', () => {
  const client = new Client();
  
  beforeAll(async () => {
    await client.connect();
  });
  
  // Missing afterAll cleanup!
  
  test('test', async () => {
    // Test implementation
  });
});
```

**USE THIS INSTEAD:**

```javascript
describe('Test Suite', () => {
  let client;
  
  beforeAll(async () => {
    client = new Client();
    await client.connect();
  });
  
  afterAll(async () => {
    await client.end();
  });
  
  test('test', async () => {
    // Test implementation
  });
});
```

### 3. Direct Table Manipulation Without Isolation

**AVOID THIS:**

```javascript
test('should do something', async () => {
  // Direct manipulation of shared database table
  await db.query('DELETE FROM users WHERE id = 1');
});
```

**USE THIS INSTEAD:**

```javascript
test('should do something', async () => {
  // Use transactions for isolation
  await client.query('BEGIN');
  await client.query('DELETE FROM users WHERE id = 1');
  // Test logic
  await client.query('ROLLBACK');
});
```

## Migration from Jest to Vitest for Database Tests

### Key Changes Required

1. **Replace Jest Imports**:
   ```diff
   - import { describe, test, expect, beforeAll } from 'jest';
   + import { describe, test, expect, beforeAll } from 'vitest';
   ```

2. **Replace Mock Functions**:
   ```diff
   - jest.mock('../services/database.js');
   - jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
   + vi.mock('../services/database.js');
   + vi.spyOn(db, 'query').mockResolvedValue({ rows: [] });
   ```

3. **Replace Timers**:
   ```diff
   - jest.useFakeTimers();
   - jest.advanceTimersByTime(1000);
   - jest.useRealTimers();
   + vi.useFakeTimers();
   + vi.advanceTimersByTime(1000);
   + vi.useRealTimers();
   ```

4. **Update Assertions**:
   ```diff
   - expect.assertions(2);
   + expect.assertions(2); // Still works in Vitest
   ```

### Automatic Migration

Use the `scripts/fix-database-tests.js` script to automatically fix common database testing issues:

```bash
node scripts/fix-database-tests.js
```

## Best Practices

1. **Use Transactions**: Wrap each test in a transaction that's rolled back after the test
2. **Isolate Test Data**: Use unique schemas or tables for each test suite
3. **Clean Up Resources**: Always close connections and clean up test databases
4. **Test Realistic Scenarios**: Test complex queries, transactions, and error conditions
5. **Avoid Slow Operations**: Minimize database operations in tests that don't need them
6. **Use Fixtures**: Create reusable fixtures for common testing scenarios

## Troubleshooting

### Connection Issues

If you encounter "too many connections" errors:
1. Make sure `afterAll` handlers are correctly closing connections
2. Use the connection pool correctly with client.release()
3. Consider using transactions instead of new connections for each test

### Performance Issues

If database tests are running too slowly:
1. Use transactions instead of truncating tables between tests
2. Consider using an in-memory database for unit tests
3. Batch related tests in a single suite with shared setup

### Inconsistent Test Results

If tests pass sometimes and fail other times:
1. Check for proper isolation between tests
2. Ensure tests don't depend on data from other tests
3. Verify that cleanup is happening correctly

## Conclusion

Following these patterns ensures that our database tests are reliable, performant, and maintainable. Always aim for complete isolation between tests and proper cleanup of all resources.