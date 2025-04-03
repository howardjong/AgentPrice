# Database Testing with Vitest

This guide outlines best practices for database testing using Vitest in the Multi-AI Chatbot application.

## Table of Contents

1. [Introduction](#introduction)
2. [Testing Goals](#testing-goals)
3. [Test Types](#test-types)
4. [Testing Patterns](#testing-patterns)
5. [Transaction Isolation](#transaction-isolation)
6. [DbTestUtils](#dbtestutils)
7. [Example Tests](#example-tests)
8. [Best Practices](#best-practices)
9. [Common Issues](#common-issues)

## Introduction

Properly testing database interactions is crucial for ensuring data integrity and application correctness. This document provides guidance on how to effectively test database operations using Vitest.

## Testing Goals

- **Verify data integrity**: Ensure operations don't corrupt data
- **Validate transaction handling**: Confirm correct isolation levels and rollback behavior
- **Test storage interface**: Validate CRUD operations through our abstraction layer
- **Check schema compatibility**: Ensure database schema and application models match
- **Prevent destructive changes**: Ensure tests don't permanently alter database state

## Test Types

### 1. Transaction Isolation Tests

Tests that verify transaction isolation is working correctly to prevent test data from persisting between tests.

```typescript
// tests/storage/transaction-isolation.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { DbTestUtils } from '../utils/db-test-utils';

describe('Transaction Isolation', () => {
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

  test('transactions are properly isolated', async () => {
    // Start transaction
    await dbUtils.beginTransaction();
    
    // Create test data
    const testData = { id: dbUtils.generateUniqueId(), value: 'test-data' };
    await dbUtils.executeQuery('INSERT INTO test_table (id, value) VALUES ($1, $2)', [testData.id, testData.value]);
    
    // Verify data exists within transaction
    const result = await dbUtils.executeQuery('SELECT * FROM test_table WHERE id = $1', [testData.id]);
    expect(result.rows).toHaveLength(1);
    
    // Rollback transaction
    await dbUtils.rollbackTransaction();
    
    // Verify data doesn't exist after rollback
    const afterRollback = await dbUtils.executeQuery('SELECT * FROM test_table WHERE id = $1', [testData.id]);
    expect(afterRollback.rows).toHaveLength(0);
  });
});
```

### 2. Storage Interface Tests

Tests that validate our storage layer abstractions work correctly.

```typescript
// tests/storage/pg-storage.test.ts
import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
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

  beforeEach(async () => {
    await dbUtils.beginTransaction();
  });

  afterEach(async () => {
    await dbUtils.rollbackTransaction();
  });

  afterAll(async () => {
    await dbUtils.disconnect();
  });

  test('createUser creates a user in the database', async () => {
    const testUser = {
      username: `test-user-${dbUtils.generateTimestamp()}`,
      password: 'hashedPassword'
    };
    
    const userId = await storage.createUser(testUser);
    expect(userId).toBeDefined();
    
    const result = await dbUtils.executeQuery('SELECT * FROM users WHERE id = $1', [userId]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].username).toBe(testUser.username);
  });
});
```

### 3. Mock Storage Tests

Tests that use a mocked storage implementation to isolate tests from the database.

```typescript
// tests/storage/mock-storage.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { MemStorage } from '../../server/mem-storage';

describe('In-Memory Storage', () => {
  let storage: MemStorage;
  
  beforeEach(() => {
    storage = new MemStorage();
  });

  test('createUser adds a user to in-memory storage', async () => {
    const testUser = {
      username: 'test-user',
      password: 'hashedPassword'
    };
    
    const userId = await storage.createUser(testUser);
    expect(userId).toBeDefined();
    
    const user = await storage.getUserById(userId);
    expect(user).toBeDefined();
    expect(user?.username).toBe(testUser.username);
  });
});
```

## Transaction Isolation

Transaction isolation is a critical safeguard to ensure tests don't interfere with each other or leave data in the database. All database tests should:

1. Begin a transaction before each test
2. Execute test operations within the transaction
3. Roll back the transaction after each test

This pattern is implemented in the DbTestUtils class and should be used in all database tests.

## DbTestUtils

The DbTestUtils class provides utilities for database testing:

```typescript
// tests/utils/db-test-utils.ts
import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';

export class DbTestUtils {
  private pool: Pool | null = null;
  private client: PoolClient | null = null;
  
  async connect(): Promise<void> {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // Limit pool size for tests
    });
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
  
  async beginTransaction(): Promise<void> {
    if (!this.pool) {
      throw new Error('Call connect() before beginTransaction()');
    }
    
    if (this.client) {
      await this.client.query('ROLLBACK');
      this.client.release();
    }
    
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
  }
  
  async rollbackTransaction(): Promise<void> {
    if (this.client) {
      await this.client.query('ROLLBACK');
      this.client.release();
      this.client = null;
    }
  }
  
  async executeQuery(query: string, params: any[] = []): Promise<any> {
    if (!this.client && !this.pool) {
      throw new Error('Call connect() before executeQuery()');
    }
    
    const client = this.client || this.pool;
    const result = await client.query(query, params);
    return result;
  }
  
  generateUniqueId(): string {
    return crypto.randomUUID();
  }
  
  generateTimestamp(): string {
    return Date.now().toString();
  }
}
```

## Example Tests

See the following example tests:

- Transaction Isolation: `tests/storage/transaction-isolation.test.ts`
- PostgreSQL Storage: `tests/storage/pg-storage.test.ts`
- Mock Storage: `tests/storage/mock-storage.test.ts`

## Best Practices

1. **Use transaction isolation**: Always use transaction isolation to prevent tests from affecting each other.
2. **Generate unique data**: Use timestamp-based identifiers to avoid collisions.
3. **Check database type**: Verify you're testing against a test database, not production.
4. **Clean up properly**: Always release connections and roll back transactions.
5. **Use timeouts**: Set appropriate timeouts for database operations.
6. **Mock when appropriate**: Consider if a test actually needs database access or can use mocks.
7. **Avoid schema changes**: Don't modify schema in tests.
8. **Keep tests independent**: Tests should not depend on each other.
9. **Use proper assertions**: Test both successful operations and error conditions.
10. **Verify through the database**: Verify changes by querying the database directly.

## Common Issues

### Connection Pooling
- Issue: Tests hang due to exhausted connection pool
- Solution: Use a dedicated test pool with a limited number of connections

### Test Interference
- Issue: Tests affect each other due to shared data
- Solution: Use transaction isolation and generate unique test data

### Slow Tests
- Issue: Database tests are slow
- Solution: Consider if a mock would be appropriate, or use proper setup/teardown hooks

### Broken Transactions
- Issue: Transaction isolation doesn't work
- Solution: Ensure begin/rollback are properly paired and connections are managed correctly

### Production Database Modification
- Issue: Tests modify production data
- Solution: Always check DATABASE_URL contains 'test' before running tests