/**
 * Health Check Service Unit Tests
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import os from 'os';
import fs from 'fs';
import path from 'path';

// Import function directly to avoid testing the mocked version
import * as healthCheckModule from '../../../server/services/healthCheck';

// Store original implementation
const originalCheckSystemHealth = healthCheckModule.checkSystemHealth;

// Mock dependencies
vi.mock('os', () => {
  return {
    totalmem: vi.fn(),
    freemem: vi.fn()
  };
});

vi.mock('fs', () => {
  return {
    existsSync: vi.fn()
  };
});

describe('Health Check Service', () => {
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup default mock behavior
    os.totalmem.mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB
    os.freemem.mockReturnValue(8 * 1024 * 1024 * 1024);   // 8GB
    
    // Setup default file system checks
    fs.existsSync.mockImplementation((dirPath) => {
      if (dirPath.includes('uploads') || 
          dirPath.includes('prompts') || 
          dirPath.includes('content-uploads') ||
          dirPath.includes('tests/output')) {
        return true;
      }
      return false;
    });
    
    // Setup environment variables
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });
  
  it('should report healthy status when all checks pass', () => {
    const result = healthCheckModule.checkSystemHealth();
    
    expect(result.status).toBe('healthy');
    expect(result.isHealthy).toBe(true);
    
    // Verify API key check
    expect(result.apiKeys.anthropic).toBe(true);
    expect(result.apiKeys.perplexity).toBe(true);
    expect(result.apiKeys.allKeysPresent).toBe(true);
    
    // Verify file system check
    expect(result.fileSystem.uploadsDir).toBe(true);
    expect(result.fileSystem.promptsDir).toBe(true);
    expect(result.fileSystem.contentUploadsDir).toBe(true);
    expect(result.fileSystem.testsOutputDir).toBe(true);
    expect(result.fileSystem.allDirsExist).toBe(true);
    
    // Verify memory check
    expect(result.memory.usagePercent).toBe(50);
    expect(result.memory.healthy).toBe(true);
  });
  
  it('should report degraded status when API keys are missing', () => {
    // Remove API keys
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('degraded');
    expect(result.isHealthy).toBe(false);
    expect(result.apiKeys.anthropic).toBe(false);
    expect(result.apiKeys.perplexity).toBe(false);
    expect(result.apiKeys.allKeysPresent).toBe(false);
  });
  
  it('should report degraded status when directories are missing', () => {
    // Simulate missing directories
    fs.existsSync.mockImplementation(() => false);
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('degraded');
    expect(result.isHealthy).toBe(false);
    expect(result.fileSystem.uploadsDir).toBe(false);
    expect(result.fileSystem.promptsDir).toBe(false);
    expect(result.fileSystem.contentUploadsDir).toBe(false);
    expect(result.fileSystem.allDirsExist).toBe(false);
  });
  
  it('should report degraded status when memory usage is high', () => {
    // Simulate high memory usage (95%)
    os.totalmem.mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB
    os.freemem.mockReturnValue(0.8 * 1024 * 1024 * 1024); // 0.8GB (95% used)
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('degraded');
    expect(result.isHealthy).toBe(false);
    expect(result.memory.usagePercent).toBeCloseTo(95, 1);
    expect(result.memory.healthy).toBe(false);
  });
  
  it('should report unhealthy status when multiple critical checks fail', () => {
    // Simulate missing API keys
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    
    // Simulate high memory usage
    os.totalmem.mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB
    os.freemem.mockReturnValue(0.8 * 1024 * 1024 * 1024); // 0.8GB (95% used)
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('unhealthy');
    expect(result.isHealthy).toBe(false);
    expect(result.apiKeys.allKeysPresent).toBe(false);
    expect(result.memory.healthy).toBe(false);
  });
  
  it('should provide correct memory statistics', () => {
    // Set specific memory values for testing
    const totalMem = 32 * 1024 * 1024 * 1024; // 32GB
    const freeMem = 24 * 1024 * 1024 * 1024;  // 24GB
    const usedMem = totalMem - freeMem;       // 8GB
    const usagePercent = (usedMem / totalMem) * 100; // 25%
    
    os.totalmem.mockReturnValue(totalMem);
    os.freemem.mockReturnValue(freeMem);
    
    const result = checkSystemHealth();
    
    expect(result.memory.total).toBe(totalMem);
    expect(result.memory.free).toBe(freeMem);
    expect(result.memory.used).toBe(usedMem);
    expect(result.memory.usagePercent).toBe(usagePercent);
    expect(result.memory.healthy).toBe(true);
  });
  
  it('should check only required directories for healthy status', () => {
    // Make only the required directories exist
    fs.existsSync.mockImplementation((dirPath) => {
      if (dirPath.includes('uploads') || 
          dirPath.includes('prompts') || 
          dirPath.includes('content-uploads')) {
        return true;
      }
      return false;
    });
    
    const result = checkSystemHealth();
    
    // The status should still be healthy since testsOutputDir isn't required
    expect(result.status).toBe('healthy');
    expect(result.isHealthy).toBe(true);
    expect(result.fileSystem.testsOutputDir).toBe(false);
    expect(result.fileSystem.allDirsExist).toBe(true);
  });
  
  it('should handle one missing API key correctly', () => {
    // Remove only one API key
    delete process.env.ANTHROPIC_API_KEY;
    
    const result = checkSystemHealth();
    
    expect(result.status).toBe('degraded');
    expect(result.isHealthy).toBe(false);
    expect(result.apiKeys.anthropic).toBe(false);
    expect(result.apiKeys.perplexity).toBe(true);
    expect(result.apiKeys.allKeysPresent).toBe(false);
  });
  
  it('should reflect directory status accurately in the response', () => {
    // Setup specific directory existence
    fs.existsSync.mockImplementation((dirPath) => {
      if (dirPath.includes('uploads') || dirPath.includes('prompts')) {
        return true;
      }
      return false;
    });
    
    const result = checkSystemHealth();
    
    expect(result.fileSystem.uploadsDir).toBe(true);
    expect(result.fileSystem.promptsDir).toBe(true);
    expect(result.fileSystem.contentUploadsDir).toBe(false);
    expect(result.fileSystem.testsOutputDir).toBe(false);
    expect(result.fileSystem.allDirsExist).toBe(false);
  });
});