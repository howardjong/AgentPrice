/**
 * Health Endpoint API Tests
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';
import { storage } from '../../server/storage';
import { checkSystemHealth } from '../../server/services/healthCheck';

// Mock the shared schema
vi.mock('../../shared/schema.ts', async () => {
  // Mock module exports
  return {
    users: {},
    insertUserSchema: {},
    conversations: {},
    insertConversationSchema: {},
    messages: {},
    insertMessageSchema: {},
    researchJobs: {},
    insertResearchJobSchema: {},
    researchReports: {},
    insertResearchReportSchema: {},
    chatMessageSchema: {
      parse: vi.fn().mockImplementation(data => data),
      safeParse: vi.fn().mockImplementation(data => ({ success: true, data }))
    },
    visualizeSchema: {
      parse: vi.fn().mockImplementation(data => data),
      safeParse: vi.fn().mockImplementation(data => ({ success: true, data }))
    },
    deepResearchSchema: {
      parse: vi.fn().mockImplementation(data => data),
      safeParse: vi.fn().mockImplementation(data => ({ success: true, data }))
    }
  };
});

// Mock the dependencies
vi.mock('../../server/storage', () => ({
  storage: {
    getApiStatus: vi.fn(),
    updateServiceStatus: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../../server/services/healthCheck', () => ({
  checkSystemHealth: vi.fn()
}));

vi.mock('../../server/services/claude.js', () => ({
  claudeService: {
    getStatus: vi.fn().mockReturnValue({
      service: 'Claude API',
      status: 'connected',
      lastUsed: new Date().toISOString(),
      error: null
    })
  }
}));

vi.mock('../../server/services/perplexity.js', () => ({
  perplexityService: {
    getStatus: vi.fn().mockReturnValue({
      service: 'Perplexity API',
      status: 'connected',
      lastUsed: new Date().toISOString(),
      error: null
    })
  }
}));

vi.mock('../../utils/componentLoader.js', () => ({
  default: {
    load: vi.fn().mockImplementation((moduleName) => {
      if (moduleName === 'jobManager') {
        return { default: {} };
      }
      if (moduleName === 'researchService') {
        return { default: {} };
      }
      return {};
    })
  }
}));

// These WebSocket mocks are needed for routes.ts to register properly
vi.mock('socket.io', () => ({
  Server: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn()
  }))
}));

vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    clients: new Set()
  }))
}));

describe('Health Endpoint API', () => {
  let app;
  let server;
  
  beforeEach(async () => {
    // Create a fresh Express app for each test
    app = express();
    
    // Mock the storage getApiStatus response
    storage.getApiStatus.mockResolvedValue({
      claude: { status: 'healthy', lastCheck: new Date().toISOString() },
      perplexity: { status: 'healthy', lastCheck: new Date().toISOString() },
      server: { status: 'healthy', version: '1.0.0' }
    });
    
    // Mock the checkSystemHealth response
    checkSystemHealth.mockReturnValue({
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
    });
    
    // Register routes
    server = await registerRoutes(app);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    
    // Clean up any listeners on the HTTP server to avoid memory leaks
    if (server && server.close) {
      server.close();
    }
  });
  
  it('should return 200 OK with health data when system is healthy', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('redis');
    expect(response.body).toHaveProperty('promptManager');
    expect(response.body).toHaveProperty('circuitBreaker');
    expect(response.body).toHaveProperty('memory');
    expect(response.body).toHaveProperty('apiServices');
    
    // Verify storage.getApiStatus was called
    expect(storage.getApiStatus).toHaveBeenCalledTimes(1);
  });
  
  it('should return 503 Service Unavailable when system is unhealthy', async () => {
    // Set up mocks to simulate unhealthy components
    storage.getApiStatus.mockResolvedValue({
      claude: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'API key invalid' },
      perplexity: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'Service unavailable' },
      server: { status: 'healthy', version: '1.0.0' }
    });
    
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(503);
    expect(response.body.apiServices.claude.status).toBe('unhealthy');
    expect(response.body.apiServices.perplexity.status).toBe('unhealthy');
  });
  
  it('should return 500 Internal Server Error when the health check throws an error', async () => {
    // Mock storage.getApiStatus to throw an error
    storage.getApiStatus.mockImplementation(() => {
      throw new Error('Database connection error');
    });
    
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Health check failed');
  });
  
  it('should return 200 OK with system health data from assistant health endpoint', async () => {
    const response = await request(app).get('/api/assistant/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('apiKeys');
    expect(response.body).toHaveProperty('system');
    expect(response.body).toHaveProperty('timestamp');
    
    // Verify checkSystemHealth was called
    expect(checkSystemHealth).toHaveBeenCalledTimes(1);
  });
  
  it('should return 503 Service Unavailable when assistant health is degraded', async () => {
    // Mock checkSystemHealth to return a degraded status
    checkSystemHealth.mockReturnValue({
      status: 'unhealthy',
      apiKeys: {
        anthropic: false,
        perplexity: false,
        allKeysPresent: false
      },
      fileSystem: {
        uploadsDir: true,
        promptsDir: true,
        testsOutputDir: false,
        contentUploadsDir: false,
        allDirsExist: false
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024,
        free: 0.5 * 1024 * 1024 * 1024,
        used: 15.5 * 1024 * 1024 * 1024,
        usagePercent: 96.875,
        healthy: false
      },
      isHealthy: false
    });
    
    const response = await request(app).get('/api/assistant/health');
    
    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'unhealthy');
    expect(response.body.apiKeys.allPresent).toBe(false);
    expect(response.body.system.memory.healthy).toBe(false);
  });
  
  it('should return 500 Internal Server Error when assistant health check throws an error', async () => {
    // Mock checkSystemHealth to throw an error
    checkSystemHealth.mockImplementation(() => {
      throw new Error('Failed to check system resources');
    });
    
    const response = await request(app).get('/api/assistant/health');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Health check failed');
  });
});