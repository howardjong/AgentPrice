/**
 * Vitest Configuration
 * 
 * This configuration is optimized for the MLRS test suite, focusing on:
 * - Handling ESM modules properly
 * - Optimizing memory usage
 * - Providing better error reporting
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Run tests sequentially to avoid port conflicts and race conditions
    sequence: {
      // For WebSocket tests especially, run one at a time
      hooks: 'list',
      setupFiles: 'list',
    },
    
    // Increase global timeout for complex tests
    testTimeout: 15000,
    
    // Use a single thread for better debugging and to avoid port conflicts
    threads: false,
    
    // Configure environment
    environment: 'node',
    
    // Setup file to run before tests
    setupFiles: [
      path.resolve(__dirname, 'tests/vitest.setup.js')
    ],
    
    // Output configuration
    reporters: [
      'default',
      'verbose',
    ],
    
    // Include specific test files
    include: [
      '**/*.vitest.js',
      '**/unit/**/*.vitest.js',
    ],
    
    // Clean environment between tests
    restoreMocks: true,
    clearMocks: true,
    
    // Only run the tests specified - avoid running all tests
    watchExclude: ['node_modules', 'dist'],
    
    // Don't reopen browser on watch mode
    open: false,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'test-backups/**',
        'tests/**',
        'coverage/**',
        'scripts/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.js',
        '**/*.vitest.js',
        '**/*.config.js',
      ],
    },
  }
});