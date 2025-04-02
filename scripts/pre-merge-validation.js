/**
 * Pre-Merge Validation Script
 * 
 * This script performs automated validation checks to ensure the Jest to Vitest
 * migration branch is ready for merging to main. It checks for remaining Jest imports,
 * anthropicService references, proper test patterns, and other critical factors.
 * 
 * Usage: node scripts/pre-merge-validation.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Directories to check
  checkDirs: ['.', 'tests', 'utils', 'services'],
  
  // Directories to exclude from checks
  excludeDirs: [
    'node_modules',
    'test-backups',
    'coverage',
    'coverage-report',
    'test-reports',
    'test-results'
  ],
  
  // Paths to important files
  claudeServicePath: path.join(process.cwd(), 'services', 'claudeService.js'),
  packageJsonPath: path.join(process.cwd(), 'package.json'),
  socketTestsDir: path.join(process.cwd(), 'tests', 'unit', 'websocket'),
  
  // Standard model names that should be present
  expectedModelNames: ['claude-3-7-sonnet-20250219'],
  
  // Files to exclude from checks (documentation files, etc.)
  excludeFiles: [
    'JEST_REMOVAL_PLAN.md',
    'MIGRATION_SUMMARY.md',
    'MODEL_NAMING_STANDARD.md',
    'pre-merge-validation.js',
    'performance-comparison.js', // This file might legitimately mention Jest for comparison
    'apply-fixes.js' // Contains comment about removed anthropicService.js file
  ]
};

/**
 * Main validation function
 */
