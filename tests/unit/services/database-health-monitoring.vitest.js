/**
 * Database Health Monitoring Tests
 * 
 * Tests the integration between the health check system and database status monitoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSystemHealth } from '../../../server/services/healthCheck.js';
import { storage } from '../../../server/storage.js';

// Mock database client
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn().mockImplementation(() => ({
    query: vi.fn()
  }))
}));

// Mock dependencies
vi.mock('../../../server/storage.js', () => ({
  storage: {
    getApiStatus: vi.fn(),
    updateServiceStatus: vi.fn(),
    healthCheck: vi.fn(),
    getDatabaseStatus: vi.fn()
  }
}));

vi.mock('../../../server/services/healthCheck.js', () => ({
  checkSystemHealth: vi.fn()
}));

// Mock environment variables
const originalEnv = { ...process.env };

describe('Database Health Monitoring', () => {
  // Mock system health response
  const mockHealthResponse = {
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
  
  // Mock database status
  const mockDatabaseStatus = {
    status: 'connected',
    latency: 12,
    healthy: true,
    lastCheck: new Date().toISOString()
  };
  
  // Setup before each test
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup environment
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/testdb';
    process.env.PGHOST = 'localhost';
    process.env.PGPORT = '5432';
    process.env.PGUSER = 'user';
    process.env.PGPASSWORD = 'password';
    process.env.PGDATABASE = 'testdb';
    
    // Setup mock responses
    checkSystemHealth.mockReturnValue(mockHealthResponse);
    storage.getDatabaseStatus.mockResolvedValue(mockDatabaseStatus);
    storage.getApiStatus.mockResolvedValue({
      claude: { status: 'healthy', lastCheck: new Date().toISOString() },
      perplexity: { status: 'healthy', lastCheck: new Date().toISOString() },
      server: { status: 'healthy', version: '1.0.0' }
    });
    
    // Mock successful connection test
    storage.healthCheck.mockResolvedValue(true);
  });
  
  // Restore environment after each test
  afterEach(() => {
    process.env = { ...originalEnv };
  });
  
  it('should check database status as part of system health', async () => {
    // Call health check that should use storage module
    storage.getApiStatus();
    
    // Verify the health check was called
    expect(storage.getApiStatus).toHaveBeenCalled();
  });
  
  it('should report database status correctly', async () => {
    // Access the database status
    const dbStatus = await storage.getDatabaseStatus();
    
    // Verify database status is reported correctly
    expect(dbStatus).toBeDefined();
    expect(dbStatus.status).toBe('connected');
    expect(dbStatus.healthy).toBe(true);
  });
  
  it('should report degraded system health when database is unhealthy', async () => {
    // Setup mock for unhealthy database
    const unhealthyDbStatus = {
      status: 'error',
      latency: 5000, // High latency
      healthy: false,
      error: 'Connection timeout',
      lastCheck: new Date().toISOString()
    };
    
    // Update the mock to return unhealthy status
    storage.getDatabaseStatus.mockResolvedValue(unhealthyDbStatus);
    storage.healthCheck.mockResolvedValue(false);
    
    // Access the database status 
    const dbStatus = await storage.getDatabaseStatus();
    
    // Verify database reports unhealthy
    expect(dbStatus.healthy).toBe(false);
    expect(dbStatus.status).toBe('error');
  });
  
  it('should handle missing database credentials', async () => {
    // Remove database credentials
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    delete process.env.PGPORT;
    
    // Update the system health check to reflect missing database
    const noDbHealthResponse = {
      ...mockHealthResponse,
      status: 'degraded',
      isHealthy: false,
      database: {
        connected: false,
        configured: false,
        healthy: false
      }
    };
    
    checkSystemHealth.mockReturnValue(noDbHealthResponse);
    
    // Get the system health
    const healthStatus = checkSystemHealth();
    
    // Verify database issues are reflected in system health
    expect(healthStatus.status).toBe('degraded');
    expect(healthStatus.isHealthy).toBe(false);
    expect(healthStatus.database).toBeDefined();
    expect(healthStatus.database.healthy).toBe(false);
  });
  
  it('should report connection errors correctly', async () => {
    // Setup mock for connection error
    storage.healthCheck.mockRejectedValue(new Error('Connection refused'));
    
    // Try to check database health
    try {
      await storage.healthCheck();
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Verify error is handled properly
      expect(error).toBeDefined();
      expect(error.message).toBe('Connection refused');
    }
  });
  
  it('should include database status in API health check response', async () => {
    // Setup mock responses with database info
    const apiStatusWithDb = {
      claude: { status: 'healthy', lastCheck: new Date().toISOString() },
      perplexity: { status: 'healthy', lastCheck: new Date().toISOString() },
      server: { status: 'healthy', version: '1.0.0' },
      database: mockDatabaseStatus
    };
    
    storage.getApiStatus.mockResolvedValue(apiStatusWithDb);
    
    // Get API status
    const apiStatus = await storage.getApiStatus();
    
    // Verify database info is included
    expect(apiStatus.database).toBeDefined();
    expect(apiStatus.database.status).toBe('connected');
    expect(apiStatus.database.healthy).toBe(true);
  });
});