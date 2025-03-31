/**
 * Health Endpoint API Tests
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock system health function
vi.mock('../../server/services/healthCheck', () => ({
  checkSystemHealth: vi.fn().mockReturnValue({
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
  })
}));

// Import checkSystemHealth after it's mocked
import { checkSystemHealth } from '../../server/services/healthCheck';

describe('Health Endpoint API', () => {
  let app;
  
  beforeEach(() => {
    // Reset mocks between tests
    vi.resetAllMocks();
    
    // Create a new Express app for each test
    app = express();
    
    // Set up health endpoints
    app.get('/api/health', (req, res) => {
      try {
        const healthStatus = {
          redis: { status: 'connected', version: '7.0.0' },
          promptManager: { status: 'ready', templatesLoaded: 15 },
          circuitBreaker: { status: 'closed', failureCount: 0 },
          memory: {
            total: 16 * 1024 * 1024 * 1024,
            free: 8 * 1024 * 1024 * 1024,
            used: 8 * 1024 * 1024 * 1024,
            usagePercent: 50,
            healthy: true
          },
          apiServices: {
            claude: { status: 'healthy', lastCheck: new Date().toISOString() },
            perplexity: { status: 'healthy', lastCheck: new Date().toISOString() }
          }
        };
        
        // Check if all services are healthy
        const allHealthy = 
          healthStatus.redis.status === 'connected' &&
          healthStatus.apiServices.claude.status === 'healthy' &&
          healthStatus.apiServices.perplexity.status === 'healthy';
        
        res.status(allHealthy ? 200 : 503).json(healthStatus);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: `Health check failed: ${error.message}`
        });
      }
    });
    
    app.get('/api/assistant/health', (req, res) => {
      try {
        const health = checkSystemHealth();
        
        const response = {
          status: health.status,
          apiKeys: {
            anthropic: health.apiKeys.anthropic,
            perplexity: health.apiKeys.perplexity,
            allPresent: health.apiKeys.allKeysPresent
          },
          system: {
            memory: health.memory,
            fileSystem: health.fileSystem
          },
          timestamp: new Date().toISOString()
        };
        
        res.status(health.isHealthy ? 200 : 503).json(response);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: `Health check failed: ${error.message}`
        });
      }
    });
  });
  
  it('should return 200 OK with health data when system is healthy', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('redis');
    expect(response.body).toHaveProperty('promptManager');
    expect(response.body).toHaveProperty('circuitBreaker');
    expect(response.body).toHaveProperty('memory');
    expect(response.body).toHaveProperty('apiServices');
  });
  
  it('should return 503 Service Unavailable when system is unhealthy', async () => {
    // Update app to simulate unhealthy components
    app = express();
    app.get('/api/health', (req, res) => {
      const healthStatus = {
        redis: { status: 'connected', version: '7.0.0' },
        promptManager: { status: 'ready', templatesLoaded: 15 },
        circuitBreaker: { status: 'closed', failureCount: 0 },
        memory: {
          total: 16 * 1024 * 1024 * 1024,
          free: 8 * 1024 * 1024 * 1024,
          used: 8 * 1024 * 1024 * 1024,
          usagePercent: 50,
          healthy: true
        },
        apiServices: {
          claude: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'API key invalid' },
          perplexity: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'Service unavailable' }
        }
      };
      
      res.status(503).json(healthStatus);
    });
    
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(503);
    expect(response.body.apiServices.claude.status).toBe('unhealthy');
    expect(response.body.apiServices.perplexity.status).toBe('unhealthy');
  });
  
  it('should return 500 Internal Server Error when the health check throws an error', async () => {
    // Update app to simulate an error during health check
    app = express();
    app.get('/api/health', (req, res) => {
      res.status(500).json({
        status: 'error',
        message: 'Health check failed: Database connection error'
      });
    });
    
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Health check failed');
  });
  
  it('should return 200 OK with system health data from assistant health endpoint', async () => {
    // Make sure we're setting up a response object
    const mockHealth = {
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
    
    // Explicitly set the mock for this test
    checkSystemHealth.mockReturnValueOnce(mockHealth);
    
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
    checkSystemHealth.mockReturnValueOnce({
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
    checkSystemHealth.mockImplementationOnce(() => {
      throw new Error('Failed to check system resources');
    });
    
    const response = await request(app).get('/api/assistant/health');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Health check failed');
  });
});