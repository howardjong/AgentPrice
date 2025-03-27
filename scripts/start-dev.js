
/**
 * Start the development server
 * This is the default script for starting the development server
 */

// Import necessary modules
import { spawn } from 'child_process';
import path from 'path';

// Set default port and host for better Replit compatibility
process.env.PORT = process.env.PORT || '5000';
process.env.HOST = process.env.HOST || '0.0.0.0';

// Start the server with tsx (TypeScript execution)
const server = spawn('tsx', ['server/index.ts'], {
  stdio: 'inherit',
  env: process.env
});

console.log(`Server starting on ${process.env.HOST}:${process.env.PORT}`);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.kill('SIGINT');
  process.exit(0);
});
