# Multi-LLM Research System Testing

This directory contains tests for the Multi-LLM Research System, focusing on ensuring proper functionality across all components.

## Database Testing

The system includes comprehensive database testing utilities and patterns for PostgreSQL with Drizzle ORM. These tests ensure our data storage and retrieval functions work correctly.

### Running Database Tests

To run the database tests:

```bash
./run-db-tests.sh
```

This will run all tests in the `tests/storage` directory with coverage reporting.

### Database Testing Patterns

The project uses several database testing approaches:

1. **Integration Tests** - Tests with a real PostgreSQL database
2. **Unit Tests with Mock Storage** - Tests using a mocked storage implementation
3. **Transaction Isolation** - Tests that run within transactions for isolation

See [DATABASE_TESTING_PATTERNS.md](docs/DATABASE_TESTING_PATTERNS.md) for detailed patterns and examples.

### Database Testing with Vitest

The project uses Vitest for testing, which offers several advantages for database testing:

- ESM compatibility
- Fast execution
- Good async support
- Detailed error reporting

See [DATABASE_TESTING_WITH_VITEST.md](docs/DATABASE_TESTING_WITH_VITEST.md) for detailed guide on testing with Vitest.

### Migration from Jest to Vitest

To migrate existing Jest database tests to Vitest:

```bash
./migrate-db-tests.sh
```

This will analyze your Jest tests and convert them to Vitest format, handling common patterns and adaptations needed.

## Testing Utilities

### Database Test Utils

The `tests/utils/db-test-utils.ts` file provides several utilities to help with database testing:

- `setupTestDatabase()` - Sets up a test database environment
- `createTestData` - Factory functions to create test data
- `mockDatabase()` - Creates a mock storage implementation
- `setupTransactionTest()` - Sets up transaction isolation

### Example Usage

Here's how to use the database testing utilities:

```typescript
// Integration test with real database
const { getStorage } = setupTestDatabase();
let storage: IStorage;

beforeAll(() => {
  storage = getStorage();
});

it('should create and retrieve data', async () => {
  // Create test data
  const user = await createTestData.user(storage);
  
  // Test functionality
  const retrievedUser = await storage.getUser(user.id);
  expect(retrievedUser).toEqual(user);
});
```

## Best Practices

1. Always clean up after tests
2. Use transaction isolation when possible
3. Don't rely on test order
4. Test both success and failure cases
5. Use appropriate assertions

## Documentation

For more detailed information, see:

- [DATABASE_TESTING_PATTERNS.md](docs/DATABASE_TESTING_PATTERNS.md)
- [DATABASE_TESTING_WITH_VITEST.md](docs/DATABASE_TESTING_WITH_VITEST.md)