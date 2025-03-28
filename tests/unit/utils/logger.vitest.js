
/**
 * Logger Unit Tests using Vitest
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import logger from '../../../utils/logger.js';

// Mock console methods
const originalConsole = { ...console };

describe('Logger', () => {
  beforeEach(() => {
    // Spy on console methods
    console.info = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.debug = vi.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.info = originalConsole.info;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.debug = originalConsole.debug;
    
    vi.clearAllMocks();
  });

  it('should log info messages', () => {
    const message = 'Test info message';
    logger.info(message);
    expect(console.info).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    const message = 'Test error message';
    logger.error(message);
    expect(console.error).toHaveBeenCalled();
  });

  it('should log warning messages', () => {
    const message = 'Test warning message';
    logger.warn(message);
    expect(console.warn).toHaveBeenCalled();
  });

  it('should include metadata in log messages', () => {
    const message = 'Test message with metadata';
    const metadata = { userId: '123', action: 'test' };
    
    logger.info(message, metadata);
    
    expect(console.info).toHaveBeenCalled();
    const callArg = console.info.mock.calls[0][0];
    
    // Verify metadata is included
    expect(callArg).toContain('userId');
    expect(callArg).toContain('123');
    expect(callArg).toContain('action');
    expect(callArg).toContain('test');
  });
});
