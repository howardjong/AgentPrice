import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Specify the paths to test and the file to check
const testPath = 'tests/unit/services/contextManager.vitest.js';
const serviceFile = 'services/contextManager.js';

// Create a script that only checks the specific file
const testScript = `import { describe, it, expect } from 'vitest';
import { startVitest } from 'vitest/node';

const ctx = await startVitest('test', {
  include: ['${testPath}'],
  coverage: {
    enabled: true,
    include: ['${serviceFile}'],
    reporter: ['text'],
  },
});

await ctx.start();
`;

// Write temporary file
const tempFile = path.join(__dirname, 'temp-coverage-test.js');
fs.writeFileSync(tempFile, testScript);

try {
  // Run the test
  console.log(`Running coverage test for ${serviceFile}...\n`);
  execSync(`node ${tempFile}`, { stdio: 'inherit' });
} catch (error) {
  console.error('Error running coverage test:', error);
} finally {
  // Clean up
  fs.unlinkSync(tempFile);
}