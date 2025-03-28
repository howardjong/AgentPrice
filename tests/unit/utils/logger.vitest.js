
/**
 * Logger Unit Tests using Vitest
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import logger from '../../../utils/logger.js';

// Create a minimal test that simply verifies the logger interface
describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have appropriate logging methods', () => {
    // Verify the logger has the expected API
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log info messages without errors', () => {
    // Just make sure it doesn't throw
    expect(() => {
      logger.info('Test info message');
    }).not.toThrow();
  });

  it('should log error messages without errors', () => {
    expect(() => {
      logger.error('Test error message');
    }).not.toThrow();
  });

  it('should log warning messages without errors', () => {
    expect(() => {
      logger.warn('Test warning message');
    }).not.toThrow();
  });

  it('should handle metadata in log messages', () => {
    const metadata = { userId: '123', action: 'test' };
    
    expect(() => {
      logger.info('Test message with metadata', metadata);
    }).not.toThrow();
  });
});
