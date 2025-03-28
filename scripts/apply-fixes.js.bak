#!/usr/bin/env node

/**
 * Fix Application Script
 * 
 * This script renames our fixed files to replace the originals with corrected versions.
 * It also ensures file permissions are set correctly.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Files to be replaced (source -> destination)
const filesToReplace = [
  {
    source: './utils/fixed-documentFingerprinter.js',
    destination: './utils/documentFingerprinter.js',
    backup: './utils/documentFingerprinter.js.bak'
  },
  {
    source: './utils/fixed-batchProcessor.js',
    destination: './utils/batchProcessor.js',
    backup: './utils/batchProcessor.js.bak'
  },
  {
    source: './tests/manual/fixed-apply-optimizations.js',
    destination: './tests/manual/apply-optimizations.js',
    backup: './tests/manual/apply-optimizations.js.bak'
  },
  {
    source: './tests/manual/fixed-check-optimization-settings.js',
    destination: './tests/manual/check-optimization-settings.js',
    backup: './tests/manual/check-optimization-settings.js.bak'
  },
  {
    source: './services/fixed-anthropicService.js',
    destination: './services/anthropicService.js',
    backup: './services/anthropicService.js.bak'
  },
  {
    source: './services/fixed-perplexityService.js',
    destination: './services/perplexityService.js',
    backup: './services/perplexityService.js.bak'
  }
];

// Make sure a directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Copy a file with path resolution
async function copyFile(source, destination) {
  const sourcePath = path.resolve(rootDir, source);
  const destPath = path.resolve(rootDir, destination);
  
  try {
    // Check if source exists
    await fs.access(sourcePath);
    
    // Ensure the destination directory exists
    await ensureDirectoryExists(path.dirname(destPath));
    
    // Copy the file
    await fs.copyFile(sourcePath, destPath);
    console.log(`✅ Copied ${source} to ${destination}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to copy ${source} to ${destination}: ${error.message}`);
    return false;
  }
}

// Backup a file before replacing it
async function backupFile(filePath, backupPath) {
  const fullFilePath = path.resolve(rootDir, filePath);
  const fullBackupPath = path.resolve(rootDir, backupPath);
  
  try {
    // Check if original file exists
    await fs.access(fullFilePath);
    
    // Ensure backup directory exists
    await ensureDirectoryExists(path.dirname(fullBackupPath));
    
    // Create backup
    await fs.copyFile(fullFilePath, fullBackupPath);
    console.log(`📦 Backed up ${filePath} to ${backupPath}`);
    
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️ No existing file to backup for ${filePath}`);
      return true; // Not an error if file doesn't exist
    }
    
    console.error(`❌ Failed to backup ${filePath}: ${error.message}`);
    return false;
  }
}

// Main function to apply all fixes
async function applyFixes() {
  console.log('=================================================');
  console.log('      APPLYING CODEBASE FIXES                    ');
  console.log('=================================================');
  
  let successCount = 0;
  
  for (const file of filesToReplace) {
    // First backup the original file if it exists
    const backupSuccess = await backupFile(file.destination, file.backup);
    
    if (backupSuccess) {
      // Then copy the fixed file to replace the original
      const copySuccess = await copyFile(file.source, file.destination);
      
      if (copySuccess) {
        successCount++;
      }
    }
  }
  
  console.log('\n=================================================');
  console.log(`Applied ${successCount}/${filesToReplace.length} fixes successfully`);
  console.log('=================================================');
  
  if (successCount === filesToReplace.length) {
    console.log('✅ All fixes applied successfully!');
  } else {
    console.log('⚠️ Some fixes could not be applied. Check the logs above.');
  }
  
  // Make the test files executable
  try {
    await fs.chmod(path.resolve(rootDir, './tests/manual/apply-optimizations.js'), 0o755);
    await fs.chmod(path.resolve(rootDir, './tests/manual/check-optimization-settings.js'), 0o755);
    console.log('✅ Made test scripts executable');
  } catch (error) {
    console.error(`❌ Failed to make scripts executable: ${error.message}`);
  }
}

// Run the script
applyFixes().catch(error => {
  console.error('Error applying fixes:', error);
  process.exit(1);
});