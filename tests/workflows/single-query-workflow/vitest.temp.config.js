/**
 * Temporary Vitest Configuration for Single Query Workflow Tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Run tests sequentially to avoid port conflicts and race conditions
    sequence: {
      hooks: 'list',
      setupFiles: 'list',
    },
    
    // Increase global timeout for complex tests
    testTimeout: 15000,
    
    // Use a single thread for better debugging and to avoid port conflicts
    threads: false,
    
    // Configure environment
    environment: 'node',
    
    // Include our test files
    include: [
      '**/*.test.js',
    ],
    
    // Clean environment between tests
    restoreMocks: true,
    clearMocks: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
    },
  }
});