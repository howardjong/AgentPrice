/**
 * Debug file for chart controller tests
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import * as fs from 'fs';

// Setup express app
const app = express();
app.use(express.json());

// Setup spies for fs methods
const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
  console.log(`Checking if exists: ${path}`);
  if (path.includes('test1.json') || path.includes('test2.json') || 
      path.includes('output')) {
    console.log(`Mock returning true for path: ${path}`);
    return true;
  }
  console.log(`Mock returning false for path: ${path}`);
  return false;
});

const readdirSyncSpy = vi.spyOn(fs, 'readdirSync').mockImplementation((dir) => {
  console.log(`Reading directory: ${dir}`);
  if (dir.includes('output')) {
    console.log(`Mock returning test files for directory: ${dir}`);
    const files = ['test1.json', 'test2.json'];
    console.log(`Files found: ${JSON.stringify(files)}`);
    return files;
  }
  console.log(`Mock returning empty array for directory: ${dir}`);
  return [];
});

const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((path, options) => {
  console.log(`Reading file: ${path}`);
  if (path.includes('test1.json') || path.includes('test2.json')) {
    console.log(`Mock returning data for file: ${path}`);
    const mockData = JSON.stringify({
      plotlyConfig: {
        data: [{ type: 'bar', x: [1, 2, 3], y: [10, 20, 30] }],
        layout: { title: 'Test Chart' },
        config: { responsive: true }
      },
      insights: ['Test insight 1', 'Test insight 2']
    });
    return mockData;
  }
  console.log(`Mock throwing error for file: ${path}`);
  throw new Error('File not found');
});

// Add simple chart API routes
app.get('/api/chart-files', (req, res) => {
  try {
    console.log("GET /api/chart-files");
    const outputDir = './tests/output';
    console.log("Reading directory:", outputDir);
    
    // Check if directory exists
    if (!fs.existsSync(outputDir)) {
      console.log("Directory does not exist:", outputDir);
      return res.status(404).json({ 
        success: false, 
        error: 'Output directory not found' 
      });
    }
    
    // Read directory contents
    const allFiles = fs.readdirSync(outputDir);
    console.log("All files in directory:", allFiles);
    
    // Filter for .json files and create response objects
    const files = allFiles
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        url: `/chart-data/${file}`
      }));
    console.log("Filtered files:", files);
    
    res.json({ success: true, files });
  } catch (error) {
    console.error("Error listing chart files:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/chart-data/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    console.log(`GET /chart-data/${filename}`);
    
    const filePath = path.join('./tests/output', filename);
    console.log("Looking for file at:", filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log("File not found:", filePath);
      return res.status(404).json({ 
        success: false, 
        error: 'Chart file not found' 
      });
    }
    
    // Read and parse file
    console.log("Reading and parsing file...");
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const chartData = JSON.parse(fileContent);
    console.log("Successfully parsed file data");
    
    res.json(chartData);
  } catch (error) {
    console.error("Error reading chart file:", error.message);
    res.status(500).json({ 
      success: false, 
      error: `Error reading chart file: ${error.message}` 
    });
  }
});

// Debug test route
app.get('/test-fs-mock', (req, res) => {
  const testPath = './tests/output/test1.json';
  const exists = fs.existsSync(testPath);
  let content = null;
  let error = null;
  
  try {
    if (exists) {
      content = fs.readFileSync(testPath, 'utf8');
    }
  } catch (err) {
    error = err.message;
  }
  
  res.json({
    path: testPath,
    exists,
    content,
    error
  });
});

// Run simple test
it('should test the fs mock functions directly', () => {
  const testPath = './tests/output/test1.json';
  
  // Test existsSync
  const exists = fs.existsSync(testPath);
  expect(exists).toBe(true);
  
  // Test readdirSync
  const files = fs.readdirSync('./tests/output');
  expect(files).toHaveLength(2);
  expect(files).toContain('test1.json');
  
  // Test readFileSync
  const content = fs.readFileSync(testPath, 'utf8');
  const data = JSON.parse(content);
  expect(data).toHaveProperty('plotlyConfig');
  expect(data).toHaveProperty('insights');
});

// Test the API routes
describe('Chart API Debug Tests', () => {
  it('should return a list of available chart files', async () => {
    console.log("\n--- Testing /api/chart-files ---");
    const response = await request(app).get('/api/chart-files');
    console.log("Response status:", response.status);
    console.log("Response body:", response.body);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.files).toBeInstanceOf(Array);
    expect(response.body.files).toHaveLength(2);
  });
  
  it('should return chart data for a valid file', async () => {
    console.log("\n--- Testing /chart-data/test1.json ---");
    const response = await request(app).get('/chart-data/test1.json');
    console.log("Response status:", response.status);
    console.log("Response body:", response.body);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('plotlyConfig');
    expect(response.body).toHaveProperty('insights');
  });
});

// Restore original functions after tests
afterEach(() => {
  existsSyncSpy.mockRestore();
  readdirSyncSpy.mockRestore();
  readFileSyncSpy.mockRestore();
});