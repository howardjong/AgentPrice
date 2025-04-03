# Database Testing Patterns

This document outlines the database testing patterns used in our Multi-AI Chatbot application after the Jest to Vitest migration.

## Table of Contents

1. [Overview](#overview)
2. [Testing Patterns](#testing-patterns)
   - [Transaction Isolation Pattern](#transaction-isolation-pattern)
   - [Mock Storage Pattern](#mock-storage-pattern)
   - [PostgreSQL Storage Pattern](#postgresql-storage-pattern)
3. [Test Data Management](#test-data-management)
4. [Safety Mechanisms](#safety-mechanisms)
5. [DbTestUtils](#dbtestutils)
6. [Code Examples](#code-examples)

## Overview

Our database testing approach is focused on safety, reliability, and consistency. We use three main patterns for database testing, each with specific advantages for different testing scenarios.

## Testing Patterns

### Transaction Isolation Pattern

The Transaction Isolation Pattern is our primary pattern for protecting the database during tests. It:

- Wraps each test in a transaction
- Rolls back the transaction after the test completes
- Ensures no test data persists in the database
- Provides isolation between tests

**Use this pattern when:**
- You need to test direct database interactions
- You want to verify data is correctly stored in the database
- You need to test complex queries and joins

**Example:**

```typescript
// Using transaction isolation
import { describe, test, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { DbTestUtils } from '../utils/db-test-utils';

describe('User Operations', () => {
  const dbUtils = new DbTestUtils();
  
  beforeAll(async () => {
    await dbUtils.connect();
    
    // Safety check
    if (!process.env.DATABASE_URL.includes('test')) {
      throw new Error('Tests should only run against a test database');
    }
  });

  afterAll(async () => {
    await dbUtils.disconnect();
  });
  
  beforeEach(async () => {
    await dbUtils.beginTransaction();
  });
  
  afterEach(async () => {
    await dbUtils.rollbackTransaction();
  });
  
  test('creates a user', async () => {
    // Test operations that will be rolled back after the test
  });
});
```

### Mock Storage Pattern

The Mock Storage Pattern uses an in-memory storage implementation to completely isolate tests from the database.

- No database access is required
- Tests run faster with no database overhead
- Good for unit testing business logic

**Use this pattern when:**
- You're testing business logic rather than database interactions
- You want faster tests
- You want to test edge cases that are hard to reproduce with a real database

**Example:**

```typescript
// Using mock storage
import { describe, test, beforeEach } from 'vitest';
import { MemStorage } from '../../server/mem-storage';
import { UserService } from '../../services/userService';

describe('User Service', () => {
  let storage: MemStorage;
  let userService: UserService;
  
  beforeEach(() => {
    storage = new MemStorage();
    userService = new UserService(storage);
  });
  
  test('registers a new user', async () => {
    const result = await userService.registerUser({ username: 'test', password: 'password' });
    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
  });
});
```

### PostgreSQL Storage Pattern

The PostgreSQL Storage Pattern tests our storage layer directly against a real PostgreSQL database but within a transaction.

- Tests the actual PgStorage implementation
- Verifies SQL queries work as expected
- Combines transaction isolation for safety

**Use this pattern when:**
- You want to test the storage layer implementation
- You need to verify SQL queries are correct
- You want to test database-specific features

**Example:**

```typescript
// Using PostgreSQL Storage Pattern
import { describe, test, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { DbTestUtils } from '../utils/db-test-utils';
import { PgStorage } from '../../server/pg-storage';

describe('PostgreSQL Storage', () => {
  const dbUtils = new DbTestUtils();
  let storage: PgStorage;
  
  beforeAll(async () => {
    await dbUtils.connect();
    storage = new PgStorage();
    
    // Safety check
    if (!process.env.DATABASE_URL.includes('test')) {
      throw new Error('Tests should only run against a test database');
    }
  });

  afterAll(async () => {
    await dbUtils.disconnect();
  });
  
  beforeEach(async () => {
    await dbUtils.beginTransaction();
  });
  
  afterEach(async () => {
    await dbUtils.rollbackTransaction();
  });
  
  test('creates a user', async () => {
    const username = `test-user-${dbUtils.generateTimestamp()}`;
    const userId = await storage.createUser({ username, password: 'password' });
    
    expect(userId).toBeDefined();
    
    const user = await storage.getUserById(userId);
    expect(user).toBeDefined();
    expect(user.username).toBe(username);
  });
});
```

## Test Data Management

### Generate Unique Test Data

Always generate unique test data to avoid conflicts between tests. The DbTestUtils class provides helper methods:

```typescript
// Generate a unique ID
const id = dbUtils.generateUniqueId();

// Generate a unique timestamp string
const timestamp = dbUtils.generateTimestamp();

// Use them together for unique test data
const username = `test-user-${dbUtils.generateTimestamp()}`;
```

### Clean Up Test Data

Even with transaction isolation, it's a good practice to clean up any test data that might have been created outside the transaction. Use the afterAll hook for this:

```typescript
afterAll(async () => {
  // Clean up any test data that might have been created
  try {
    await dbUtils.executeQuery('DELETE FROM users WHERE username LIKE $1', ['test-user-%']);
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
  
  await dbUtils.disconnect();
});
```

## Safety Mechanisms

### Database Type Check

Always check that you're testing against a test database, not production:

```typescript
beforeAll(() => {
  if (!process.env.DATABASE_URL.includes('test')) {
    throw new Error('Tests should only run against a test database');
  }
});
```

### Transaction Isolation

Use transaction isolation to prevent tests from affecting each other or leaving data in the database:

```typescript
beforeEach(async () => {
  await dbUtils.beginTransaction();
});

afterEach(async () => {
  await dbUtils.rollbackTransaction();
});
```

### Avoid Schema Changes

Never modify the database schema in tests. If you need to test schema changes, use a dedicated test environment with a separate database.

### Connection Management

Properly manage database connections to avoid leaks:

```typescript
beforeAll(async () => {
  await dbUtils.connect();
});

afterAll(async () => {
  await dbUtils.disconnect();
});
```

## DbTestUtils

The DbTestUtils class is a utility for database testing:

### Features

- **Connection Management**: Connect to and disconnect from the database
- **Transaction Management**: Start, commit, and roll back transactions
- **Query Execution**: Execute SQL queries with parameters
- **Test Data Generation**: Generate unique IDs and timestamps for test data
- **Timeouts**: Execute queries with timeouts to prevent hanging tests

### Key Methods

- `connect()`: Connect to the database
- `disconnect()`: Disconnect from the database
- `beginTransaction()`: Start a new transaction
- `rollbackTransaction()`: Roll back the current transaction
- `executeQuery(query, params)`: Execute a SQL query with parameters
- `generateUniqueId()`: Generate a unique ID for test data
- `generateTimestamp()`: Generate a unique timestamp for test data

## Code Examples

### Complete Example: Testing User Creation and Retrieval

```typescript
// tests/storage/user-storage.test.ts
import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { DbTestUtils } from '../utils/db-test-utils';
import { PgStorage } from '../../server/pg-storage';

describe('User Storage', () => {
  const dbUtils = new DbTestUtils();
  let storage: PgStorage;
  
  beforeAll(async () => {
    await dbUtils.connect();
    storage = new PgStorage();
    
    // Safety check
    if (!process.env.DATABASE_URL.includes('test')) {
      throw new Error('Tests should only run against a test database');
    }
  });

  afterAll(async () => {
    await dbUtils.disconnect();
  });
  
  beforeEach(async () => {
    await dbUtils.beginTransaction();
  });
  
  afterEach(async () => {
    await dbUtils.rollbackTransaction();
  });
  
  test('creates and retrieves a user', async () => {
    // Generate unique test data
    const username = `test-user-${dbUtils.generateTimestamp()}`;
    const password = 'hashedPassword';
    
    // Create user
    const userId = await storage.createUser({ username, password });
    expect(userId).toBeDefined();
    
    // Retrieve user
    const user = await storage.getUserById(userId);
    expect(user).toBeDefined();
    expect(user.username).toBe(username);
    expect(user.password).toBe(password);
  });
  
  test('updates a user', async () => {
    // Generate unique test data
    const username = `test-user-${dbUtils.generateTimestamp()}`;
    const password = 'hashedPassword';
    
    // Create user
    const userId = await storage.createUser({ username, password });
    
    // Update user
    const newUsername = `updated-user-${dbUtils.generateTimestamp()}`;
    await storage.updateUser(userId, { username: newUsername });
    
    // Verify update
    const user = await storage.getUserById(userId);
    expect(user.username).toBe(newUsername);
  });
  
  test('deletes a user', async () => {
    // Generate unique test data
    const username = `test-user-${dbUtils.generateTimestamp()}`;
    
    // Create user
    const userId = await storage.createUser({ username, password: 'password' });
    
    // Delete user
    await storage.deleteUser(userId);
    
    // Verify deletion
    const user = await storage.getUserById(userId);
    expect(user).toBeNull();
  });
});
```

### Testing Error Conditions

```typescript
// Testing error conditions
test('fails to create user with duplicate username', async () => {
  // Generate unique test data
  const username = `test-user-${dbUtils.generateTimestamp()}`;
  
  // Create first user
  await storage.createUser({ username, password: 'password1' });
  
  // Try to create second user with same username
  try {
    await storage.createUser({ username, password: 'password2' });
    fail('Expected duplicate username to throw an error');
  } catch (error) {
    expect(error).toBeDefined();
    expect(error.message).toContain('duplicate key value');
  }
});
```

### Testing Transactions

```typescript
// Testing transactions
test('rolls back transaction on error', async () => {
  // Start a new transaction
  const pgClient = await dbUtils.getClientWithTransaction();
  
  try {
    // Generate unique test data
    const username = `test-user-${dbUtils.generateTimestamp()}`;
    
    // Create user within transaction
    await pgClient.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id', [username, 'password']);
    
    // Verify user exists within transaction
    const result = await pgClient.query('SELECT * FROM users WHERE username = $1', [username]);
    expect(result.rows).toHaveLength(1);
    
    // Simulate an error
    throw new Error('Simulated error');
    
  } catch (error) {
    // Roll back transaction
    await pgClient.query('ROLLBACK');
    
    // Verify user doesn't exist after rollback
    const result = await dbUtils.executeQuery('SELECT * FROM users WHERE username = $1', [username]);
    expect(result.rows).toHaveLength(0);
  } finally {
    pgClient.release();
  }
});
```