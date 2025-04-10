/**
 * @file chartsController.vitest.js
 * @description Tests for the chart-related APIs in server/routes.ts
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import express from 'express';
import request from 'supertest';
import path from 'path';
import * as fs from 'fs';

// Create mocks for services
vi.mock('../../../services/claudeService.js', () => {
  console.log("Setting up claudeService mock");
  return {
    default: {
      generateVisualization: vi.fn().mockImplementation(async (data, type, title, description) => {
        console.log("Mock generateVisualization called with", { type, title });
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
        console.log("Mock generateChartData called with", { chartType });
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

// This needs to be defined before the vi.mock call
const mockChartData = JSON.stringify({
  plotlyConfig: {
    data: [{ type: 'bar', x: [1, 2, 3], y: [10, 20, 30] }],
    layout: { title: 'Test Chart' },
    config: { responsive: true }
  },
  insights: ['Test insight 1', 'Test insight 2']
});

// Mock fs module before any imports get processed
vi.mock('fs', () => {
  console.log("Setting up permanent fs mock");
  return {
    existsSync: vi.fn().mockImplementation((path) => {
      console.log(`Checking if exists: ${path}`);
      return path.includes('test1.json') || path.includes('test2.json') || path.includes('output');
    }),
    readdirSync: vi.fn().mockImplementation((dir) => {
      console.log(`Reading directory: ${dir}`);
      return ['test1.json', 'test2.json'];
    }),
    readFileSync: vi.fn().mockImplementation((path, options) => {
      console.log(`Reading file: ${path}`);
      return mockChartData;
    }),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
      readFile: vi.fn().mockResolvedValue(mockChartData),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined)
    }
  };
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to create a basic Express app with chart routes
// Define a global mock claudeService that can be accessed by tests
const mockClaudeService = {
  generateVisualization: vi.fn().mockImplementation(async (data, type, title, description) => {
    console.log("Mock generateVisualization called with", { type, title });
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
    console.log("Mock generateChartData called with", { chartType });
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
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Use the global mockClaudeService
  const claudeService = mockClaudeService;
  
  console.log("Setting up test app with mocked claudeService:", claudeService);
  
  // Setup chart-related routes (simulating what's in server/routes.ts)
  app.post('/api/test-claude-visualization', async (req, res) => {
    try {
      console.log("POST /api/test-claude-visualization - Request body:", req.body);
      const { data, type, title, description } = req.body;
      
      if (!data || !type) {
        console.error("Missing required fields: data or type");
        return res.status(400).json({ 
          success: false, 
          error: 'Data and type are required' 
        });
      }
      
      // Send the data to Claude for visualization generation
      console.log("Calling claudeService.generateVisualization with", { type, title });
      const result = await claudeService.generateVisualization(
        data,
        type,
        title || 'Test Visualization',
        description || 'Generated from test data'
      );
      console.log("Claude visualization result:", result);
      
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
      console.error("Error generating visualization:", error.message);
      res.status(500).json({ 
        success: false, 
        error: `Failed to test Claude visualization: ${error.message}`
      });
    }
  });
  
  // API to list available chart files
  app.get('/api/chart-files', (req, res) => {
    try {
      console.log("GET /api/chart-files");
      const outputDir = './tests/output'; // Corrected path to be relative and not absolute
      console.log("Reading directory:", outputDir);
      
      // Make sure the directory exists first
      if (!fs.existsSync(outputDir)) {
        console.log("Creating directory:", outputDir);
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const files = fs.readdirSync(outputDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          url: `/chart-data/${file}`
        }));
      console.log("Found files:", files);
      
      res.json({ success: true, files });
    } catch (error) {
      console.error("Error listing chart files:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Serve chart files from tests/output directory
  app.get('/chart-data/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      console.log(`GET /chart-data/${filename}`);
      
      const filePath = path.join('./tests/output', filename); // Corrected path to be relative
      console.log("Looking for file at:", filePath);
      
      if (!fs.existsSync(filePath)) {
        console.log("File not found:", filePath);
        return res.status(404).json({ 
          success: false, 
          error: 'Chart file not found' 
        });
      }
      
      console.log("Reading and parsing file...");
      const chartData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json(chartData);
    } catch (error) {
      console.error("Error reading chart file:", error.message);
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
      // Create a fresh instance with new mocks to avoid interference
      const localApp = createTestApp();
      
      // Get the service instance from the test app and modify its behavior
      const routeHandler = localApp._router.stack.find(layer => 
        layer.route && layer.route.path === '/api/test-claude-visualization');
      const routeHandlers = routeHandler.route.stack;
      const requestHandler = routeHandlers[0].handle;
      
      // Instead of using eval, just directly use our mock claudeService
      // that's already been injected
      const localService = mockClaudeService;
      
      // Save original implementation (already mocked)
      const originalGenerateVisualization = localService.generateVisualization;
      
      try {
        // Replace with mock implementation that throws an error
        localService.generateVisualization = vi.fn().mockRejectedValueOnce(new Error('Service unavailable'));
        
        const response = await request(localApp)
          .post('/api/test-claude-visualization')
          .send({
            data: [['A', 1], ['B', 2]],
            type: 'pie'
          });
        
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Failed to test Claude visualization');
      } finally {
        // Restore original implementation
        localService.generateVisualization = originalGenerateVisualization;
      }
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
      // Create a fresh instance with new mocks to avoid interference
      const localApp = createTestApp();
      
      // Find the route handler
      const routeHandler = localApp._router.stack.find(layer => 
        layer.route && layer.route.path === '/api/chart-files');
      const routeHandlers = routeHandler.route.stack;
      const requestHandler = routeHandlers[0].handle;
      
      // Test the handler with a mocked fs module
      const originalReaddir = fs.readdirSync;
      try {
        // Override readdir to throw an error
        fs.readdirSync = vi.fn().mockImplementationOnce(() => {
          throw new Error('Permission denied');
        });
        
        const response = await request(localApp)
          .get('/api/chart-files');
        
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Permission denied');
      } finally {
        // Restore original implementation
        fs.readdirSync = originalReaddir;
      }
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
      // Create a fresh instance with new mocks to avoid interference
      const localApp = createTestApp();
      
      // Save original implementation
      const originalExistsSync = fs.existsSync;
      
      try {
        // Override with mock implementation
        fs.existsSync = vi.fn().mockReturnValueOnce(false);
        
        const response = await request(localApp)
          .get('/chart-data/nonexistent.json');
        
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Chart file not found');
      } finally {
        // Restore original implementation
        fs.existsSync = originalExistsSync;
      }
    });
    
    it('should handle file reading errors gracefully', async () => {
      // Create a fresh instance with new mocks to avoid interference
      const localApp = createTestApp();
      
      // Save original implementation
      const originalReadFileSync = fs.readFileSync;
      
      try {
        // Override with mock implementation that throws an error
        fs.readFileSync = vi.fn().mockImplementationOnce(() => {
          throw new Error('File corrupted');
        });
        
        // Ensure existsSync returns true so we reach the readFileSync call
        const originalExistsSync = fs.existsSync;
        fs.existsSync = vi.fn().mockReturnValueOnce(true);
        
        const response = await request(localApp)
          .get('/chart-data/corrupted.json');
        
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Error reading chart file');
        
        // Restore existsSync
        fs.existsSync = originalExistsSync;
      } finally {
        // Restore original implementation
        fs.readFileSync = originalReadFileSync;
      }
    });
  });
});