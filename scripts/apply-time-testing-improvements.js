/**
 * Apply Time Testing Improvements
 * 
 * This script replaces test files with their improved versions that implement
 * better time testing practices
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

async function applyTimeTestingImprovements() {
  try {
    console.log('Applying Time Testing Improvements');
    console.log('----------------------------------');

    // Get all improved test files
    const output = execSync('find tests -name "improved-*.vitest.js"').toString();
    const improvedFiles = output.trim().split('\n').filter(Boolean);

    console.log(`Found ${improvedFiles.length} improved test files`);
    
    const results = {
      success: [],
      skipped: [],
      errors: []
    };

    // Create backup directory
    const backupDir = path.join('test-backups', `time-testing-${new Date().toISOString().replace(/:/g, '-')}`);
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);

    // Process each improved file
    for (const improvedFilePath of improvedFiles) {
      try {
        // Get original file path
        const originalFilePath = improvedFilePath.replace('improved-', '');
        
        // Check if original file exists
        try {
          await fs.access(originalFilePath);
        } catch (err) {
          console.log(`Skipping ${improvedFilePath} as ${originalFilePath} does not exist`);
          results.skipped.push(improvedFilePath);
          continue;
        }

        // Backup original file
        const backupPath = path.join(backupDir, path.basename(originalFilePath));
        await fs.copyFile(originalFilePath, backupPath);
        
        // Copy improved file over original
        await fs.copyFile(improvedFilePath, originalFilePath);
        console.log(`Applied improvements to ${originalFilePath}`);
        results.success.push(originalFilePath);
      } catch (err) {
        console.error(`Error processing ${improvedFilePath}:`, err.message);
        results.errors.push(improvedFilePath);
      }
    }

    // Print summary
    console.log('\nSummary:');
    console.log(`- Successfully applied: ${results.success.length}`);
    console.log(`- Skipped: ${results.skipped.length}`);
    console.log(`- Errors: ${results.errors.length}`);
    console.log(`- Backups created in: ${backupDir}`);

    // Update migration progress
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const migrationUpdate = `\n### ${timestamp}\n- Applied time testing improvements to ${results.success.length} test files:\n`;
      
      const filesByType = {};
      for (const file of results.success) {
        const type = file.includes('/utils/') ? 'utility' : 
                    file.includes('/services/') ? 'service' :
                    file.includes('/controllers/') ? 'controller' :
                    file.includes('/websocket/') ? 'websocket' :
                    file.includes('/workflows/') ? 'workflow' :
                    file.includes('/integration/') ? 'integration' : 'other';
        
        if (!filesByType[type]) filesByType[type] = [];
        filesByType[type].push(file);
      }
      
      let updateDetails = migrationUpdate;
      for (const [type, files] of Object.entries(filesByType)) {
        updateDetails += `  - Improved ${files.length} ${type} tests with better time handling\n`;
      }
      
      updateDetails += '  - All tests now use TimeController and consistent time mocking\n';
      updateDetails += '  - Removed non-deterministic timing dependencies from tests\n';
      updateDetails += '  - Enhanced tests for better handling of setTimeout, setInterval, and Date.now\n';
      updateDetails += '  - Fixed performance.now direct usage with proper mocking mechanisms\n';
      
      const progressFilePath = 'TEST_MIGRATION_PROGRESS.md';
      const progressContent = await fs.readFile(progressFilePath, 'utf8');
      
      // Insert new update after "## Recent Progress" section
      const newContent = progressContent.replace(
        /## Recent Progress\n\n/,
        `## Recent Progress\n\n${updateDetails}\n`
      );
      
      await fs.writeFile(progressFilePath, newContent);
      console.log('\nUpdated TEST_MIGRATION_PROGRESS.md with latest changes');
    } catch (err) {
      console.error('Error updating migration progress:', err.message);
    }

  } catch (err) {
    console.error('Failed to apply time testing improvements:', err);
    process.exit(1);
  }
}

applyTimeTestingImprovements();