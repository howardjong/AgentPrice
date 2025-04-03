# Database Testing with Vitest

This guide covers how to effectively test database interactions using Vitest in the Multi-LLM Research System.

## Table of Contents

1. [Introduction](#introduction)
2. [Testing Setup](#testing-setup)
   - [Configuration](#configuration)
   - [Hooks and Lifecycle](#hooks-and-lifecycle)
3. [Mock vs. Real Database](#mock-vs-real-database)
4. [Transaction Isolation](#transaction-isolation)
5. [Testing Patterns](#testing-patterns)
6. [Handling Asynchronous Database Operations](#handling-asynchronous-database-operations)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Introduction

Vitest provides a modern, ESM-compatible testing framework that works well for testing database operations. This guide explains how to use Vitest's features to effectively test database interactions in our application.

## Testing Setup

### Configuration

The project is configured to use Vitest with TypeScript and ESM support. The main configuration file is `vitest.config.js`, which includes settings for:

- Environment setup (`process.env.NODE_ENV = 'test'`)
- Global test timeout
- Coverage reporting
- Test isolation

Key Vitest configuration for database testing:

```js
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000, // Extended timeout for database operations
    isolate: true,      // Isolates test files from each other
    setupFiles: ['./tests/setup.ts'], // Global setup file
  },
  // ...
});
```

### Hooks and Lifecycle

Vitest provides several lifecycle hooks that are useful for database testing:

- `beforeAll`: Set up database connections, create tables
- `afterAll`: Close connections, clean up resources
- `beforeEach`: Reset database state, start transactions
- `afterEach`: Roll back transactions, clean up test data

Example usage in a test file:

```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db, resetDatabase, closeDatabaseConnections } from '../../server/db';

beforeAll(async () => {
  // Set up database for all tests in this file
  await resetDatabase();
});

afterAll(async () => {
  // Clean up after all tests
  await closeDatabaseConnections();
});

beforeEach(async () => {
  // Prepare for each test
  await db.query('DELETE FROM users');
});
```

## Mock vs. Real Database

### When to Use a Real Database

Use a real PostgreSQL database for:

- Integration tests verifying actual database behavior
- Tests that rely on PostgreSQL-specific features
- Tests for complex queries or transactions
- Tests for database constraints and triggers

### When to Use a Mock

Use a mocked database for:

- Unit tests focusing on business logic
- Tests that shouldn't depend on database availability
- Fast-running tests for CI pipelines
- Testing edge cases and error conditions

## Transaction Isolation

Transaction isolation is a powerful technique for database testing that:

1. Wraps each test in a transaction
2. Rolls back the transaction after the test
3. Keeps tests isolated without slow database resets
4. Allows complex data setup without affecting other tests

Implementation:

```typescript
let client: any;

beforeEach(async () => {
  // Start a transaction
  client = await db.getClient();
  await client.query('BEGIN');
});

afterEach(async () => {
  // Roll back the transaction
  await client.query('ROLLBACK');
  client.release();
});
```

## Testing Patterns

### Repository/Storage Layer Testing

Test storage implementations to verify they interact correctly with the database:

```typescript
describe('PgStorage', () => {
  it('should create and retrieve a user', async () => {
    const storage = new PgStorage();
    
    // Create a user
    const created = await storage.createUser({
      username: 'testuser',
      password: 'password'
    });
    
    // Retrieve the user
    const retrieved = await storage.getUser(created.id);
    
    // Verify
    expect(retrieved).toEqual(created);
  });
});
```

### Service Layer Testing

Test services that use the storage interface:

```typescript
describe('UserService', () => {
  it('should register a new user', async () => {
    // Use mock storage for unit testing
    const { mockStorage } = mockDatabase();
    const service = new UserService(mockStorage);
    
    await service.register('testuser', 'password');
    
    // Verify storage was called correctly
    expect(mockStorage.createUser).toHaveBeenCalledWith({
      username: 'testuser',
      password: expect.any(String) // Password should be hashed
    });
  });
});
```

### API Testing

Test API endpoints that interact with the database:

```typescript
describe('User API', () => {
  it('should create a user via API', async () => {
    // Set up Express app with routes
    const app = setupTestApp();
    
    // Make a request
    const response = await request(app)
      .post('/api/users')
      .send({ username: 'testuser', password: 'password' });
    
    // Verify response
    expect(response.status).toBe(201);
    expect(response.body.username).toBe('testuser');
    
    // Verify database state
    const user = await db.getUser(response.body.id);
    expect(user).toBeDefined();
  });
});
```

## Handling Asynchronous Database Operations

Vitest handles async tests well, but there are some best practices to follow:

1. Always use `async/await` for database operations
2. Make sure to handle promise rejections
3. Use proper assertions for async results
4. Be careful with timeout settings

Example:

```typescript
it('should handle large result sets', async () => {
  // Insert 1000 records
  await db.bulkInsert(/* ... */);
  
  // This might take time, so we use a longer timeout
  const results = await db.findAll();
  
  // Verify results
  expect(results.length).toBe(1000);
}, 20000); // Extended timeout just for this test
```

## Best Practices

1. **Use a separate test database**: Never test against production or development databases
2. **Reset database state**: Either reset between test runs or use transaction isolation
3. **Test database constraints**: Verify unique constraints, foreign keys, etc.
4. **Use realistic test data**: Test with data that resembles production
5. **Don't share test state**: Tests should be independent from each other
6. **Test error conditions**: Verify how your code handles database errors
7. **Check coverage**: Aim for high coverage of database operations
8. **Group related tests**: Use `describe` blocks to organize tests logically

## Troubleshooting

### Common Issues and Solutions

1. **Timeout errors**
   - Increase the test timeout in Vitest config or for specific tests
   - Check for slow queries or missing indexes

2. **Database connection issues**
   - Verify your PostgreSQL instance is running
   - Check connection string and credentials
   - Ensure you're not hitting connection limits

3. **Data persistence between tests**
   - Make sure transactions are rolling back properly
   - Check that all tests clean up their data
   - Check for side effects in shared test setup

4. **ESM compatibility issues**
   - Use dynamic imports for ESM modules
   - Make sure your database client supports ESM

5. **Missing tables or schema issues**
   - Verify that migrations run before tests
   - Check schema synchronization in test setup