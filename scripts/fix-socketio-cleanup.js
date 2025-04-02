#!/usr/bin/env node

/**
 * Socket.IO Test Cleanup Fixer
 * 
 * This script detects Socket.IO test files that are missing proper cleanup patterns
 * and adds the necessary removeAllListeners() calls to ensure proper cleanup.
 * 
 * Usage: node scripts/fix-socketio-cleanup.js [--dry-run] [--verbose]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

// Parse command line args
const args = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'verbose', 'help'],
  alias: {
    d: 'dry-run',
    v: 'verbose',
    h: 'help'
  }
});

// Display help if requested
if (args.help) {
  console.log(`
Socket.IO Test Cleanup Fixer

Usage: node scripts/fix-socketio-cleanup.js [options]

Options:
  -d, --dry-run    Analyze files but don't make any changes
  -v, --verbose    Show detailed information about fixes
  -h, --help       Show this help message

Description:
  This script analyzes Socket.IO test files and adds proper cleanup patterns 
  where they're missing. It helps ensure that all tests properly remove event 
  listeners to prevent memory leaks and test interference.
  `);
  process.exit(0);
}

// Get current directory in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Configuration
const config = {
  socketTestsDir: path.join(rootDir, 'tests', 'unit', 'websocket'),
  backupDir: path.join(rootDir, 'tests', 'backups', 'websocket'),
  dryRun: args['dry-run'], 
  verbose: args.verbose
};

// Create backup directory if it doesn't exist
async function ensureBackupDirectory() {
  try {
    await fs.access(config.backupDir);
  } catch (error) {
    await fs.mkdir(config.backupDir, { recursive: true });
    console.log(`Created backup directory: ${config.backupDir}`);
  }
}

// Check if a file has proper cleanup patterns
async function checkFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  // Check if the file already has removeAllListeners
  return {
    path: filePath,
    hasCleanup: content.includes('removeAllListeners'),
    content
  };
}

// Apply fixes to a file
async function fixFile(file) {
  let { content } = file;
  const fileName = path.basename(file.path);
  
  // Create a backup first
  const backupPath = path.join(config.backupDir, `${fileName}.bak`);
  
  if (!config.dryRun) {
    await fs.writeFile(backupPath, content);
    if (config.verbose) {
      console.log(`Created backup: ${backupPath}`);
    }
  }
  
  // Different patterns to detect and fix
  
  // Special case for files that weren't correctly fixed by the first run
  const specialCaseFiles = [
    'api-service-status.vitest.js',
    'bare-minimum-broadcast.vitest.js',
    'improved-system-monitoring.vitest.js',
    'improved-websocket-integration.vitest.js',
    'reconnection-simulator-standalone.vitest.js',
    'simple-socket-test.vitest.js',
    'simple.vitest.js',
    'system-monitoring.vitest.js',
    'websocket-integration.vitest.js'
  ];
  
  if (specialCaseFiles.includes(fileName)) {
    // Special fix for these files - add before the final closing brace
    content = content.replace(
      /\n}\);\s*$/,
      `\n  // Cleanup event listeners after each test
  afterEach(() => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    mockClient?.removeAllListeners();
  });
});
`
    );
  }
  // Pattern 1: afterEach hook exists, add to it
  else if (content.includes('afterEach(') && !content.includes('afterEach(() => {')) {
    // Add removeAllListeners to existing afterEach
    content = content.replace(
      /afterEach\((.*?)\s*=>\s*{/g,
      (match, capture) => {
        return `afterEach(${capture} => {\n    // Ensure proper cleanup of event listeners\n    io?.removeAllListeners();\n    socket?.removeAllListeners();`;
      }
    );
  }
  // Pattern 2: afterEach arrow function exists
  else if (content.includes('afterEach(() => {')) {
    // Add removeAllListeners to existing afterEach arrow function
    content = content.replace(
      /afterEach\(\(\)\s*=>\s*{(?!\s*\/\/\s*Ensure proper cleanup|io\?.removeAllListeners|socket\?.removeAllListeners)/g,
      'afterEach(() => {\n    // Ensure proper cleanup of event listeners\n    io?.removeAllListeners();\n    socket?.removeAllListeners();'
    );
  }
  // Pattern 3: No afterEach hook, add one before afterAll if it exists
  else if (content.includes('afterAll(')) {
    content = content.replace(
      /afterAll\(/g,
      `// Cleanup event listeners after each test
afterEach(() => {
  // Ensure proper cleanup of event listeners
  io?.removeAllListeners();
  socket?.removeAllListeners();
});

afterAll(`
    );
  }
  // Pattern 4: No afterEach or afterAll, add afterEach before the last closing brace
  else {
    content = content.replace(
      /};\s*$/,
      `};

// Cleanup event listeners after each test
afterEach(() => {
  // Ensure proper cleanup of event listeners
  io?.removeAllListeners();
  socket?.removeAllListeners();
});
`
    );
  }
  
  // Save the changes
  if (!config.dryRun) {
    await fs.writeFile(file.path, content);
    console.log(`✅ Fixed: ${fileName}`);
  } else {
    if (config.verbose) {
      console.log(`Would fix: ${fileName} (dry run)`);
    }
  }
  
  return true;
}

// Main function
async function main() {
  console.log('=================================================');
  console.log('      SOCKET.IO TEST CLEANUP FIXER                ');
  console.log('=================================================');
  
  if (config.dryRun) {
    console.log('Running in DRY RUN mode - no files will be modified');
  }
  
  try {
    // Create backup directory if needed
    if (!config.dryRun) {
      await ensureBackupDirectory();
    }
    
    // Get all Socket.IO test files
    const files = await fs.readdir(config.socketTestsDir);
    const testFiles = files.filter(file => file.endsWith('.vitest.js'));
    
    console.log(`Found ${testFiles.length} Socket.IO test files`);
    
    let needsFixCount = 0;
    let fixedCount = 0;
    
    // Check each file
    for (const fileName of testFiles) {
      const filePath = path.join(config.socketTestsDir, fileName);
      const fileCheck = await checkFile(filePath);
      
      if (!fileCheck.hasCleanup) {
        needsFixCount++;
        if (config.verbose) {
          console.log(`Fixing: ${fileName}`);
        }
        
        const fixed = await fixFile(fileCheck);
        if (fixed) {
          fixedCount++;
        }
      } else if (config.verbose) {
        console.log(`Skipping ${fileName} - already has cleanup`);
      }
    }
    
    // Summary
    console.log('\n=================================================');
    console.log(`Found ${needsFixCount} files needing cleanup fixes`);
    
    if (config.dryRun) {
      console.log(`Would have fixed ${fixedCount} files (dry run)`);
      console.log('Run without --dry-run to apply changes');
    } else {
      console.log(`Fixed ${fixedCount} files successfully`);
    }
    console.log('=================================================');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();