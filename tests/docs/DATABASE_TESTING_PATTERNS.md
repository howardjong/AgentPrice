# Database Testing Patterns

This document outlines the recommended patterns for testing database operations in the Multi-LLM Research System. The system uses a combination of testing approaches to ensure database operations work correctly.

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

### Transaction Isolation Tests

Transaction isolation tests use database transactions to isolate test runs. These tests should:

- Begin a transaction before each test
- Roll back the transaction after each test
- Test operations against the actual database
- Ensure changes from one test don't affect other tests

Example setup:
```typescript
// Using the setupTransactionTest utility
const { db } = setupTransactionTest();
const storage = pgStorage;

it('should create and retrieve data in a transaction', async () => {
  // Test code that manipulates and queries data
  // All changes will be rolled back after the test
});
```

## Testing Utilities

The `tests/utils/db-test-utils.ts` file provides several utilities to help with database testing:

### setupTestDatabase()

Sets up a test database environment and provides access to the storage implementation.

```typescript
const { getStorage } = setupTestDatabase();
let storage: IStorage;

beforeAll(() => {
  storage = getStorage();
});
```

### createTestData

Factory functions to create test data for various entities.

```typescript
// Create a test user
const user = await createTestData.user(storage);

// Create a test conversation
const conversation = await createTestData.conversation(storage, user.id);

// Create a test message
const message = await createTestData.message(storage, conversation.id);
```

### mockDatabase()

Creates a mock storage implementation for unit testing.

```typescript
const { mockStorage } = mockDatabase();

// Configure mock behavior
vi.mocked(mockStorage.getUser).mockResolvedValue({
  id: 1,
  username: 'testuser',
  password: 'password123'
});
```

### setupTransactionTest()

Sets up transaction isolation for database tests.

```typescript
const { db } = setupTransactionTest();

it('test with transaction isolation', async () => {
  // Use db to directly manipulate the database
  // All changes will be rolled back after the test
});
```

## Example Tests

See the following example tests for different testing approaches:

- `tests/storage/pg-storage.test.ts`: Integration tests with a real database
- `tests/storage/mock-storage.test.ts`: Unit tests with a mocked storage implementation
- `tests/storage/transaction-isolation.test.ts`: Tests using transaction isolation

These examples demonstrate how to use the testing utilities and follow the recommended testing patterns.

## Best Practices

1. **Clean up after tests**: Always clean up data created during tests, either by using transactions or explicit cleanup in `afterEach`/`afterAll` hooks.

2. **Use unique identifiers**: Use timestamps or random values to create unique identifiers for test data to avoid conflicts.

3. **Test both success and error paths**: Verify that your code correctly handles both successful operations and error conditions.

4. **Don't rely on test order**: Each test should be independent and should not rely on the state from previous tests.

5. **Use appropriate assertions**: Be specific about what you're testing and use the right assertions to verify the expected behavior.

6. **Avoid testing external services**: When testing database operations, mock external services like APIs or email sending.

7. **Use descriptive test names**: Write clear, descriptive test names that explain what functionality is being tested.

8. **Keep tests focused**: Each test should focus on a specific behavior or functionality, not try to test everything at once.

9. **Use transaction isolation when possible**: Transactions provide a clean way to isolate tests and can be faster than other cleanup methods.