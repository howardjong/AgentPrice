/**
 * Vitest Mock Debugging Tool
 * 
 * This is a diagnostic utility to help debug Vitest mocking behavior.
 * It illustrates how different mocking approaches work and their limitations.
 * 
 * Run this test with:
 *   npx vitest run tests/vitest/diagnostics/mock-debug.vitest.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// -------------------------------------------------------------------------
// Mock Variable Declaration Section
// -------------------------------------------------------------------------

// These mock functions must be declared BEFORE any imports due to hoisting
const mockDefaultFunction = vi.fn();
const mockNamedFunction1 = vi.fn();
const mockNamedFunction2 = vi.fn();

// Variable used for testing hoisting behavior
const DECLARED_BEFORE_IMPORTS = 'I was defined before imports';
let MODULE_TYPE = 'unknown';

// -------------------------------------------------------------------------
// Mock Implementations Section
// -------------------------------------------------------------------------

// Mock a module completely with vi.mock
vi.mock('../../utils/logger', () => {
  // This shows accessing a variable defined BEFORE mock declarations
  console.log('Inside vi.mock factory - can access DECLARED_BEFORE_IMPORTS:', DECLARED_BEFORE_IMPORTS);
  
  // Try to access a variable that will be defined AFTER mock declarations (will not work)
  try {
    console.log('Inside vi.mock factory - trying to access DECLARED_AFTER_IMPORTS:', DECLARED_AFTER_IMPORTS);
  } catch (error) {
    console.log('Inside vi.mock factory - ERROR accessing DECLARED_AFTER_IMPORTS:', error.message);
  }
  
  return {
    default: {
      info: mockDefaultFunction,
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    },
    // Named exports
    createLogger: mockNamedFunction1,
    LOG_LEVELS: ['info', 'warn', 'error', 'debug']
  };
});

// -------------------------------------------------------------------------
// Import Section
// -------------------------------------------------------------------------

// Import the mocked module
import logger, { createLogger, LOG_LEVELS } from '../../utils/logger';

// -------------------------------------------------------------------------
// Variables declared AFTER imports
// -------------------------------------------------------------------------

// This variable won't be accessible in the vi.mock factory due to hoisting
const DECLARED_AFTER_IMPORTS = 'I was defined after imports';

// -------------------------------------------------------------------------
// Test Suites
// -------------------------------------------------------------------------

describe('Vitest Mock Hoisting Behavior Debug', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Set up default mock implementations
    mockDefaultFunction.mockImplementation((...args) => {
      console.log('Mocked logger.info called with:', ...args);
      return true;
    });
    
    mockNamedFunction1.mockImplementation((options) => {
      console.log('Mocked createLogger called with options:', options);
      return {
        info: mockDefaultFunction,
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      };
    });
  });
  
  it('should demonstrate mock hoisting behavior', () => {
    console.log('\n=== Mock Hoisting Behavior ===');
    console.log('Variables accessible to tests:');
    console.log('- DECLARED_BEFORE_IMPORTS:', DECLARED_BEFORE_IMPORTS);
    console.log('- DECLARED_AFTER_IMPORTS:', DECLARED_AFTER_IMPORTS);
    
    // This shows what happens with the hoisting - the vi.mock call is
    // executed before any imports, and before any code in the file body 
    // outside of declarations
  });
  
  it('should properly mock the default export', () => {
    // Exercise the mock
    logger.info('This is a test message');
    
    // Verify the mock was called
    expect(mockDefaultFunction).toHaveBeenCalledWith('This is a test message');
    expect(mockDefaultFunction).toHaveBeenCalledTimes(1);
  });
  
  it('should properly mock named exports', () => {
    // Exercise the named export mock
    const customLogger = createLogger({ level: 'debug' });
    
    // Verify the mock was called with the right arguments
    expect(mockNamedFunction1).toHaveBeenCalledWith({ level: 'debug' });
    
    // Use the returned mock object
    customLogger.info('Message from custom logger');
    
    // Verify the internal function was called
    expect(mockDefaultFunction).toHaveBeenCalledWith('Message from custom logger');
  });
  
  it('should demonstrate constant mock data', () => {
    // Verify mocked constant data
    expect(LOG_LEVELS).toEqual(['info', 'warn', 'error', 'debug']);
    
    // Try to modify it (will fail if properly mocked as a constant)
    try {
      LOG_LEVELS.push('trace');
    } catch (error) {
      console.log('Attempted to modify mocked constant data:', error.message);
    }
  });
});

// -------------------------------------------------------------------------
// Dynamic Mock Creation Pattern
// -------------------------------------------------------------------------

describe('Dynamic Mock Creation Pattern', () => {
  // This pattern can be used when you need to create mocks that depend
  // on variables only available at runtime
  
  it('should create and use dynamic mocks at runtime', () => {
    // Create a dynamic mock (this doesn't replace the imported module)
    const dynamicMock = {
      info: vi.fn().mockImplementation(msg => `Dynamic mock: ${msg}`),
      warn: vi.fn()
    };
    
    // Use the dynamic mock directly
    const result = dynamicMock.info('Hello');
    
    expect(result).toBe('Dynamic mock: Hello');
    expect(dynamicMock.info).toHaveBeenCalledWith('Hello');
  });
  
  it('should demonstrate mock spying when full replacement is difficult', () => {
    // Sometimes you need to spy on method calls without fully replacing the module
    
    // Create an object to spy on
    const serviceObj = {
      getData: () => 'original data',
      processItem: (item) => `processed ${item}`
    };
    
    // Set up a spy
    const spy = vi.spyOn(serviceObj, 'getData');
    
    // Optionally change its implementation
    spy.mockImplementation(() => 'spy data');
    
    // Use the object with the spy
    const result = serviceObj.getData();
    
    // The other method is unchanged
    const processed = serviceObj.processItem('test');
    
    expect(result).toBe('spy data');
    expect(processed).toBe('processed test');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// -------------------------------------------------------------------------
// Module Detection Pattern
// -------------------------------------------------------------------------

describe('Module Type Detection Pattern', () => {
  // This pattern can help diagnose issues with ESM vs CommonJS modules
  
  beforeEach(() => {
    // Determine module type using metavariables
    if (typeof __dirname !== 'undefined') {
      MODULE_TYPE = 'CommonJS';
    } else if (typeof import.meta !== 'undefined') {
      MODULE_TYPE = 'ESM';
    }
  });
  
  it('should detect the current module type', () => {
    console.log('\n=== Module Type Detection ===');
    console.log('Current module type:', MODULE_TYPE);
    console.log('import.meta available:', typeof import.meta !== 'undefined');
    console.log('__dirname available:', typeof __dirname !== 'undefined');
  });
});