# Database Testing with Vitest

## Overview

This guide outlines best practices and patterns for testing database operations in our multi-LLM application using Vitest. Unlike Jest, Vitest handles ESM modules natively and provides better performance, but requires specific approaches to database testing.

## Key Principles

1. **Isolation**: Each test should run in complete isolation without affecting other tests.
2. **Cleanup**: All database changes must be properly cleaned up after tests.
3. **Authentication**: Use proper authentication in tests, never skip authentication checks.
4. **Real Connections**: Prefer using real database connections with transactions over mocks.
5. **Reproducibility**: Tests should produce the same result on every run.

## Testing Database Operations with Vitest

### Setup and Teardown Patterns

Vitest provides `beforeEach`, `afterEach`, `beforeAll`, and `afterAll` hooks similar to Jest. Here's how to use them for database testing:

```javascript
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db } from '../../services/database.js';

describe('Database operations', () => {
  let testConnection;
  
  // Create a dedicated connection for this test suite
  beforeAll(async () => {
    testConnection = await db.createConnection({
      database: 'test_db',
      // Use a unique schema for this test suite to ensure isolation
      searchPath: [`test_${Date.now()}`]
    });
    
    // Create any needed tables or structures
    await testConnection.query(`CREATE TABLE IF NOT EXISTS...`);
  });
  
  // Clean up after all tests are done
  afterAll(async () => {
    // Drop the test schema and all its objects
    await testConnection.query(`DROP SCHEMA IF EXISTS...`);
    await testConnection.close();
  });
  
  // Reset data before each test
  beforeEach(async () => {
    // Clear test tables or reset to known state
    await testConnection.query('TRUNCATE TABLE test_table RESTART IDENTITY CASCADE');
    // Seed with test data
    await testConnection.query('INSERT INTO test_table...');
  });
  
  // Additional cleanup after each test if needed
  afterEach(async () => {
    // Any specific cleanup for each test
  });
  
  test('should retrieve records correctly', async () => {
    const result = await testConnection.query('SELECT * FROM test_table');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Test Name');
  });
  
  // More tests...
});
```

### Using Transactions for Isolation

Transactions provide the best isolation and rollback capabilities:

```javascript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../services/database.js';

describe('Transaction-based tests', () => {
  let client;
  
  beforeEach(async () => {
    client = await db.pool.connect();
    await client.query('BEGIN'); // Start transaction
  });
  
  afterEach(async () => {
    await client.query('ROLLBACK'); // Roll back transaction
    client.release();
  });
  
  test('should insert and retrieve data', async () => {
    await client.query('INSERT INTO users(name) VALUES($1)', ['Test User']);
    const result = await client.query('SELECT * FROM users WHERE name = $1', ['Test User']);
    expect(result.rows).toHaveLength(1);
  });
});
```

### Testing with an In-Memory Database

For some tests, an in-memory database improves performance and isolation:

```javascript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createInMemoryDatabase } from '../../utils/test-utils.js';

describe('In-memory database tests', () => {
  let inMemDb;
  
  beforeAll(async () => {
    inMemDb = await createInMemoryDatabase();
    await inMemDb.initialize();
  });
  
  afterAll(async () => {
    await inMemDb.cleanup();
  });
  
  test('should handle database operations', async () => {
    await inMemDb.execute('CREATE TABLE test (id SERIAL PRIMARY KEY, name TEXT)');
    await inMemDb.execute('INSERT INTO test(name) VALUES($1)', ['Test']);
    const result = await inMemDb.query('SELECT * FROM test');
    expect(result.rows[0].name).toBe('Test');
  });
});
```

## Testing Database Models and ORMs

When testing models that use an ORM (like Drizzle):

```javascript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../services/database.js';
import { UserModel } from '../../models/user.js';

describe('User model tests', () => {
  beforeAll(async () => {
    // Setup test database
    await db.initialize({ testMode: true });
  });
  
  afterAll(async () => {
    await db.cleanup();
  });
  
  beforeEach(async () => {
    await db.truncate('users');
  });
  
  test('should create a new user', async () => {
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com'
    });
    
    expect(user.id).toBeDefined();
    expect(user.name).toBe('Test User');
    
    // Verify it's in the database
    const dbUser = await UserModel.findById(user.id);
    expect(dbUser).toEqual(user);
  });
});
```

## Testing Database Migrations

It's critical to test database migrations are reversible and idempotent:

```javascript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations, revertMigration } from '../../services/migrations.js';
import { db } from '../../services/database.js';

describe('Database migrations', () => {
  let client;
  
  beforeEach(async () => {
    // Create a clean database instance for migration testing
    client = await db.createTestInstance();
  });
  
  afterEach(async () => {
    await client.dropDatabase();
    await client.close();
  });
  
  test('should apply and revert migrations successfully', async () => {
    // Apply migrations
    await runMigrations(client);
    
    // Verify migration applied correctly
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'users'
      )
    `);
    expect(tableExists.rows[0].exists).toBe(true);
    
    // Revert the migration
    await revertMigration(client, 'create_users_table');
    
    // Verify migration reverted correctly
    const tableExistsAfterRevert = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'users'
      )
    `);
    expect(tableExistsAfterRevert.rows[0].exists).toBe(false);
  });
});
```

## Common Pitfalls and How to Avoid Them

1. **Connection Leaks**:
   - Always close connections in `afterAll` or `afterEach`
   - Use connection pooling correctly

2. **Insufficient Cleanup**:
   - Always use ROLLBACK for transaction-based tests
   - Reset sequences and clear all tables between tests

3. **Slow Tests**:
   - Batch related tests in a single transaction
   - Use a dedicated test database instance
   - Consider using in-memory databases for some tests

