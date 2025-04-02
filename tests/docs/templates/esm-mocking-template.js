/**
 * ES Module Mocking Template
 * 
 * This template demonstrates the best practices for mocking ES modules in Vitest.
 * Use this as a reference when creating or refactoring tests that need to mock modules.
 */

// ⭐ IMPORTANT: Place vi.mock() calls before any imports
// This ensures the mocks are established before modules are loaded
vi.mock('../path/to/dependency.js', async () => {
  // Get the original module if you need to preserve some functionality
  const actual = await vi.importActual('../path/to/dependency.js');
  
  // Return a mocked version of the module
  return {
    // ⭐ IMPORTANT: Include the __esModule flag for ES modules
    __esModule: true,
    
    // If mocking a default export
    default: {
      // Preserve some original functionality
      ...actual.default,
      
      // Override specific methods
      someMethod: vi.fn().mockReturnValue('mocked result'),
      
      // Methods that track calls but preserve functionality
      callTrackingMethod: vi.fn((...args) => actual.default.callTrackingMethod(...args)),
    },
    
    // If mocking named exports
    namedExport: vi.fn().mockReturnValue('mocked named export'),
  };
});

// ⭐ Other mocks should also come before imports
vi.mock('../path/to/another-dependency.js');

// Now import the modules you want to test
import { default as moduleUnderTest } from '../path/to/module-under-test.js';
import { someUtility } from '../path/to/utilities.js';

describe('Module Under Test', () => {
  // ⭐ IMPORTANT: Reset modules between tests for isolation
  beforeEach(() => {
    vi.resetModules();
    
    // ⭐ Clear mock state before each test
    vi.clearAllMocks();
  });
  
  // ⭐ IMPORTANT: Restore original implementations after tests
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  // Clean up after all tests are done
  afterAll(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });
  
  test('should use mocked dependency', async () => {
    // For dynamic test-specific mocking, you can use inline spies
    const { default: dependency } = await import('../path/to/dependency.js');
    vi.spyOn(dependency, 'someMethod').mockReturnValueOnce('test-specific mock');
    
    // Call the module under test
    const result = moduleUnderTest.methodThatUsesDependency();
    
    // Verify the mock was used
    expect(dependency.someMethod).toHaveBeenCalled();
    expect(result).toBe('test-specific mock');
  });
  
  test('should handle environment variables correctly', async () => {
    // ⭐ Set environment variables before importing modules that check them
    Object.defineProperty(process.env, 'TEST_FEATURE_FLAG', { value: 'true' });
    
    // Re-import the module to pick up the new env setting
    vi.resetModules();
    const { default: reloadedModule } = await import('../path/to/module-under-test.js');
    
    // Test with the new environment
    expect(reloadedModule.featureFlagEnabled()).toBe(true);
  });
  
  test('should track calls to dependencies', async () => {
    // Create a tracker for complex interactions
    const callTracker = [];
    
    // Re-mock for this specific test scenario
    vi.resetModules();
    vi.mock('../path/to/dependency.js', () => ({
      __esModule: true,
      default: {
        trackedMethod: vi.fn((...args) => {
          callTracker.push(args);
          return 'tracked response';
        }),
      },
    }));
    
    // Import module under test after mocking
    const { default: reloadedModule } = await import('../path/to/module-under-test.js');
    
    // Use the module
    reloadedModule.methodThatUsesDependency();
    
    // Check tracked calls
    expect(callTracker.length).toBe(1);
    expect(callTracker[0]).toEqual(['expected', 'arguments']);
  });
});