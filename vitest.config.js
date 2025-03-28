
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.vitest.js', 'tests/**/*.test.js'],
    exclude: ['**/node_modules/**', 'dist/**'],
    testTimeout: 20000,
    hookTimeout: 10000,
    setupFiles: ['./tests/vitest.setup.js'],
    pool: 'forks', // Use fork pool for better isolation
    poolOptions: {
      forks: {
        isolate: true, // Better memory isolation
      }
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
    alias: {
      '@': resolve(__dirname, 'client/src'),
      '@shared': resolve(__dirname, 'shared'),
    }
  },
});
