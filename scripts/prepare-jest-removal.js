#!/usr/bin/env node

/**
 * Jest Unit Test Removal Preparation Script
 * 
 * This script helps prepare for the safe removal of Jest unit test files by:
 * 1. Identifying all Jest unit test files
 * 2. Verifying each has a Vitest counterpart
 * 3. Validating that Vitest tests pass
 * 4. Generating a report for safe removal
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import minimist from 'minimist';

// Argument parsing
const args = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'verbose', 'help'],
  alias: {
    d: 'dry-run',
    v: 'verbose',
    h: 'help'
  }
});

// Help message
if (args.help) {
  console.log(`
Jest Unit Test Removal Preparation Tool

This script helps prepare for safely removing Jest unit test files after migration to Vitest.

Options:
  --dry-run, -d    Simulate the removal process without actually deleting files
  --verbose, -v    Show detailed information during execution
  --help, -h       Show this help message

Example:
  node scripts/prepare-jest-removal.js --dry-run
  `);
  process.exit(0);
}

// Configuration
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const UNIT_TESTS_DIR = path.join(ROOT_DIR, 'tests', 'unit');
const BACKUP_DIR = path.join(ROOT_DIR, 'test-backups', 'unit');
const isDryRun = args['dry-run'];
const isVerbose = args.verbose;

// Result tracking
const results = {
  jestFiles: [],
  vitestFiles: [],
  missingVitestFiles: [],
  passedVitestTests: [],
  failedVitestTests: [],
  readyForRemoval: []
};

/**
 * Find all Jest unit test files
 */
async function findJestUnitTestFiles() {
  console.log('Identifying Jest unit test files...');
  
  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } 
        else if (entry.isFile() && entry.name.endsWith('.test.js')) {
          results.jestFiles.push(fullPath);
          
          // Check for corresponding Vitest file
          const vitestPath = fullPath.replace('.test.js', '.vitest.js');
          if (await fileExists(vitestPath)) {
            results.vitestFiles.push(vitestPath);
          } else {
            results.missingVitestFiles.push({
              jestFile: fullPath,
              expectedVitestFile: vitestPath
            });
          }
        }
      }
    } catch (error) {
      // If directory doesn't exist, create it
      if (error.code === 'ENOENT') {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } else {
        throw error;
      }
    }
  }
  
  // Only scan the unit tests directory
  await scanDir(UNIT_TESTS_DIR);
  
  console.log(`Found ${results.jestFiles.length} Jest unit test files`);
  console.log(`Found ${results.vitestFiles.length} matching Vitest unit test files`);
  
  if (results.missingVitestFiles.length > 0) {
    console.warn(`⚠️ Warning: ${results.missingVitestFiles.length} Jest unit test files don't have Vitest counterparts`);
    if (isVerbose) {
      console.log('Missing Vitest files:');
      results.missingVitestFiles.forEach(item => {
        console.log(`  - ${item.jestFile} (expected: ${item.expectedVitestFile})`);
      });
    }
  }
}

/**
 * Verify Vitest tests pass
 */
