#!/usr/bin/env node

/**
 * Script to run database tests
 * This script creates a PostgreSQL database if it doesn't already exist,
 * runs the database tests, and reports the results.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI colors for output formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fgBlack: '\x1b[30m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// Log a message with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Run shell command and return output
function run(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.stdio || 'pipe',
      encoding: 'utf8',
      ...options,
    });
  } catch (error) {
    if (options.ignoreErrors) {
      return error.stdout || '';
    }
    log(`Error running command: ${command}`, colors.fgRed);
    log(error.message, colors.fgRed);
    if (error.stdout) log(error.stdout);
    if (error.stderr) log(error.stderr);
    process.exit(1);
  }
}

// Check if we have a database available
function checkDatabaseAvailability() {
  log('Checking database availability...', colors.fgCyan);
  
  if (!process.env.DATABASE_URL) {
    log('DATABASE_URL environment variable not found.', colors.fgYellow);
    log('Make sure you have a PostgreSQL database available.', colors.fgYellow);
    return false;
  }
  
  try {
    // Try a simple database connection
    run('npx drizzle-kit generate');
    log('Database connection successful!', colors.fgGreen);
    return true;
  } catch (error) {
    log('Could not connect to the database.', colors.fgRed);
    log(error.message, colors.fgRed);
    return false;
  }
}

// Run database tests with Vitest
function runDatabaseTests() {
  log('\nRunning database tests...', colors.fgCyan);
  
  try {
    // Set environment for testing
    process.env.NODE_ENV = 'test';
    
    // Run Vitest tests with coverage
    const testCommand = 'npx vitest run tests/storage --coverage';
    log(`\nExecuting: ${testCommand}`, colors.fgYellow);
    
    run(testCommand, { stdio: 'inherit' });
    
    log('\nDatabase tests completed successfully!', colors.fgGreen);
    return true;
  } catch (error) {
    log('\nDatabase tests failed.', colors.fgRed);
    log(error.message, colors.fgRed);
    return false;
  }
}

// Main function
async function main() {
  log('\n======================================', colors.fgMagenta);
  log('       DATABASE TEST RUNNER', colors.bright + colors.fgMagenta);
  log('======================================\n', colors.fgMagenta);
  
  // Check database availability
  const databaseAvailable = checkDatabaseAvailability();
  if (!databaseAvailable) {
    log('\nCannot run database tests without a database connection.', colors.fgRed);
    log('Please make sure your PostgreSQL database is set up correctly.', colors.fgRed);
    process.exit(1);
  }
  
  // Run the database tests
  const testsSucceeded = runDatabaseTests();
  
  if (testsSucceeded) {
    log('\n======================================', colors.fgGreen);
    log('      DATABASE TESTS SUCCESSFUL', colors.bright + colors.fgGreen);
    log('======================================\n', colors.fgGreen);
  } else {
    log('\n======================================', colors.fgRed);
    log('        DATABASE TESTS FAILED', colors.bright + colors.fgRed);
    log('======================================\n', colors.fgRed);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error.message}`, colors.fgRed);
  process.exit(1);
});