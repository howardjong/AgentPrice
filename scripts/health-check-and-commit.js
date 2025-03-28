
#!/usr/bin/env node

/**
 * Health Check and Commit Script
 * 
 * This script runs the existing system health check, validates test migration progress,
 * and if all tests pass, automatically commits the changes with a descriptive message.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

console.log(`${colors.bright}${colors.blue}==============================================`);
console.log(`     HEALTH CHECK AND AUTO-COMMIT UTILITY     `);
console.log(`==============================================${colors.reset}\n`);

// Track overall health status
let allTestsPassed = true;
let healthCheckOutput = '';
let migrationCheckOutput = '';

try {
  // Step 1: Run system health check
  console.log(`${colors.cyan}Running system health check...${colors.reset}\n`);
  
  try {
    healthCheckOutput = execSync('node tests/manual/system-health-check.js', { encoding: 'utf8' });
    console.log(healthCheckOutput);
    
    if (healthCheckOutput.includes('❌') || healthCheckOutput.includes('Error') || healthCheckOutput.includes('Failed')) {
      console.log(`\n${colors.yellow}${colors.bright}⚠️ Health check reported issues - review output above${colors.reset}`);
      allTestsPassed = false;
    } else {
      console.log(`\n${colors.green}${colors.bright}✅ Health check passed successfully${colors.reset}`);
    }
  } catch (err) {
    console.error(`\n${colors.red}${colors.bright}❌ Error running health check:${colors.reset}`, err.message);
    allTestsPassed = false;
  }
  
  // Step 2: Run test migration validation
  console.log(`\n${colors.cyan}Validating test migration progress...${colors.reset}\n`);
  
  try {
    // Get migration progress statistics
    migrationCheckOutput = execSync('node scripts/track-migration-progress.js', { encoding: 'utf8' });
    console.log(migrationCheckOutput);
    
    // Extract migration progress percentage
    const progressMatch = migrationCheckOutput.match(/Migration progress: (\d+)%/);
    const migrationProgress = progressMatch ? parseInt(progressMatch[1]) : 0;
    
    if (migrationProgress < 50) {
      console.log(`\n${colors.yellow}${colors.bright}⚠️ Test migration is still below 50% (${migrationProgress}%)${colors.reset}`);
      // Don't fail for low migration progress - it's expected during the migration process
    } else {
      console.log(`\n${colors.green}${colors.bright}✅ Test migration is making good progress: ${migrationProgress}%${colors.reset}`);
    }
    
    // Run validation on a recently migrated test
    console.log(`\n${colors.cyan}Validating a recently migrated test...${colors.reset}\n`);
    
    const validationOutput = execSync('node scripts/validate-test-results.js -t circuitBreaker', { encoding: 'utf8' });
    console.log(validationOutput);
    
    if (validationOutput.includes('Validation PASSED')) {
      console.log(`\n${colors.green}${colors.bright}✅ Test validation passed${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}${colors.bright}⚠️ Test validation showed inconsistencies${colors.reset}`);
      allTestsPassed = false;
    }
  } catch (err) {
    console.error(`\n${colors.red}${colors.bright}❌ Error validating test migration:${colors.reset}`, err.message);
    allTestsPassed = false;
  }
  
  // If all health checks pass, commit changes
  if (allTestsPassed) {
    console.log(`\n${colors.cyan}All tests passed! Committing changes...${colors.reset}`);
    
    // Check if there are changes to commit
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (!statusOutput.trim()) {
      console.log(`\n${colors.yellow}No changes to commit.${colors.reset}`);
    } else {
      // Generate commit message with timestamp and brief description
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const commitMessage = `[Test Migration] Passed system health check and test validation [${timestamp}]`;
      
      // List the changed files
      console.log(`\n${colors.cyan}Changed files:${colors.reset}`);
      console.log(statusOutput);
      
      // Commit changes
      execSync('git add .', { encoding: 'utf8' });
      execSync(`git commit -m "${commitMessage}"`, { encoding: 'utf8' });
      
      console.log(`\n${colors.green}${colors.bright}${colors.bgGreen}✅ Changes committed successfully!${colors.reset}`);
      console.log(`${colors.green}Commit message: ${commitMessage}${colors.reset}`);
    }
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ Some checks failed - not committing changes${colors.reset}`);
    console.log(`Please fix the issues before committing.\n`);
  }
} catch (error) {
  console.error(`\n${colors.red}${colors.bright}❌ Unexpected error:${colors.reset}`, error.message);
  process.exit(1);
}
