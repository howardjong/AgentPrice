/**
 * Vitest Configuration
 * 
 * This configuration is optimized for the MLRS test suite, focusing on:
 * - Handling ESM modules properly
 * - Optimizing memory usage
 * - Providing better error reporting
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Global setup/teardown
    setupFiles: ['./tests/vitest.setup.js'],
    
    // Environment configuration
    environment: 'node',
    
    // Timeout settings
    testTimeout: 30000, // Default timeout for each test
    hookTimeout: 10000, // Default timeout for hooks
    
    // Multithreading settings (to reduce memory pressure)
    threads: false, // Run in single thread to avoid memory issues
    
    // Output formatting
    reporters: ['default', 'html'],
    outputFile: {
      html: './reports/vitest-results.html',
    },
    
    // Test filtering
    include: ['**/*.{test,spec,vitest}.{js,mjs,cjs,ts,jsx,tsx}', '**/websocket/**/*.vitest.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.{idea,git,cache,output}/**',
      '**/jest.config.*',
      '**/jest.setup.*',
      '**/test-backups/**', // Exclude backed up Jest test files
    ],
    
    // Fail fast to prevent exhausting resources
    failFast: process.env.CI === 'true',
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './reports/coverage',
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '**/test-backups/**',
        '**/*.{test,spec,vitest}.*',
        '**/{vitest,jest}.{config,setup}.*',
      ],
    },
    
    // Snapshot settings
    resolveSnapshotPath: (testPath, ext) => {
      const snapshotDir = path.join(path.dirname(testPath), '__snapshots__');
      const testFileName = path.basename(testPath);
      const snapshotFileName = `${testFileName}${ext}`;
      return path.join(snapshotDir, snapshotFileName);
    },
    
    // Handle ESM modules properly
    deps: {
      interopDefault: true, // Support both ESM and CommonJS modules
    },
    
    // Memory management
    pool: 'forks', // Use process forking for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Run tests in a single forked process
      },
    },
    
    // File watching options (for dev mode)
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/reports/**',
      '**/coverage/**',
      '**/test-backups/**',
    ],
  },
});