4. **Race Conditions**:
   - Ensure proper async/await usage in test setup and teardown
   - Avoid global state between tests

5. **Test Interference**:
   - Use unique schema names for parallel test runs
   - Never use the same database instance for parallel tests

## Creating Test Utilities

Let's create utility functions to make database testing easier:

```javascript
// utils/db-test-utils.js
import { db } from '../services/database.js';

/**
 * Creates a dedicated test database with isolation
 */
export async function createTestDatabase() {
  const uniqueName = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const testDb = {
    // Database connection
    client: null,
    
    // Initialize the test database
    async initialize() {
      this.client = await db.createConnection({
        database: 'postgres',
        application_name: 'vitest'
      });
      
      // Create a unique schema for isolation
      await this.client.query(`CREATE SCHEMA IF NOT EXISTS ${uniqueName}`);
      await this.client.query(`SET search_path TO ${uniqueName}`);
      
      // Create test tables
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS ${uniqueName}.test_table (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      return this;
    },
    
    // Execute a query
    async query(sql, params = []) {
      return this.client.query(sql, params);
    },
    
    // Start a transaction
    async beginTransaction() {
      await this.client.query('BEGIN');
    },
    
    // Commit a transaction
    async commitTransaction() {
      await this.client.query('COMMIT');
    },
    
    // Rollback a transaction
    async rollbackTransaction() {
      await this.client.query('ROLLBACK');
    },
    
    // Clean up the test database
    async cleanup() {
      try {
        // Drop the schema and all its objects
        await this.client.query(`DROP SCHEMA IF EXISTS ${uniqueName} CASCADE`);
      } finally {
        // Close the connection
        await this.client.end();
      }
    }
  };
  
  return testDb;
}

/**
 * Seeds the database with test data
 */
export async function seedTestData(client, data = {}) {
  // Example implementation for seeding test data
  if (data.users) {
    for (const user of data.users) {
      await client.query(
        'INSERT INTO users(name, email) VALUES($1, $2) RETURNING id',
        [user.name, user.email]
      );
    }
  }
  
  // Add more entity types as needed
  
  return client;
}

/**
 * Clears all test data
 */
export async function clearTestData(client) {
  // Get all tables in the current schema
  const tablesResult = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = current_schema()
  `);
  
  // Disable triggers temporarily
  await client.query('SET session_replication_role = replica');
  
  // Truncate all tables
  for (const row of tablesResult.rows) {
    await client.query(`TRUNCATE TABLE ${row.tablename} RESTART IDENTITY CASCADE`);
  }
  
  // Re-enable triggers
  await client.query('SET session_replication_role = DEFAULT');
  
  return client;
}
```

## Example: Testing the Users API

Here's a complete example of testing a user API with database operations:

```javascript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData, clearTestData } from '../../utils/db-test-utils.js';
import { app } from '../../server/app.js';
import supertest from 'supertest';

describe('Users API', () => {
  let testDb;
  let request;
  
  beforeAll(async () => {
    // Set up the test database
    testDb = await createTestDatabase();
    await testDb.initialize();
    
    // Configure app to use test database
    process.env.TEST_MODE = 'true';
    process.env.TEST_DB_CLIENT = testDb.client;
    
    // Create supertest client
    request = supertest(app);
  });
  
  afterAll(async () => {
    // Clean up
    delete process.env.TEST_MODE;
    delete process.env.TEST_DB_CLIENT;
    await testDb.cleanup();
  });
  
  beforeEach(async () => {
    // Clear all data before each test
    await clearTestData(testDb.client);
    
    // Seed with test data
    await seedTestData(testDb.client, {
      users: [
        { name: 'Test User', email: 'test@example.com' }
      ]
    });
  });
  
  test('GET /api/users should return all users', async () => {
    const response = await request.get('/api/users');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Test User');
  });
  
  test('POST /api/users should create a new user', async () => {
    const response = await request
      .post('/api/users')
      .send({
        name: 'New User',
        email: 'new@example.com'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('New User');
    
    // Verify in database
    const dbResult = await testDb.query(
      'SELECT * FROM users WHERE email = $1',
      ['new@example.com']
    );
    expect(dbResult.rows).toHaveLength(1);
  });
  
  test('PUT /api/users/:id should update a user', async () => {
    // Get existing user
    const users = await testDb.query('SELECT * FROM users');
    const userId = users.rows[0].id;
    
    const response = await request
      .put(`/api/users/${userId}`)
      .send({
        name: 'Updated Name',
        email: 'updated@example.com'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Name');
    
    // Verify in database
    const dbResult = await testDb.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    expect(dbResult.rows[0].name).toBe('Updated Name');
  });
  
  test('DELETE /api/users/:id should delete a user', async () => {
    // Get existing user
    const users = await testDb.query('SELECT * FROM users');
    const userId = users.rows[0].id;
    
    const response = await request.delete(`/api/users/${userId}`);
    
    expect(response.status).toBe(204);
    
    // Verify deletion in database
    const dbResult = await testDb.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    expect(dbResult.rows).toHaveLength(0);
  });
});
```

## Next Steps for Database Testing Migration

1. Create shared database testing utilities
2. Update existing database tests to use Vitest syntax
3. Implement proper isolation patterns in all test suites
4. Add transaction support for all database tests
5. Document database-specific testing patterns in the codebase
6. Update the continuous integration pipeline to run database tests correctly

## Conclusion

Proper database testing requires careful setup, thorough cleanup, and proper isolation. By following these patterns and using the utility functions provided, you can create reliable and fast database tests with Vitest.

Remember that every database test should be isolated, repeatable, and leave no trace after completion.