# Testing Documentation

This directory contains comprehensive documentation related to testing in our project.

## Directory Structure

- [`/guidelines`](./guidelines/README.md) - Best practices, frameworks, and guidelines for testing
- [`/migration`](./migration/README.md) - Documentation about our Jest to Vitest test migration effort
- [`/coverage`](./coverage/README.md) - Test coverage planning, tracking, and reporting

## Key Documentation Files

### Testing Guidelines

- [Mock Guidelines](./guidelines/MOCK_GUIDELINES.md) - Best practices for mocking in tests
- [Socket.IO Testing Best Practices](./guidelines/SOCKETIO_TESTING_BEST_PRACTICES.md) - Guidance for Socket.IO testing
- [Error Handling Best Practices](./guidelines/ERROR_HANDLING_BEST_PRACTICES.md) - Testing error scenarios
- [Time Testing Best Practices](./guidelines/TIME_TESTING_BEST_PRACTICES.md) - Testing time-dependent code
- [Non-Deterministic Error Testing](./guidelines/NON_DETERMINISTIC_ERROR_TESTING.md) - Testing for flaky network conditions and race conditions
- [Test Development Guide](./guidelines/TEST_DEVELOPMENT_GUIDE.md) - Comprehensive guide for developing tests
- [Vitest Mocking Guide](./guidelines/VITEST_MOCKING_GUIDE.md) - Quick reference guide for Vitest mocking
- [Vitest Mocking Guidelines](./guidelines/VITEST_MOCKING_GUIDELINES.md) - Detailed guidelines for mocking with Vitest
- [Vitest Module Mocking Guidelines](./guidelines/VITEST_MODULE_MOCKING_GUIDELINES.md) - Guidelines for ES module mocking in Vitest

### Test Migration

This directory contains documentation related to our Jest to Vitest test migration:

- [Migration Master Document](./migration/README.md) - Complete reference for Jest to Vitest migration
  - Fully consolidated from all documents including those in the archive folder
  - Includes strategy, progress tracking, implementation guidelines, mocking patterns, and troubleshooting

### Test Coverage

- [Coverage Plan](./coverage/TEST_COVERAGE_PLAN.md) - Detailed coverage goals and implementation strategy
- [Coverage Status](./coverage/TEST_COVERAGE_STATUS_2025-03-31.md) - Current coverage metrics and analysis

## Maintenance

When updating any test documentation, please ensure you place it in the appropriate subdirectory and update the corresponding README files.