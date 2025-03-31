/**
 * Mock Routes for Testing
 * 
 * This is a simplified version of the actual server/routes.ts file
 * that only includes the chart-related routes for testing
 */

import express, { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { claudeService } from '../../../server/services/claude.ts';

/**
 * Register chart-related routes for testing
 */
export async function registerRoutes(app: Express): Promise<void> {
  // Ensure charts directory exists
  const chartDir = path.join(process.cwd(), 'charts');
  if (!fs.existsSync(chartDir)) {
    fs.mkdirSync(chartDir, { recursive: true });
  }

  // Test Claude Visualization endpoint
  app.post('/api/test-claude-visualization', async (req: Request, res: Response) => {
    try {
      // Simple validation check
      const { data, type, title, description } = req.body;
      
      if (!data || !type) {
        return res.status(400).json({
          success: false,
          error: 'Data and type are required for visualization'
        });
      }
      
      const claudeResult = await claudeService.generateVisualization(
        data,
        type,
        title,
        description
      );
      
      return res.status(200).json({
        success: true,
        claudeResult,
        inputData: req.body
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to test Claude visualization: ${error.message}`
      });
    }
  });

  // Get list of available chart files
  app.get('/api/chart-files', (req: Request, res: Response) => {
    try {
      // Instead of filtering from readdirSync results, just provide mock data
      const files = [
        { name: 'chart1.json', url: '/api/charts/chart1' },
        { name: 'chart2.json', url: '/api/charts/chart2' }
      ];
      
      return res.status(200).json({
        success: true,
        files
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Analyze file content
  app.post('/api/analyze-file', async (req: Request, res: Response) => {
    try {
      const { content, chartType, contentType } = req.body;
      
      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Content is required'
        });
      }
      
      // Construct request for Claude
      const messages = [
        {
          role: 'system',
          content: `You are a data visualization assistant. Analyze the following data and suggest an appropriate visualization. Return ONLY valid JSON with the structure: {"plotlyConfig": {...}, "insights": [...]}. The plotlyConfig should contain data, layout, and config properties for Plotly.js.`
        },
        {
          role: 'user',
          content: `Here is some ${contentType} content. Please create a ${chartType} chart visualization for it:\n\n${content}`
        }
      ];
      
      const result = await claudeService.processConversation(messages);
      
      // Extract JSON from response
      const jsonMatch = result.response.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : '{}';
      const visualization = JSON.parse(jsonStr);
      
      return res.status(200).json({
        success: true,
        ...visualization
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to analyze file: ${error.message}`
      });
    }
  });

  // Van Westendorp visualization test
  app.get('/api/test-visualization/van-westendorp', (req: Request, res: Response) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Van Westendorp Price Sensitivity Analysis</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        </head>
        <body>
          <h1>Van Westendorp Price Sensitivity Analysis</h1>
          <div id="plot" style="width:100%;height:600px;"></div>
          <script>
            const prices = [10, 15, 20, 25, 30, 35, 40, 45, 50];
            const tooCheap = [0.8, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01];
            const cheap = [0.1, 0.3, 0.5, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05];
            const expensive = [0.05, 0.1, 0.2, 0.4, 0.6, 0.7, 0.8, 0.6, 0.4];
            const tooExpensive = [0.01, 0.05, 0.1, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9];
            
            const data = [
              {
                x: prices,
                y: tooCheap,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Too Cheap'
              },
              {
                x: prices,
                y: cheap,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Cheap'
              },
              {
                x: prices,
                y: expensive,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Expensive'
              },
              {
                x: prices,
                y: tooExpensive,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Too Expensive'
              }
            ];
            
            const layout = {
              title: 'Van Westendorp Price Sensitivity Meter',
              xaxis: {
                title: 'Price ($)'
              },
              yaxis: {
                title: 'Cumulative Percentage'
              }
            };
            
            Plotly.newPlot('plot', data, layout);
          </script>
        </body>
      </html>
    `;
    
    res.send(html);
  });

  // Conjoint analysis visualization test
  app.get('/api/test-visualization/conjoint', (req: Request, res: Response) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conjoint Analysis</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        </head>
        <body>
          <h1>Conjoint Analysis: Feature Importance</h1>
          <div id="plot" style="width:100%;height:600px;"></div>
          <script>
            const data = [
              {
                y: ['Brand', 'Price', 'Size', 'Color', 'Material'],
                x: [0.35, 0.25, 0.15, 0.1, 0.15],
                type: 'bar',
                orientation: 'h',
                marker: {
                  color: ['rgba(25, 118, 210, 0.8)', 'rgba(76, 175, 80, 0.8)', 
                          'rgba(255, 152, 0, 0.8)', 'rgba(244, 67, 54, 0.8)', 
                          'rgba(156, 39, 176, 0.8)']
                }
              }
            ];
            
            const layout = {
              title: 'Feature Importance in Consumer Decision Making',
              xaxis: {
                title: 'Relative Importance'
              }
            };
            
            Plotly.newPlot('plot', data, layout);
          </script>
        </body>
      </html>
    `;
    
    res.send(html);
  });
}