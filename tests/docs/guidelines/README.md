# Testing Guidelines Documentation

This directory contains comprehensive documentation about testing best practices, frameworks, and guidelines for our project.

## Available Guidelines

### Testing Framework Guidelines

- [Test Development Guide](./tests/docs/guidelines/test_development_guide.md) - Core guide for developing tests
- [Socket.IO Testing Best Practices](./SOCKETIO_TESTING_BEST_PRACTICES.md) - Best practices for testing Socket.IO

### Mocking Guidelines

- [Mock Guidelines](./MOCK_GUIDELINES.md) - General mocking guidelines
- [Vitest Mocking Guide](./tests/docs/guidelines/vitest_mocking_guide.md) - Essential guide for Vitest mocks
- [Vitest Mocking Guidelines](./tests/docs/guidelines/vitest_mocking_guidelines.md) - Detailed mocking guidelines
- [Module Mocking Guidelines](./tests/docs/guidelines/vitest_module_mocking_guidelines.md) - ES module mocking patterns

### Testing Patterns and Techniques

- [Error Handling Best Practices](./tests/docs/guidelines/error_handling_best_practices.md) - Guidelines for testing error scenarios
- [Time Testing Best Practices](./tests/docs/guidelines/test_timing_best_practices.md) - Testing time-dependent code
- [Non-Deterministic Error Testing](./NON_DETERMINISTIC_ERROR_TESTING.md) - Testing non-deterministic behavior

## How to Use These Guidelines

Each document provides specific guidance for different aspects of testing. If you're new to testing in this project, start with the [Test Development Guide](./tests/docs/guidelines/test_development_guide.md) for a comprehensive overview.

For specific testing challenges, refer to the relevant specialized guide (e.g., mocking, error handling, etc.).

## Contributing to Guidelines

When adding new testing guidelines or modifying existing ones:

1. Place the document in this directory
2. Update this README to include the new document
3. Ensure the document follows our standard format with clear examples
4. Cross-reference related guidelines where appropriate