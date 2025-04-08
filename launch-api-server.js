/**
 * API Server Launcher
 * 
 * This script launches the API server for health endpoints alongside the main application.
 * It's used to ensure the health endpoints are available for the health check tests.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the server script
const serverPath = path.join(__dirname, 'server', 'server.js');

// Launch the server on a specific port different from the main application
process.env.PORT = '5000';

console.log(`Starting API server from ${serverPath} on port ${process.env.PORT}`);

// Spawn the server process
const serverProcess = spawn('node', [serverPath], {
  detached: true,
  stdio: 'inherit'
});

// Log when the server exits
serverProcess.on('exit', (code, signal) => {
  console.log(`API server exited with code ${code} and signal ${signal}`);
});

// Let the parent process continue without waiting for this child
serverProcess.unref();

console.log('API server started in background. Main process continuing...');