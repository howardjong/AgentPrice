# Database Testing Patterns

This document outlines the recommended patterns for database testing in the Multi-LLM Research System.

## Table of Contents

1. [Overview](#overview)
2. [Testing Approaches](#testing-approaches)
   - [Integration Tests with Real Database](#integration-tests-with-real-database)
   - [Unit Tests with Mocked Storage](#unit-tests-with-mocked-storage)
   - [Transaction Isolation](#transaction-isolation)
3. [Testing Utilities](#testing-utilities)
   - [Test Database Setup](#test-database-setup)
   - [Test Data Creation](#test-data-creation)
   - [Mock Database](#mock-database)
4. [Best Practices](#best-practices)
5. [Example Tests](#example-tests)

## Overview

The Multi-LLM Research System uses PostgreSQL with Drizzle ORM for data persistence. The storage layer is abstracted through the `IStorage` interface, which allows for different implementations:

- `MemStorage`: In-memory implementation used for development and simple testing
- `PgStorage`: PostgreSQL implementation used in production and for integration tests

This architecture enables flexible testing strategies that can adapt to different testing needs.

## Testing Approaches

### Integration Tests with Real Database

Integration tests verify that our storage implementation works correctly with an actual PostgreSQL database. These tests should:

- Use a dedicated test database or transaction isolation
- Reset the database state before each test
- Test the full range of database operations
- Verify that data persists and can be retrieved correctly

Example setup:
```typescript
// Using the setupTestDatabase utility
const { getStorage } = setupTestDatabase();
let storage: IStorage;

beforeAll(() => {
  storage = getStorage();
});

it('should create and retrieve data', async () => {
  // Test code that creates and retrieves data
});
```

### Unit Tests with Mocked Storage

Unit tests focus on testing business logic independently from the database. These tests should:

- Use a mocked storage implementation
- Test how components interact with the storage interface
- Verify that the right storage methods are called with the right parameters
- Be fast and isolated from external dependencies

Example setup:
```typescript
// Using the mockDatabase utility
const { mockStorage } = mockDatabase();
let service: SomeService;

beforeEach(() => {
  vi.resetAllMocks();
  service = new SomeService(mockStorage);
});

it('should call the right storage methods', async () => {
  // Test that service methods call the right storage methods
});
```

### Transaction Isolation

For tests that need to perform complex database operations without affecting other tests, transaction isolation provides a clean way to roll back changes after each test. These tests:

- Start a transaction before each test
- Roll back the transaction after each test
- Allow direct database access for complex scenarios
- Keep tests isolated from each other without full database resets

Example setup:
```typescript
let client: any;

beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});

it('should work within a transaction', async () => {
  // Test code that makes changes that will be rolled back
});
```

## Testing Utilities

### Test Database Setup

The `setupTestDatabase` utility in `tests/utils/db-test-utils.ts` provides:

- Automatic database reset before all tests
- Access to the database client and storage implementation
- Proper cleanup after tests

Usage:
```typescript
const { db, getStorage } = setupTestDatabase();
```

### Test Data Creation

The `createTestData` utility provides factory functions to create test data:

```typescript
// Create a test user
const user = await createTestData.user(storage);

// Create a test conversation
const conversation = await createTestData.conversation(storage, user.id);

// Create a test message
const message = await createTestData.message(storage, conversation.id);
```

Each factory accepts overrides to customize the created data.

### Mock Database

The `mockDatabase` utility creates a mock storage implementation:

```typescript
const { mockStorage, mockStore } = mockDatabase();
```

The `mockStorage` instance implements `IStorage` with vitest mock functions, and the `mockStore` provides direct access to the in-memory data.

## Best Practices

1. **Isolate tests**: Each test should be independent from others, with its own setup and data
2. **Clean up after tests**: Always clean up resources (database connections, files, etc.)
3. **Use the right testing approach**: Integration tests for data integrity, unit tests for business logic
4. **Avoid shared state**: Don't rely on data created in other tests
5. **Make tests deterministic**: Tests should pass consistently without flakiness
6. **Test both success and failure cases**: Verify error handling works correctly
7. **Use meaningful assertions**: Assertions should verify the important aspects of the test
8. **Keep tests focused**: Each test should verify one specific behavior

## Example Tests

See the following example tests for different testing approaches:

- `tests/storage/pg-storage.test.ts`: Integration tests with a real database
- `tests/storage/mock-storage.test.ts`: Unit tests with a mocked storage implementation
- `tests/storage/transaction-isolation.test.ts`: Tests using transaction isolation

These examples demonstrate how to use the testing utilities and follow the recommended testing patterns.