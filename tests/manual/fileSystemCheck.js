
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import logger from '../../utils/logger.js';

const CRITICAL_DIRECTORIES = [
  'prompts',
  'services',
  'utils',
  'public',
  'tests',
  'config'
];

async function checkFileSystem() {
  console.log('======================================');
  console.log('      FILE SYSTEM HEALTH CHECK');
  console.log('======================================');
  
  // Check disk space
  console.log('\n[1] Checking disk space...');
  try {
    const stats = await fs.statfs('/');
    const totalSpace = stats.bsize * stats.blocks;
    const freeSpace = stats.bsize * stats.bfree;
    const usedSpace = totalSpace - freeSpace;
    const usedPercentage = Math.round((usedSpace / totalSpace) * 100);
    
    console.log(`- Total disk space: ${formatBytes(totalSpace)}`);
    console.log(`- Free disk space: ${formatBytes(freeSpace)}`);
    console.log(`- Used disk space: ${formatBytes(usedSpace)} (${usedPercentage}%)`);
    
    if (usedPercentage > 90) {
      console.error('- ❌ Critical: Disk space usage is above 90%');
    } else if (usedPercentage > 75) {
      console.warn('- ⚠️ Warning: Disk space usage is above 75%');
    } else {
      console.log('- ✅ Disk space usage is within acceptable limits');
    }
  } catch (error) {
    console.error(`- ❌ Error checking disk space: ${error.message}`);
  }
  
  // Check critical directories
  console.log('\n[2] Checking critical directories...');
  
  for (const dir of CRITICAL_DIRECTORIES) {
    try {
      const stats = await fs.stat(dir);
      if (stats.isDirectory()) {
        console.log(`- ✅ ${dir} directory exists`);
        
        // Count files in directory
        const files = await fs.readdir(dir);
        console.log(`  - Contains ${files.length} files/directories`);
        
        // Check for specific files based on directory
        if (dir === 'prompts') {
          const engineDirs = ['claude', 'perplexity'];
          for (const engineDir of engineDirs) {
            try {
              const enginePath = path.join(dir, engineDir);
              const engineStats = await fs.stat(enginePath);
              if (engineStats.isDirectory()) {
                const engineFiles = await fs.readdir(enginePath);
                console.log(`  - ${engineDir}: ${engineFiles.length} prompt files`);
              } else {
                console.warn(`  - ⚠️ ${engineDir} is not a directory`);
              }
            } catch (error) {
              console.warn(`  - ⚠️ ${engineDir} directory not found in prompts`);
            }
          }
        }
      } else {
        console.warn(`- ⚠️ ${dir} exists but is not a directory`);
      }
    } catch (error) {
      console.error(`- ❌ ${dir} directory not found: ${error.message}`);
    }
  }
  
  // Check file permissions for key files
  console.log('\n[3] Checking file permissions for key files...');
  
  const keyFiles = [
    'server/routes.ts',
    'services/redisService.js',
    'utils/monitoring.js',
    'services/promptManager.js'
  ];
  
  for (const file of keyFiles) {
    try {
      const stats = await fs.stat(file);
      const permissions = stats.mode.toString(8).slice(-3);
      console.log(`- ${file}: permissions ${permissions}`);
      
      // On Unix-like systems, check if file is executable
      if (os.platform() !== 'win32') {
        const isExecutable = !!(stats.mode & 0o111);
        if (file.endsWith('.js') && !isExecutable) {
          console.warn(`  - ⚠️ JS file is not executable`);
        }
      }
    } catch (error) {
      console.error(`- ❌ Error checking ${file}: ${error.message}`);
    }
  }
  
  // Check for temporary files that might need cleanup
  console.log('\n[4] Checking for temporary files...');
  
  const tempDirs = ['uploads', 'content-uploads', 'tests/output'];
  
  for (const dir of tempDirs) {
    try {
      const stats = await fs.stat(dir);
      if (stats.isDirectory()) {
        const files = await fs.readdir(dir);
        console.log(`- ${dir}: ${files.length} files`);
        
        // Check if too many files
        if (files.length > 100) {
          console.warn(`  - ⚠️ Warning: ${dir} contains more than 100 files, may need cleanup`);
        }
        
        // Check total size of temp directory
        let totalSize = 0;
        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            const fileStats = await fs.stat(filePath);
            if (fileStats.isFile()) {
              totalSize += fileStats.size;
            }
          } catch (error) {
            // Skip files with issues
          }
        }
        
        console.log(`  - Total size: ${formatBytes(totalSize)}`);
        
        // Warn if total size is large
        if (totalSize > 100 * 1024 * 1024) {
          console.warn(`  - ⚠️ Warning: ${dir} is using more than 100MB of storage`);
        }
      } else {
        console.warn(`- ⚠️ ${dir} exists but is not a directory`);
      }
    } catch (error) {
      console.log(`- ${dir} not found or not accessible`);
    }
  }
  
  // Summary
  console.log('\n======================================');
  console.log('    FILE SYSTEM HEALTH CHECK COMPLETE');
  console.log('======================================');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the check
checkFileSystem().catch(error => {
  logger.error('File system health check failed', { error: error.message });
  console.error('Check failed with error:', error);
});
