
// Script to start the development server without making API calls to LLMs

// Use environment variables to disable API calls
process.env.DISABLE_LLM_API_CALLS = 'true';
process.env.INIT_MOCK_DATA = 'false';
process.env.USE_MOCK_LLM = 'true';

// Load env configuration before importing other modules
require('../config/env.js');

// Import and run the start command
const { spawn } = require('child_process');
const path = require('path');

console.log('🚫 Starting server with LLM API calls disabled');
console.log('ℹ️ This is for development/testing UI without making external API calls');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DISABLE_LLM_API_CALLS: 'true',
    INIT_MOCK_DATA: 'false',
    USE_MOCK_LLM: 'true'
  }
});

child.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
});
