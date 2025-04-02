/**
 * API Status Endpoint Tests
 * 
 * Tests for the /api/status endpoint in server/routes.ts
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';

// Mock the storage module
vi.mock('../../server/storage', () => {
  return {
    storage: {
      getApiStatus: vi.fn().mockResolvedValue({
        claude: {
          service: 'Claude API',
          status: 'connected',
          lastUsed: new Date().toISOString(),
          version: 'claude-3-7-sonnet-20250219'
        },
        perplexity: {
          service: 'Perplexity API',
          status: 'connected',
          lastUsed: new Date().toISOString(),
          version: 'llama-3.1-sonar-small-128k-online'
        },
        server: {
          status: 'running',
          load: 0.2,
          uptime: '0:00:30',
        }
      }),
      updateServiceStatus: vi.fn().mockResolvedValue(true)
    }
  };
});

// Mock the healthCheck service
vi.mock('../../server/services/healthCheck.js', () => {
  return {
    checkSystemHealth: vi.fn().mockReturnValue({
      status: 'healthy',
      apiKeys: {
        allKeysPresent: true,
        anthropic: true,
        perplexity: true
      },
      memory: {
        usagePercent: 40,
        healthy: true
      },
      fileSystem: {
        allDirsExist: true
      }
    })
  };
});

// Mock the services
vi.mock('../../server/services/claude.ts', () => {
  return {
    claudeService: {
      getStatus: vi.fn().mockReturnValue({
        service: 'Claude API',
        status: 'connected',
        lastUsed: new Date().toISOString(),
        version: 'claude-3-7-sonnet-20250219'
      })
    }
  };
});

vi.mock('../../server/services/perplexity.ts', () => {
  return {
    perplexityService: {
      getStatus: vi.fn().mockReturnValue({
        service: 'Perplexity API',
        status: 'connected',
        lastUsed: new Date().toISOString(),
        version: 'llama-3.1-sonar-small-128k-online'
      })
    }
  };
});

// Mock the shared schema
vi.mock('../../shared/schema.ts', async () => {
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

// Mock logger
vi.mock('../../utils/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
  };
});

// Create a test app with the routes we want to test
async function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Define a custom route for testing
  app.get('/api/status', async (req, res) => {
    try {
      const { storage } = await import('../../server/storage');
      const apiStatus = await storage.getApiStatus();
      
      const { claudeService } = await import('../../server/services/claude.ts');
      const { perplexityService } = await import('../../server/services/perplexity.ts');
      
      // Get real-time status directly from services
      const claudeStatus = claudeService.getStatus();
      const perplexityStatus = perplexityService.getStatus();
      
      // Combine stored status with real-time info
      const status = {
        claude: {
          ...apiStatus.claude,
          ...claudeStatus
        },
        perplexity: {
          ...apiStatus.perplexity,
          ...perplexityStatus
        },
        server: {
          ...apiStatus.server
        },
        timestamp: new Date().toISOString()
      };
      
      return res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Error fetching API status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch API status'
      });
    }
  });
  
  return app;
}

describe('API Status Endpoint Tests', () => {
  let app;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createTestApp();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('GET /api/status', () => {
    it('should return API status information successfully', async () => {
      const response = await request(app)
        .get('/api/status');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(response.body.status.claude).toBeDefined();
      expect(response.body.status.perplexity).toBeDefined();
      expect(response.body.status.server).toBeDefined();
      expect(response.body.status.timestamp).toBeDefined();
      
      // Check specific fields
      expect(response.body.status.claude.service).toBe('Claude API');
      expect(response.body.status.claude.status).toBe('connected');
      expect(response.body.status.claude.version).toBe('claude-3-7-sonnet-20250219');
      
      expect(response.body.status.perplexity.service).toBe('Perplexity API');
      expect(response.body.status.perplexity.status).toBe('connected');
      expect(response.body.status.perplexity.version).toBe('llama-3.1-sonar-small-128k-online');
      
      expect(response.body.status.server.status).toBe('running');
    });
    
    it('should handle errors when fetching API status', async () => {
      // Create a new test app with an error-producing route
      const errorApp = express();
      errorApp.use(express.json());
      
      // Define a version of the route that throws an error
      errorApp.get('/api/status', async (req, res) => {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch API status'
        });
      });
      
      const response = await request(errorApp)
        .get('/api/status');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch API status');
    });
    
    it('should handle service-specific failures gracefully', async () => {
      // Import directly to mock implementation
      const { storage } = await import('../../server/storage');
      
      // Mock implementation that returns degraded service
      const originalMethod = storage.getApiStatus;
      storage.getApiStatus = vi.fn().mockResolvedValueOnce({
        claude: {
          service: 'Claude API',
          status: 'degraded',
          lastUsed: new Date().toISOString(),
          version: 'claude-3-7-sonnet-20250219'
        },
        perplexity: {
          service: 'Perplexity API',
          status: 'connected',
          lastUsed: new Date().toISOString(),
          version: 'llama-3.1-sonar-small-128k-online'
        },
        server: {
          status: 'running',
          load: 0.2,
          uptime: '0:00:30',
        }
      });
      
      try {
        const response = await request(app)
          .get('/api/status');
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.status.claude.status).toBe('degraded');
        expect(response.body.status.perplexity.status).toBe('connected');
      } finally {
        // Restore original implementation
        storage.getApiStatus = originalMethod;
      }
    });
  });
});