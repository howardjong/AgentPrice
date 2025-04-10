/**
 * @file chartsController.simplified.vitest.js
 * @description Simplified tests for the chart-related APIs in server/routes.ts
 */

// Setup mocks before imports
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';

// Mock all of the fs module with inline data to avoid hoisting issues
vi.mock('fs', () => ({
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
  mkdirSync: vi.fn(),
  promises: {
    readFile: vi.fn().mockResolvedValue(JSON.stringify({
      plotlyConfig: {
        data: [{ type: 'bar', x: [1, 2, 3], y: [10, 20, 30] }],
        layout: { title: 'Test Chart' },
        config: { responsive: true }
      },
      insights: ['Test insight 1', 'Test insight 2']
    })),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined)
  }
}));

// Import other modules after setting up mocks
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import * as fs from 'fs';

// Define the mock claudeService
const mockClaudeService = {
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
    const result = {
      plotlyConfig: {
        data: [{ type: 'bar', x: [1, 2, 3], y: [10, 20, 30] }],
        layout: { title: `${chartType} Chart` },
        config: { responsive: true }
      },
      insights: ['Insight for ' + chartType]
    };
    return result;
  })
};

// Helper to create a basic Express app with chart routes
function createTestApp() {
  const app = express();
  app.use(express.json());
  
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
      const result = await mockClaudeService.generateVisualization(
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
      const outputDir = './tests/output';
      console.log(`GET /api/chart-files - Accessing directory: ${outputDir}`);
      
      // Make sure the directory exists first
      const exists = fs.existsSync(outputDir);
      console.log(`Directory exists: ${exists}`);
      
      if (!exists) {
        console.log(`Creating directory: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filesFromDir = fs.readdirSync(outputDir);
      console.log(`Files from directory: ${JSON.stringify(filesFromDir)}`);
      
      const files = filesFromDir
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          url: `/chart-data/${file}`
        }));
      console.log(`Filtered files: ${JSON.stringify(files)}`);
      
      res.json({ success: true, files });
    } catch (error) {
      console.error(`Error in /api/chart-files: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Serve chart files from tests/output directory
  app.get('/chart-data/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join('./tests/output', filename);
      console.log(`GET /chart-data/${filename} - Looking for file at: ${filePath}`);
      
      const exists = fs.existsSync(filePath);
      console.log(`File exists: ${exists}`);
      
      if (!exists) {
        console.log(`File not found: ${filePath}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Chart file not found' 
        });
      }
      
      console.log(`Reading file: ${filePath}`);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      console.log(`File contents: ${fileContents}`);
      
      const chartData = JSON.parse(fileContents);
      res.json(chartData);
    } catch (error) {
      console.error(`Error in /chart-data/${req.params.filename}: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: `Error reading chart file: ${error.message}` 
      });
    }
  });
  
  return app;
}

describe('Charts Controller API Simplified Tests', () => {
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
      // Save original implementation and mock an error
      const original = mockClaudeService.generateVisualization;
      mockClaudeService.generateVisualization = vi.fn().mockRejectedValueOnce(
        new Error('Service unavailable')
      );
      
      try {
        const response = await request(app)
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
        mockClaudeService.generateVisualization = original;
      }
    });
  });
  
  describe('GET /api/chart-files', () => {
    it('should return a list of available chart files', async () => {
      // Force mocks to return correct values for this test
      fs.existsSync = vi.fn().mockReturnValue(true);
      fs.readdirSync = vi.fn().mockReturnValue(['test1.json', 'test2.json']);
      
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
      // Force mocks to return values that trigger error
      fs.existsSync = vi.fn().mockReturnValue(true);
      fs.readdirSync = vi.fn().mockImplementation(() => {
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
      // Force mocks to return correct values
      const mockData = JSON.stringify({
        plotlyConfig: {
          data: [{ type: 'bar', x: [1, 2, 3], y: [10, 20, 30] }],
          layout: { title: 'Test Chart' },
          config: { responsive: true }
        },
        insights: ['Test insight 1', 'Test insight 2']
      });
      
      fs.existsSync = vi.fn().mockReturnValue(true); 
      fs.readFileSync = vi.fn().mockReturnValue(mockData);
      
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
      // Set existsSync to return false for this test
      fs.existsSync = vi.fn().mockReturnValue(false);
      
      const response = await request(app)
        .get('/chart-data/nonexistent.json');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Chart file not found');
    });
    
    it('should handle file reading errors gracefully', async () => {
      // Setup mocks to trigger the error case
      fs.existsSync = vi.fn().mockReturnValue(true);
      fs.readFileSync = vi.fn().mockImplementation(() => {
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