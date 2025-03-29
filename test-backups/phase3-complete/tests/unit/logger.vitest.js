import { describe, it, expect } from 'vitest';
import logger from '../../utils/logger.js';
import { createNamespace } from 'cls-hooked';

describe('Logger', () => {
  // Test that logger exists and has expected methods
  it('logger has expected methods', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  // Test the addTraceId method
  it('logger has addTraceId method', () => {
    expect(typeof logger.addTraceId).toBe('function');
  });

  // Test that logging doesn't throw errors
  it('logs messages without errors', () => {
    expect(() => {
      logger.info('Test log message');
    }).not.toThrow();
    
    expect(() => {
      logger.info('Test message', { data: 'test' });
    }).not.toThrow();
  });
});