async function validateMerge() {
  console.log('🔍 Running pre-merge validation checks...');
  const issues = [];
  let warnings = 0;

  try {
    // Check 1: Jest imports
    console.log('\n📋 Checking for Jest imports...');
    const jestImports = await checkForPattern("from 'jest'", "Jest import", '*.js', '*.ts');
    if (jestImports.length > 0) {
      console.error('❌ ERROR: Found Jest imports:');
      jestImports.forEach(item => console.error(`   - ${item}`));
      issues.push('Jest imports found');
    } else {
      console.log('✅ No Jest imports found');
    }

    // Check 2: Jest requires
    console.log('\n📋 Checking for Jest requires...');
    const jestRequires = await checkForPattern("require('jest')", "Jest require", '*.js', '*.ts');
    if (jestRequires.length > 0) {
      console.error('❌ ERROR: Found Jest requires:');
      jestRequires.forEach(item => console.error(`   - ${item}`));
      issues.push('Jest requires found');
    } else {
      console.log('✅ No Jest requires found');
    }

    // Check 3: anthropicService references
    console.log('\n📋 Checking for anthropicService references...');
    const anthropicRefs = await checkForPattern("anthropicService", "anthropicService reference", '*.js', '*.ts');
    if (anthropicRefs.length > 0) {
      // Filter out documentation files
      const realRefs = anthropicRefs.filter(ref => 
        !CONFIG.excludeFiles.some(exclude => ref.includes(exclude))
      );
      
      if (realRefs.length > 0) {
        console.error('❌ ERROR: Found anthropicService references:');
        realRefs.forEach(item => console.error(`   - ${item}`));
        issues.push('anthropicService references found');
      } else {
        console.log('✅ No anthropicService references found in code (only documentation)');
      }
    } else {
      console.log('✅ No anthropicService references found');
    }

    // Check 4: Verify Claude service has standard model names
    console.log('\n📋 Verifying Claude service...');
    try {
      const claudeService = await fs.readFile(CONFIG.claudeServicePath, 'utf8');
      
      const missingModels = CONFIG.expectedModelNames.filter(
        model => !claudeService.includes(model)
      );
      
      if (missingModels.length > 0) {
        console.error('❌ ERROR: Claude service is missing standard model references:');
        missingModels.forEach(model => console.error(`   - ${model}`));
        issues.push('Missing standard model names in claudeService.js');
      } else {
        console.log('✅ Claude service has all standard model references');
      }
    } catch (e) {
      console.error(`❌ ERROR: Could not verify Claude service: ${e.message}`);
      issues.push('Could not verify Claude service');
    }

    // Check 5: Socket.IO tests for proper cleanup patterns
    console.log('\n📋 Checking Socket.IO tests for proper cleanup patterns...');
    try {
      const socketTestFiles = await fs.readdir(CONFIG.socketTestsDir);
      const testFilesWithoutCleanup = [];
      
      for (const file of socketTestFiles) {
        if (file.endsWith('.vitest.js')) {
          const filePath = path.join(CONFIG.socketTestsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          if (!content.includes('removeAllListeners')) {
            testFilesWithoutCleanup.push(file);
          }
        }
      }
      
      if (testFilesWithoutCleanup.length > 0) {
        console.warn('⚠️ WARNING: Socket.IO tests potentially missing proper cleanup:');
        testFilesWithoutCleanup.forEach(file => 
          console.warn(`   - ${file} (may be missing removeAllListeners)`)
        );
        warnings++;
      } else {
        console.log('✅ All Socket.IO tests appear to have proper cleanup');
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.warn('⚠️ WARNING: Socket.IO tests directory not found. Skipping check.');
        warnings++;
      } else {
        console.error(`❌ ERROR: Could not verify Socket.IO tests: ${e.message}`);
        issues.push('Could not verify Socket.IO tests');
      }
    }

    // Check 6: Jest dependencies in package.json
    console.log('\n📋 Verifying Jest removal from dependencies...');
    try {
      const packageJson = JSON.parse(
        await fs.readFile(CONFIG.packageJsonPath, 'utf8')
      );
      
      const jestDependencies = [
        ...Object.keys(packageJson.dependencies || {}),
        ...Object.keys(packageJson.devDependencies || {})
      ].filter(dep => dep.includes('jest'));
      
      if (jestDependencies.length > 0) {
        console.error('❌ ERROR: Found Jest dependencies in package.json:');
        jestDependencies.forEach(dep => console.error(`   - ${dep}`));
        issues.push('Jest dependencies found in package.json');
      } else {
        console.log('✅ No Jest dependencies found in package.json');
      }
    } catch (e) {
      console.error(`❌ ERROR: Could not verify package.json: ${e.message}`);
      issues.push('Could not verify package.json');
    }

    // Check 7: Test files for consistent patterns
    console.log('\n📋 Checking for consistent test patterns...');
    try {
      const { stdout: oldPatternFiles } = await execPromise(
        "find tests -name '*.vitest.js' -exec grep -L 'import { vi, ' {} \\; || echo ''"
      );
      
      const nonCompliantFiles = oldPatternFiles.trim().split('\n').filter(Boolean);
      
      if (nonCompliantFiles.length > 0) {
        console.warn('⚠️ WARNING: Found test files not using the recommended import pattern:');
        nonCompliantFiles.forEach(file => console.warn(`   - ${file}`));
        warnings++;
      } else {
        console.log('✅ All test files use the recommended import pattern');
      }
    } catch (e) {
      console.warn(`⚠️ WARNING: Could not check for consistent test patterns: ${e.message}`);
      warnings++;
    }

    // Summary
    console.log('\n📊 Validation Summary:');
    if (issues.length === 0) {
      console.log('✅ All critical validation checks passed!');
    } else {
      console.error(`❌ Found ${issues.length} critical issues that need to be resolved:`);
      issues.forEach(issue => console.error(`   - ${issue}`));
    }
    
    if (warnings > 0) {
      console.warn(`⚠️ Found ${warnings} warnings that should be reviewed.`);
    }
    
    return issues.length === 0;
  } catch (error) {
    console.error('❌ ERROR: Validation script failed:', error);
    return false;
  }
}

/**
 * Helper function to check for a pattern in files
 */
async function checkForPattern(pattern, label, ...fileTypes) {
  const results = [];
  
  for (const dir of CONFIG.checkDirs) {
    const fileTypeArgs = fileTypes.map(type => `--include="${type}"`).join(' ');
    
    // Build exclude dirs arguments
    const excludeDirArgs = CONFIG.excludeDirs
      .map(dir => `--exclude-dir="${dir}"`)
      .join(' ');
    
    try {
      const { stdout } = await execPromise(
        `grep -r "${pattern}" ${fileTypeArgs} ${excludeDirArgs} ${dir} || echo ''`
      );
      
      if (stdout.trim()) {
        // Filter out results from validation scripts that are checking for the patterns
        const filteredResults = stdout.trim().split('\n').filter(line => {
          // Skip results from files that are in the exclude list
          return !CONFIG.excludeFiles.some(excludeFile => line.includes(excludeFile));
        });
        
        results.push(...filteredResults);
      }
    } catch (e) {
      // grep returns non-zero exit code when no matches, which throws an error
      // We can safely ignore this
      if (e.code !== 1) {
        console.error(`Error checking for ${label}: ${e.message}`);
      }
    }
  }
  
  return results;
}

// Execute validation
validateMerge()
  .then(valid => {
    if (valid) {
      console.log('\n🎉 Pre-merge validation completed successfully!');
      process.exit(0);
    } else {
      console.error('\n⛔ Pre-merge validation failed. Please fix the issues above before merging.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error running validation:', err);
    process.exit(1);
  });