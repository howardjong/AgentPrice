# Testing Patterns for Search Utilities

This document outlines the testing patterns implemented for the `searchUtils.js` module, focusing on testability improvements through dependency injection and function extraction.

## Key Improvements

### 1. Extracting Core Functionality

We extracted the text search logic into a separate, testable function called `_performTextSearch`:

```javascript
export function _performTextSearch(collection, query) {
  if (!query || !collection || !Array.isArray(collection)) {
    return collection || [];
  }
  
  const lowerCaseQuery = query.toLowerCase();
  
  return collection.filter(item => 
    (item.title && item.title.toLowerCase().includes(lowerCaseQuery)) || 
    (item.description && item.description.toLowerCase().includes(lowerCaseQuery)) ||
    (item.content && item.content.toLowerCase().includes(lowerCaseQuery))
  );
}
```

This approach:
- Makes the core text search logic separately testable
- Allows direct testing of the filtering logic without dependencies
- Enables mocking of this specific part of the pipeline

### 2. Dependency Injection Pattern

The `search` function was modified to accept an optional test search function:

```javascript
export function search(collection, params = {}, textSearchFn = null) {
  // ...
  const performTextSearch = textSearchFn || _performTextSearch;
  // ...
  results = performTextSearch(collection, query);
  // ...
}
```

Benefits:
- Allows tests to inject alternative implementations
- Makes tests more focused and less brittle
- Decouples the search function from specific implementations
- Enables testing of later stages of the pipeline without testing earlier stages

### 3. Resilient Module Structure

The module structure was made more resilient for testing:

- Used simple console-based logger instead of external dependencies
- Removed external dependencies like Redis client
- Provided both named exports and a default export for compatibility

## Testing Approaches

### 1. Direct Text Search Testing

Tests can directly verify the behavior of the text search function:

```javascript
it('should filter items based on text match in title and content', () => {
  const results = _performTextSearch(testCollection, 'machine learning');
  
  expect(results).toHaveLength(2);
  expect(results[0].id).toBe('1');
  expect(results[1].id).toBe('4');
});
```

### 2. Mock Injection Testing

Tests can inject mock functions to isolate specific parts of the pipeline:

```javascript
it('should use the injected text search function', () => {
  const mockTextSearch = vi.fn((collection) => {
    return collection.filter(item => item.id === '1' || item.id === '4');
  });
  
  const result = searchUtils.search(testCollection, { 
    query: 'anything'
  }, mockTextSearch);
  
  expect(mockTextSearch).toHaveBeenCalled();
  expect(result.results).toHaveLength(2);
});
```

### 3. Integration Testing

Tests can verify the entire search pipeline works together:

```javascript
it('should perform actual text search when no mock is provided', () => {
  const result = searchUtils.search(testCollection, { 
    query: 'machine learning'
  });
  
  expect(result.results).toHaveLength(2);
  expect(result.pagination.total).toBe(2);
});
```

## Best Practices Implemented

1. **Single Responsibility Principle**: Each function has a clear, focused purpose
2. **Dependency Injection**: External dependencies can be replaced for testing
3. **Pure Functions**: Core logic uses pure functions where possible
4. **Error Handling**: All functions handle edge cases gracefully
5. **Default Options**: Functions provide sensible defaults
6. **Explicit Parameters**: All dependencies are passed explicitly rather than imported
7. **Testable Units**: Functions are sized appropriately for testing

## Usage Recommendations

When testing search functionality:

1. Use `_performTextSearch` directly when testing text search logic
2. Use dependency injection when testing other parts of the search pipeline
3. Create appropriate test fixtures that match the expected search behavior
4. Test edge cases like empty collections, null values, and pagination limits
5. Mock external dependencies like Redis cache when testing the full pipeline

## Applied Testing Pattern Categories

- **Extraction**: Pulling out core logic into separate functions
- **Dependency Injection**: Passing dependencies rather than importing them
- **Resilient Imports**: Handling import failures gracefully
- **Function Composition**: Building complex behavior from simple functions
- **Pure Functions**: Using functions without side effects
- **Parameter Defaults**: Providing sensible defaults for optional parameters