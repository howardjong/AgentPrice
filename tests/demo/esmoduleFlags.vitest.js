import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ESMClient from '../../services/client.js';
import { processData } from '../../utils/dataProcessor.js';

// Example of properly mocked CommonJS module - no __esModule flag needed
vi.mock('../../utils/logger.js', () => {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };
});

// Example of ES module with properly set __esModule flag
vi.mock('../../services/client.js', () => ({
  __esModule: true,
  default: {
    connect: vi.fn().mockResolvedValue(true),
    fetch: vi.fn().mockResolvedValue({ data: 'test' }),
    disconnect: vi.fn().mockResolvedValue(true)
  }
}));

// Example of ES module with named exports and __esModule flag
vi.mock('../../utils/dataProcessor.js', () => ({
  __esModule: true,
  processData: vi.fn().mockReturnValue({ processed: true }),
  formatData: vi.fn().mockReturnValue('formatted'),
  analyzeData: vi.fn().mockReturnValue({ analysis: true })
}));

// Examples showing how each mock approach works with imports
describe('ES Module Flags Demo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Default exports', () => {
    it('should correctly handle default exports with __esModule: true flag', async () => {
      // Default export works because of __esModule: true
      const connected = await ESMClient.connect();
      expect(connected).toBe(true);
      expect(ESMClient.connect).toHaveBeenCalled();
    });
  });
  
  describe('Named exports', () => {
    it('should correctly handle named exports with __esModule: true flag', () => {
      // Named exports work because of __esModule: true
      const result = processData({});
      expect(result).toEqual({ processed: true });
      expect(processData).toHaveBeenCalled();
    });
  });
});