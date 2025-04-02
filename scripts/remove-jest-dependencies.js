#!/usr/bin/env node

/**
 * Jest Dependency Removal Script
 * 
 * This script removes Jest dependencies from package.json as part of the
 * Jest to Vitest migration. It creates a backup of the original package.json
 * before making changes.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Configuration
const config = {
  packageJsonPath: path.join(rootDir, 'package.json'),
  backupPath: path.join(rootDir, 'package.json.jest-backup'),
  jestDependencies: [
    '@jest/globals',
    '@types/jest',
    'jest',
    'ts-jest'
  ],
  dryRun: process.argv.includes('--dry-run')
};

// Create backup
async function createBackup() {
  try {
    await fs.copyFile(config.packageJsonPath, config.backupPath);
    console.log(`✅ Created backup: ${config.backupPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create backup: ${error.message}`);
    return false;
  }
}

// Remove Jest dependencies
async function removeJestDependencies() {
  try {
    // Read package.json
    const packageJsonContent = await fs.readFile(config.packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // Track changes
    const removed = {
      dependencies: [],
      devDependencies: []
    };
    
    // Check dependencies
    if (packageJson.dependencies) {
      for (const dep of config.jestDependencies) {
        if (packageJson.dependencies[dep]) {
          removed.dependencies.push({ name: dep, version: packageJson.dependencies[dep] });
          delete packageJson.dependencies[dep];
        }
      }
    }
    
    // Check devDependencies
    if (packageJson.devDependencies) {
      for (const dep of config.jestDependencies) {
        if (packageJson.devDependencies[dep]) {
          removed.devDependencies.push({ name: dep, version: packageJson.devDependencies[dep] });
          delete packageJson.devDependencies[dep];
        }
      }
    }
    
    // Write updated package.json if not dry run
    if (!config.dryRun) {
      await fs.writeFile(
        config.packageJsonPath, 
        JSON.stringify(packageJson, null, 2) + '\n',
        'utf8'
      );
    }
    
    return removed;
  } catch (error) {
    console.error(`❌ Failed to process package.json: ${error.message}`);
    throw error;
  }
}

// Main function
async function main() {
  console.log('=================================================');
  console.log('      JEST DEPENDENCY REMOVAL TOOL                ');
  console.log('=================================================');
  
  if (config.dryRun) {
    console.log('Running in DRY RUN mode - no changes will be made');
  }
  
  try {
    // Create backup first (unless dry run)
    let backupCreated = config.dryRun;
    if (!config.dryRun) {
      backupCreated = await createBackup();
    }
    
    if (backupCreated || config.dryRun) {
      // Remove dependencies
      const removed = await removeJestDependencies();
      
      // Print summary
      console.log('\n📋 Dependencies Removed:');
      
      if (removed.dependencies.length === 0 && removed.devDependencies.length === 0) {
        console.log('No Jest dependencies found');
      } else {
        if (removed.dependencies.length > 0) {
          console.log('\n🔹 From dependencies:');
          removed.dependencies.forEach(dep => {
            console.log(`  - ${dep.name}@${dep.version}`);
          });
        }
        
        if (removed.devDependencies.length > 0) {
          console.log('\n🔹 From devDependencies:');
          removed.devDependencies.forEach(dep => {
            console.log(`  - ${dep.name}@${dep.version}`);
          });
        }
        
        const totalRemoved = removed.dependencies.length + removed.devDependencies.length;
        
        if (config.dryRun) {
          console.log(`\nWould remove ${totalRemoved} Jest dependencies (dry run)`);
        } else {
          console.log(`\n✅ Successfully removed ${totalRemoved} Jest dependencies`);
        }
      }
      
      // Add reminder for npm install
      if (!config.dryRun && (removed.dependencies.length > 0 || removed.devDependencies.length > 0)) {
        console.log('\n⚠️ Remember to run "npm install" to update your node_modules directory');
      }
    }
    
    console.log('\n=================================================');
  } catch (error) {
    console.error('\n❌ Error removing Jest dependencies:', error);
    process.exit(1);
  }
}

// Run the script
main();