async function verifyVitestTests() {
  console.log('\nVerifying Vitest unit tests...');
  
  for (const vitestFile of results.vitestFiles) {
    const relativePath = path.relative(ROOT_DIR, vitestFile);
    console.log(`  Testing ${relativePath}...`);
    
    try {
      const success = await runVitestForFile(vitestFile);
      if (success) {
        results.passedVitestTests.push(vitestFile);
        console.log(`  ✅ Passed`);
      } else {
        results.failedVitestTests.push(vitestFile);
        console.log(`  ❌ Failed`);
      }
    } catch (error) {
      results.failedVitestTests.push(vitestFile);
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\nResults: ${results.passedVitestTests.length} passed, ${results.failedVitestTests.length} failed`);
}

/**
 * Determine which Jest files are safe to remove
 */
function identifySafeRemovals() {
  console.log('\nIdentifying Jest unit test files safe for removal...');
  
  for (const jestFile of results.jestFiles) {
    const correspondingVitestFile = jestFile.replace('.test.js', '.vitest.js');
    
    if (results.passedVitestTests.includes(correspondingVitestFile)) {
      results.readyForRemoval.push(jestFile);
    }
  }
  
  console.log(`${results.readyForRemoval.length} Jest unit test files are ready for removal`);
}

/**
 * Generate removal plan report
 */
async function generateReport() {
  console.log('\nGenerating removal plan report...');
  
  const reportLines = [
    '# Jest Unit Test Removal Progress Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Total Jest unit test files: ${results.jestFiles.length}`,
    `- Corresponding Vitest unit test files: ${results.vitestFiles.length}`,
    `- Missing Vitest unit test files: ${results.missingVitestFiles.length}`,
    `- Passing Vitest unit tests: ${results.passedVitestTests.length}`,
    `- Failing Vitest unit tests: ${results.failedVitestTests.length}`,
    `- Files safe to remove: ${results.readyForRemoval.length}`,
    '',
    '## Files Ready for Removal',
    ''
  ];
  
  results.readyForRemoval.forEach(file => {
    const relativePath = path.relative(ROOT_DIR, file);
    reportLines.push(`- ${relativePath}`);
  });
  
  reportLines.push('', '## Missing Vitest Files', '');
  
  if (results.missingVitestFiles.length === 0) {
    reportLines.push('No missing Vitest files! All Jest unit tests have been migrated.');
  } else {
    results.missingVitestFiles.forEach(item => {
      const jestRelative = path.relative(ROOT_DIR, item.jestFile);
      const vitestRelative = path.relative(ROOT_DIR, item.expectedVitestFile);
      reportLines.push(`- Jest: \`${jestRelative}\` → Missing: \`${vitestRelative}\``);
    });
  }
  
  reportLines.push('', '## Failing Vitest Tests', '');
  
  if (results.failedVitestTests.length === 0) {
    reportLines.push('No failing Vitest unit tests! All tests are passing.');
  } else {
    results.failedVitestTests.forEach(file => {
      const relativePath = path.relative(ROOT_DIR, file);
      reportLines.push(`- ${relativePath}`);
    });
  }
  
  reportLines.push('', '## Next Steps', '');
  
  if (results.readyForRemoval.length === results.jestFiles.length) {
    reportLines.push('All Jest unit test files are ready for removal! You can proceed with the migration.');
  } else {
    reportLines.push('Follow these steps to complete the unit test migration:');
    reportLines.push('');
    reportLines.push('1. Fix failing Vitest unit tests');
    reportLines.push('2. Complete missing Vitest unit test migrations');
    reportLines.push('3. Run this script again to verify all unit tests pass');
    reportLines.push('4. When all unit tests are green, proceed with Jest unit test removal');
  }
  
  // Write report to file
  const reportContent = reportLines.join('\n');
  const reportPath = path.join(ROOT_DIR, 'docs', 'JEST_UNIT_TEST_REMOVAL_PROGRESS.md');
  await fs.writeFile(reportPath, reportContent);
  
  console.log(`Report generated at: ${reportPath}`);
  
  // Generate removal script if all tests are ready
  if (results.readyForRemoval.length === results.jestFiles.length) {
    await generateRemovalScript();
  }
}

/**
 * Generate a script to execute the removal
 */
async function generateRemovalScript() {
  console.log('\nGenerating removal script...');
  
  const scriptLines = [
    '#!/usr/bin/env node',
    '',
    '/**',
    ' * Jest Unit Test Removal Execution Script',
    ' * ',
    ' * This script removes Jest unit test files that have been fully migrated to Vitest.',
    ' * IMPORTANT: Run this script only after verifying all Vitest unit tests pass!',
    ' */',
    '',
    'import fs from \'fs/promises\';',
    'import path from \'path\';',
    'import { fileURLToPath } from \'url\';',
    'import minimist from \'minimist\';',
    '',
    '// Argument parsing',
    'const args = minimist(process.argv.slice(2), {',
    '  boolean: [\'dry-run\', \'help\'],',
    '  alias: {',
    '    d: \'dry-run\',',
    '    h: \'help\'',
    '  }',
    '});',
    '',
    '// Help message',
    'if (args.help) {',
    '  console.log(`',
    'Jest Unit Test Removal Execution Script',
    '',
    'This script removes Jest unit test files that have been fully migrated to Vitest.',
    '',
    'Options:',
    '  --dry-run, -d    Simulate the removal process without actually deleting files',
    '  --help, -h       Show this help message',
    '',
    'Example:',
    '  node scripts/execute-jest-unit-test-removal.js --dry-run',
    '  `);',
    '  process.exit(0);',
    '}',
    '',
    '// Configuration',
    'const __dirname = path.dirname(fileURLToPath(import.meta.url));',
    'const ROOT_DIR = path.resolve(__dirname, \'..\');',
    'const BACKUP_DIR = path.join(ROOT_DIR, \'test-backups\', \'unit\');',
    'const isDryRun = args[\'dry-run\'];',
    '',
    '// Files to remove',
    'const filesToRemove = ['
  ];
  
  results.readyForRemoval.forEach(file => {
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    scriptLines.push(`  '${relativePath}',`);
  });
  
  scriptLines.push(
    '];',
    '',
    '/**',
    ' * Create backup directory',
    ' */',
    'async function createBackupDir() {',
    '  console.log(\'Creating backup directory...\');',
    '  await fs.mkdir(BACKUP_DIR, { recursive: true });',
    '}',
    '',
    '/**',
    ' * Backup a file before removal',
    ' */',
    'async function backupFile(filePath) {',
    '  const fullPath = path.join(ROOT_DIR, filePath);',
    '  const backupPath = path.join(BACKUP_DIR, filePath.replace(\'tests/unit/\', \'\'));',
    '  const backupDir = path.dirname(backupPath);',
    '',
    '  await fs.mkdir(backupDir, { recursive: true });',
    '  await fs.copyFile(fullPath, backupPath);',
    '  console.log(`  Backed up: ${filePath}`);',
    '}',
    '',
    '/**',
    ' * Remove Jest files',
    ' */',
    'async function removeJestFiles() {',
    '  console.log(`\\nRemoving ${filesToRemove.length} Jest unit test files...`);',
    '  console.log(`Dry run: ${isDryRun ? \'Yes\' : \'No\'}`);',
    '',
    '  for (const file of filesToRemove) {',
    '    const fullPath = path.join(ROOT_DIR, file);',
    '    ',
    '    // Backup the file',
    '    await backupFile(file);',
    '    ',
    '    // Remove the file (unless in dry-run mode)',
    '    if (!isDryRun) {',
    '      await fs.unlink(fullPath);',
    '      console.log(`  Removed: ${file}`);',
    '    } else {',
    '      console.log(`  Would remove: ${file}`);',
    '    }',
    '  }',
    '}',
    '',
    '/**',
    ' * Main function',
    ' */',
    'async function main() {',
    '  try {',
    '    await createBackupDir();',
    '    await removeJestFiles();',
    '',
    '    if (isDryRun) {',
    '      console.log(\'\\nDry run completed. No files were actually removed.\');',
    '      console.log(\'Run without --dry-run to perform the actual removal.\');',
    '    } else {',
    '      console.log(\'\\nJest unit test files have been removed and backed up to:\', BACKUP_DIR);',
    '    }',
    '  } catch (error) {',
    '    console.error(\'Error:\', error);',
    '    process.exit(1);',
    '  }',
    '}',
    '',
    'main();'
  );
  
  const scriptContent = scriptLines.join('\n');
  const scriptPath = path.join(ROOT_DIR, 'scripts', 'execute-jest-unit-test-removal.js');
  await fs.writeFile(scriptPath, scriptContent);
  console.log(`Removal script generated at: ${scriptPath}`);
  
  // Make the script executable
  try {
    await fs.chmod(scriptPath, 0o755);
  } catch (error) {
    console.log('Note: Unable to make script executable. You may need to run: chmod +x scripts/execute-jest-unit-test-removal.js');
  }
}

/**
 * Dry run removal process
 */
async function performDryRun() {
  if (!isDryRun) return;
  
  console.log('\nPerforming dry run of removal process...');
  
  for (const file of results.readyForRemoval) {
    const relativePath = path.relative(ROOT_DIR, file);
    console.log(`Would remove: ${relativePath}`);
  }
  
  console.log('\nThis was a dry run. No files were actually removed.');
}

/**
 * Helper to check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Vitest for a specific file
 */
async function runVitestForFile(vitestFile) {
  const relativePath = path.relative(ROOT_DIR, vitestFile);
  
  return new Promise((resolve) => {
    const vitest = spawn('npx', ['vitest', 'run', relativePath, '--reporter', 'basic'], {
      cwd: ROOT_DIR,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' }
    });
    
    let output = '';
    
    vitest.stdout.on('data', (data) => {
      output += data.toString();
      if (isVerbose) {
        process.stdout.write(data);
      }
    });
    
    vitest.stderr.on('data', (data) => {
      output += data.toString();
      if (isVerbose) {
        process.stderr.write(data);
      }
    });
    
    vitest.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Jest Unit Test Removal Preparation Script');
    console.log('========================================');
    console.log(`Mode: ${isDryRun ? 'Dry Run' : 'Analysis Only'}`);
    
    await findJestUnitTestFiles();
    
    if (results.vitestFiles.length > 0) {
      await verifyVitestTests();
      identifySafeRemovals();
      await generateReport();
      await performDryRun();
    } else {
      console.log('\nNo Vitest unit test files found to verify. Migration may not have started yet.');
    }
    
    console.log('\nPreparation complete!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();