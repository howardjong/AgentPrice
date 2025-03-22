// Using ES modules for Jest
import { jest } from '@jest/globals';
import logger from '../../utils/logger.js';
import { createNamespace } from 'cls-hooked';

describe('Logger', () => {
  // Test that logger exists and has expected methods
  test('logger has expected methods', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  // Test the addTraceId method
  test('logger has addTraceId method', () => {
    expect(typeof logger.addTraceId).toBe('function');
  });

  // Test that logging doesn't throw errors
  test('logs messages without errors', () => {
    expect(() => {
      logger.info('Test log message');
    }).not.toThrow();
    
    expect(() => {
      logger.info('Test message', { data: 'test' });
    }).not.toThrow();
  });
});