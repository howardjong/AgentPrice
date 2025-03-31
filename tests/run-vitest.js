/**
 * Vitest Runner Script
 * 
 * This script runs Vitest with the proper configuration
 * to handle Socket.IO based tests correctly.
 */

import { execa } from 'execa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runVitest() {
  console.log('Starting Vitest runner with optimized settings...');
  
  try {
    // Run the basic test file first to verify everything is working
    const basicTestPath = path.join(__dirname, 'unit', 'websocket', 'basic-test.vitest.js');
    console.log(`Running basic test at ${basicTestPath}`);
    
    const result = await execa('npx', [
      'vitest', 'run', basicTestPath,
      '--reporter=verbose',      // Detailed output
      '--config', path.resolve(process.cwd(), 'vitest.config.js')
    ], {
      stdio: 'inherit',       // Show output in console
      cwd: process.cwd(),     // Run from project root
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });
    
    console.log('Basic test completed with exit code:', result.exitCode);
    
    if (result.exitCode === 0) {
      console.log('Basic test passed, now running Socket.IO tests...');
      
      // Run the Socket.IO standalone test
      const socketTestPath = path.join(__dirname, 'unit', 'websocket', 'reconnection-simulator-standalone.vitest.js');
      console.log(`Running Socket.IO test at ${socketTestPath}`);
      
      await execa('npx', [
        'vitest', 'run', socketTestPath,
        '--reporter=verbose',
        '--config', path.resolve(process.cwd(), 'vitest.config.js')
      ], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });
    }
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

runVitest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});