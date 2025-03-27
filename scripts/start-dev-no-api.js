
/**
 * Start the development server with API calls disabled
 * This script sets the environment variables to disable API calls
 * and then starts the development server
 */

// Set environment variables to disable API calls
process.env.DISABLE_LLM_API_CALLS = 'true';
process.env.INIT_MOCK_DATA = 'false';
process.env.USE_MOCK_LLM = 'true';

// Import the dev script to start the server
import('./start-dev.js');
