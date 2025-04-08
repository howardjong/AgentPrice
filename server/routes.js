/**
 * API Routes
 * 
 * This file contains all API route definitions and handlers for the multi-AI research testing framework.
 * It centralizes route management and keeps the server.js file clean.
 */

import { createServer } from "http";
import { storage } from "./storage.js";
import { checkSystemHealth } from './services/healthCheck.js';

/**
 * Register all routes with the Express app
 * @param {Express} app - Express application instance
 * @returns {Server} HTTP server instance if socket server is created, otherwise null
 */
export async function registerRoutes(app) {
  // Status endpoint
  app.get('/api/status', async (req, res) => {
    try {
      const status = await storage.getApiStatus();
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Error fetching API status:', error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to fetch API status: ${error.message}` 
      });
    }
  });

  // Return null to let server.js create the HTTP server
  return null;
}