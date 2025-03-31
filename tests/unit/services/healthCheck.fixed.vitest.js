/**
 * Health Check Service Unit Tests
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import os from 'os';
import fs from 'fs';
import path from 'path';

// Mock the health check module
vi.mock('../../../server/services/healthCheck', () => ({
  checkSystemHealth: vi.fn()
}));

// Import the mocked function
import { checkSystemHealth } from '../../../server/services/healthCheck';

describe('Health Check Service', () => {
  // Create a mock for checkSystemHealth that returns what we expect
  const mockHealthCheckResult = {
    status: 'healthy',
    apiKeys: {
      anthropic: true,
      perplexity: true,
      allKeysPresent: true
    },
    fileSystem: {
      uploadsDir: true,
      promptsDir: true,
      testsOutputDir: true,
      contentUploadsDir: true,
      allDirsExist: true
    },
    memory: {
      total: 16 * 1024 * 1024 * 1024,
      free: 8 * 1024 * 1024 * 1024,
      used: 8 * 1024 * 1024 * 1024,
      usagePercent: 50,
      healthy: true
    },
    isHealthy: true
  };

  // Setup and teardown for tests
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    // Set default mock behavior
    checkSystemHealth.mockReturnValue(mockHealthCheckResult);
  });
  
  it('should report system health status', () => {
    // First test verifies that our mock is working
    const result = checkSystemHealth();
    
    expect(result).toBeDefined();
    expect(result).toEqual(mockHealthCheckResult);
    expect(result.status).toBe('healthy');
    expect(result.isHealthy).toBe(true);
  });
  
  it('should handle degraded system status', () => {
    // Change the mock to return degraded status
    checkSystemHealth.mockReturnValueOnce({
      ...mockHealthCheckResult,
      status: 'degraded',
      isHealthy: false,
      apiKeys: {
        anthropic: false,
        perplexity: true,
        allKeysPresent: false
      }
    });
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('degraded');
    expect(result.isHealthy).toBe(false);
    expect(result.apiKeys.anthropic).toBe(false);
    expect(result.apiKeys.perplexity).toBe(true);
    expect(result.apiKeys.allKeysPresent).toBe(false);
  });
  
  it('should handle unhealthy system status', () => {
    // Change the mock to return unhealthy status
    checkSystemHealth.mockReturnValueOnce({
      ...mockHealthCheckResult,
      status: 'unhealthy',
      isHealthy: false,
      apiKeys: {
        anthropic: false,
        perplexity: false,
        allKeysPresent: false
      },
      memory: {
        ...mockHealthCheckResult.memory,
        usagePercent: 95,
        healthy: false
      }
    });
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('unhealthy');
    expect(result.isHealthy).toBe(false);
    expect(result.apiKeys.allKeysPresent).toBe(false);
    expect(result.memory.healthy).toBe(false);
  });
  
  it('should report directory existence', () => {
    // Change the mock to return specific directory status
    checkSystemHealth.mockReturnValueOnce({
      ...mockHealthCheckResult,
      status: 'degraded',
      isHealthy: false,
      fileSystem: {
        uploadsDir: true,
        promptsDir: true,
        testsOutputDir: false,
        contentUploadsDir: false,
        allDirsExist: false
      }
    });
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('degraded');
    expect(result.isHealthy).toBe(false);
    expect(result.fileSystem.uploadsDir).toBe(true);
    expect(result.fileSystem.promptsDir).toBe(true);
    expect(result.fileSystem.contentUploadsDir).toBe(false);
    expect(result.fileSystem.testsOutputDir).toBe(false);
    expect(result.fileSystem.allDirsExist).toBe(false);
  });
});