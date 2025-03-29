/**
 * @file chartsController.vitest.js
 * @description Tests for the chart-related APIs in server/routes.ts
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Create mocks for services
vi.mock('../../../services/claudeService.js', () => {
  return {
    default: {
      generateVisualization: vi.fn().mockImplementation(async (data, type, title, description) => {
        return {
          plotlyConfig: {
            data: [
              {
                x: [1, 2, 3, 4], 
                y: [10, 20, 40, 30], 
                type: 'scatter', 
                name: 'Sample Data'
              }
            ],
            layout: {
              title: title || 'Test Visualization',
              xaxis: { title: 'X Axis' },
              yaxis: { title: 'Y Axis' }
            },
            config: { responsive: true }
          },
          insights: [
            'The data shows an upward trend',
            'There is a peak at point 3',
            'The average value is 25'
          ],
          chartType: type
        };
      }),
      generateChartData: vi.fn().mockImplementation(async (content, chartType) => {
        const mockChartData = {
          van_westendorp: {
            plotlyConfig: {
              data: [
                {
                  x: [10, 20, 30, 40, 50],
                  y: [0.1, 0.3, 0.6, 0.8, 0.9],
                  type: 'scatter',
                  name: 'Too Cheap'
                },
                {
                  x: [10, 20, 30, 40, 50],
                  y: [0.9, 0.7, 0.4, 0.2, 0.1],
                  type: 'scatter',
                  name: 'Too Expensive'
                }
              ],
              layout: {
                title: 'Van Westendorp Price Sensitivity Analysis',
                xaxis: { title: 'Price ($)' },
                yaxis: { title: 'Cumulative Percentage' }
              },
              config: { responsive: true }
            },
            insights: [
              'The optimal price point is around $30',
              'Price sensitivity is highest between $25-$35',
              'The acceptable price range is $20-$40'
            ]
          },
          conjoint: {
            plotlyConfig: {
              data: [
                {
                  x: ['Feature A', 'Feature B', 'Feature C', 'Feature D'],
                  y: [0.4, 0.3, 0.2, 0.1],
                  type: 'bar',
                  name: 'Feature Importance'
                }
              ],
              layout: {
                title: 'Conjoint Analysis - Feature Importance',
                xaxis: { title: 'Features' },
                yaxis: { title: 'Importance Score' }
              },
              config: { responsive: true }
            },
            insights: [
              'Feature A has the highest importance at 40%',
              'Features A and B combined account for 70% of buying decisions',
              'Feature D has minimal impact on purchasing decisions'
            ]
          }
        };
        
        return mockChartData[chartType] || {
          plotlyConfig: {
            data: [{ type: 'bar', x: [1, 2, 3], y: [10, 20, 30] }],
            layout: { title: `Generic ${chartType} Chart` },
            config: { responsive: true }
          },
          insights: ['Generic insight for ' + chartType]
        };
      })
    }
  };
});

// Mock fs module
vi.mock('fs', () => {
  return {
    default: {
      ...vi.importActual('fs'),
      existsSync: vi.fn().mockReturnValue(true),
      readdirSync: vi.fn().mockReturnValue(['test1.json', 'test2.json']),
      readFileSync: vi.fn().mockReturnValue(JSON.stringify({
        plotlyConfig: {
          data: [{ type: 'bar', x: [1, 2, 3], y: [10, 20, 30] }],
          layout: { title: 'Test Chart' },
          config: { responsive: true }
        },
        insights: ['Test insight 1', 'Test insight 2']
      })),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn()
    }
  };
});

// Helper to create a basic Express app with chart routes
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock Claude service import
  const claudeService = vi.importActual('../../../services/claudeService.js').default;
  
  // Setup chart-related routes (simulating what's in server/routes.ts)
  app.post('/api/test-claude-visualization', async (req, res) => {
    try {
      const { data, type, title, description } = req.body;
      
      if (!data || !type) {
        return res.status(400).json({ 
          success: false, 
          error: 'Data and type are required' 
        });
      }
      
      // Send the data to Claude for visualization generation
      const result = await claudeService.generateVisualization(
        data,
        type,
        title || 'Test Visualization',
        description || 'Generated from test data'
      );
      
      // Return both Claude's results and the input data for comparison
      res.json({
        success: true,
        claudeResult: result,
        inputData: {
          data,
          type,
          title,
          description
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: `Failed to test Claude visualization: ${error.message}`
      });
    }
  });
  
  // API to list available chart files
  app.get('/api/chart-files', (req, res) => {
    try {
      const outputDir = '/tests/output';
      const files = fs.readdirSync(outputDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          url: `/chart-data/${file}`
        }));
      res.json({ success: true, files });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Serve chart files from tests/output directory
  app.get('/chart-data/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join('/tests/output', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          success: false, 
          error: 'Chart file not found' 
        });
      }
      
      const chartData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json(chartData);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: `Error reading chart file: ${error.message}` 
      });
    }
  });
  
  return app;
}

describe('Charts Controller API Tests', () => {
  let app;
  
  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('POST /api/test-claude-visualization', () => {
    it('should generate visualization data successfully', async () => {
      const testData = {
        data: [
          ['Product', 'Price', 'Sales'],
          ['Product A', 100, 200],
          ['Product B', 150, 150],
          ['Product C', 200, 100]
        ],
        type: 'bar',
        title: 'Product Sales Analysis',
        description: 'Analysis of sales vs. price for different products'
      };
      
      const response = await request(app)
        .post('/api/test-claude-visualization')
        .send(testData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.claudeResult).toBeDefined();
      expect(response.body.claudeResult.plotlyConfig).toBeDefined();
      expect(response.body.claudeResult.plotlyConfig.data).toBeDefined();
      expect(response.body.claudeResult.insights).toBeDefined();
      expect(response.body.inputData).toEqual(testData);
    });
    
    it('should return 400 for missing data or type', async () => {
      const response = await request(app)
        .post('/api/test-claude-visualization')
        .send({
          title: 'Test Chart',
          description: 'This is missing required fields'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Data and type are required');
    });
    
    it('should handle service errors gracefully', async () => {
      const { default: claudeService } = await import('../../../services/claudeService.js');
      claudeService.generateVisualization.mockRejectedValueOnce(new Error('Service unavailable'));
      
      const response = await request(app)
        .post('/api/test-claude-visualization')
        .send({
          data: [['A', 1], ['B', 2]],
          type: 'pie'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to test Claude visualization');
    });
  });
  
  describe('GET /api/chart-files', () => {
    it('should return a list of available chart files', async () => {
      const response = await request(app)
        .get('/api/chart-files');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.files).toBeInstanceOf(Array);
      expect(response.body.files).toHaveLength(2);
      expect(response.body.files[0]).toHaveProperty('name');
      expect(response.body.files[0]).toHaveProperty('url');
      expect(response.body.files[0].url).toContain('/chart-data/');
    });
    
    it('should handle filesystem errors gracefully', async () => {
      const { default: fs } = await import('fs');
      fs.readdirSync.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });
      
      const response = await request(app)
        .get('/api/chart-files');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Permission denied');
    });
  });
  
  describe('GET /chart-data/:filename', () => {
    it('should return chart data for a valid file', async () => {
      const response = await request(app)
        .get('/chart-data/test1.json');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('plotlyConfig');
      expect(response.body).toHaveProperty('insights');
      expect(response.body.plotlyConfig).toHaveProperty('data');
      expect(response.body.plotlyConfig).toHaveProperty('layout');
      expect(response.body.plotlyConfig).toHaveProperty('config');
    });
    
    it('should return 404 for non-existent chart file', async () => {
      const { default: fs } = await import('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const response = await request(app)
        .get('/chart-data/nonexistent.json');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Chart file not found');
    });
    
    it('should handle file reading errors gracefully', async () => {
      const { default: fs } = await import('fs');
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('File corrupted');
      });
      
      const response = await request(app)
        .get('/chart-data/corrupted.json');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Error reading chart file');
    });
  });
});