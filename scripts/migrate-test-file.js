#!/usr/bin/env node

/**
 * Utility script to help migrate Jest test files to Vitest
 * 
 * This script takes a Jest test file and creates a Vitest version with the necessary changes
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

async function migrateTestFile(jestFilePath, dryRun = false) {
  try {
    // Resolve path
    const fullJestPath = path.resolve(ROOT_DIR, jestFilePath);
    
    // Ensure the file exists
    try {
      await fs.access(fullJestPath);
    } catch (err) {
      console.error(`Error: File ${fullJestPath} does not exist`);
      return false;
    }
    
    // Read file content
    const content = await fs.readFile(fullJestPath, 'utf8');
    
    // Create Vitest file path
    const vitestPath = fullJestPath.replace(/\.test\.js$/, '.vitest.js');
    
    // Skip if Vitest file already exists
    try {
      await fs.access(vitestPath);
      console.log(`Vitest file ${vitestPath} already exists, skipping`);
      return false;
    } catch (err) {
      // File doesn't exist, continue
    }
    
    // Implement migrations
    let vitestContent = content;
    
    // 1. Replace Jest imports with Vitest imports
    vitestContent = vitestContent.replace(
      /^(const|import) \{([^}]*)\} from ['"]jest['"];?$/m,
      'import {$2} from "vitest";'
    );
    
    // 2. Handle manual imports
    if (!vitestContent.includes('import {') && !vitestContent.includes('from "vitest"')) {
      vitestContent = 'import { describe, beforeAll, afterAll, it, expect, vi, beforeEach, afterEach } from "vitest";\n' + vitestContent;
    }
    
    // 3. Replace jest functions with vi equivalents
    vitestContent = vitestContent
      .replace(/jest\.fn\(\)/g, 'vi.fn()')
      .replace(/jest\.mock\(/g, 'vi.mock(')
      .replace(/jest\.spyOn\(/g, 'vi.spyOn(')
      .replace(/jest\.useFakeTimers\(\)/g, 'vi.useFakeTimers()')
      .replace(/jest\.useRealTimers\(\)/g, 'vi.useRealTimers()')
      .replace(/jest\.resetAllMocks\(\)/g, 'vi.resetAllMocks()')
      .replace(/jest\.clearAllMocks\(\)/g, 'vi.clearAllMocks()')
      .replace(/jest\.restoreAllMocks\(\)/g, 'vi.restoreAllMocks()')
      .replace(/jest\.resetModules\(\)/g, 'vi.resetModules()')
      .replace(/jest\.advanceTimersByTime\(/g, 'vi.advanceTimersByTime(')
      .replace(/jest\.runAllTimers\(\)/g, 'vi.runAllTimers()')
      .replace(/\.mockImplementation\(/g, '.mockImplementation(')
      .replace(/\.mockReturnValue\(/g, '.mockReturnValue(')
      .replace(/\.mockResolvedValue\(/g, '.mockResolvedValue(')
      .replace(/\.mockRejectedValue\(/g, '.mockRejectedValue(');
    
    // 4. Replace require statements with imports for ES modules
    const requireStatements = vitestContent.match(/const\s+(\w+)\s+=\s+require\(['"]([^'"]+)['"]\)(\.(\w+))?;/g);
    
    if (requireStatements) {
      for (const statement of requireStatements) {
        const match = statement.match(/const\s+(\w+)\s+=\s+require\(['"]([^'"]+)['"]\)(\.(\w+))?;/);
        if (match) {
          const [fullMatch, varName, modulePath, , namedExport] = match;
          
          if (namedExport) {
            // Handle case with named export like: const { something } = require('module')
            const importStatement = `import { ${namedExport} } from "${modulePath}";`;
            vitestContent = vitestContent.replace(fullMatch, importStatement);
          } else {
            // Handle default import
            const importStatement = `import ${varName} from "${modulePath}";`;
            vitestContent = vitestContent.replace(fullMatch, importStatement);
          }
        }
      }
    }
    
    // 5. Add dynamic imports for modules that cause teardown issues
    // This is a common issue when migrating to Vitest
    if (vitestContent.includes('beforeAll') && !vitestContent.includes('import(')) {
      const potentialServices = [
        'jobManager', 'contextManager', 'redisClient', 
        'circuitBreaker', 'apiClient', 'logger'
      ];
      
      for (const service of potentialServices) {
        if (vitestContent.includes(service) && !vitestContent.includes(`import ${service}`)) {
          // Add placeholder for dynamic import
          vitestContent = vitestContent.replace(
            /beforeAll\([^{]*{/,
            `beforeAll(async () => {
  // Dynamically import ${service} to prevent teardown issues
  ${service} = (await import('../../services/${service}.js')).default;
`
          );
        }
      }
    }
    
    // 6. Add module setup/teardown helpers using test-helpers.js
    if (!vitestContent.includes('test-helpers') && vitestContent.includes('mock')) {
      vitestContent = 'import { resetAllMocks, traceTest } from "../utils/test-helpers.js";\n' + vitestContent;
      
      // Add afterEach cleanup if not present
      if (!vitestContent.includes('afterEach')) {
        vitestContent = vitestContent.replace(
          /describe\([^{]*{/,
          `describe($1 {
  // Clean up after each test
  afterEach(() => {
    resetAllMocks();
  });
`
        );
      }
    }
    
    // 7. Fix path resolution for tests that use __dirname
    vitestContent = vitestContent.replace(
      /__dirname/g,
      'path.dirname(fileURLToPath(import.meta.url))'
    );
    
    // If this is a dry run, just print the changes
    if (dryRun) {
      console.log('Original content:');
      console.log('-'.repeat(50));
      console.log(content);
      console.log('\nConverted content:');
      console.log('-'.repeat(50));
      console.log(vitestContent);
    } else {
      // Write the new file
      await fs.writeFile(vitestPath, vitestContent, 'utf8');
      console.log(`Migrated ${jestFilePath} to ${vitestPath}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error migrating test file: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// If this script is run directly
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node migrate-test-file.js <path-to-jest-file> [--dry-run]');
    process.exit(1);
  }
  
  const dryRun = args.includes('--dry-run');
  const filePath = args[0];
  
  const success = await migrateTestFile(filePath, dryRun);
  process.exit(success ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { migrateTestFile };