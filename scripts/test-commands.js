#!/usr/bin/env node

/**
 * Test Command Helper
 * 
 * This script provides an easy way to run various test commands
 * without modifying package.json.
 */

import { spawn } from 'child_process';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2), {
  string: ['command'],
  boolean: ['help'],
  alias: {
    h: 'help',
    c: 'command'
  },
  default: {
    command: 'help'
  }
});

// Available commands
const COMMANDS = {
  // Vitest commands
  'vitest': {
    description: 'Run all Vitest tests',
    command: 'node scripts/run-vitest.js'
  },
  'vitest:unit': {
    description: 'Run only Vitest unit tests',
    command: 'node scripts/run-vitest.js --pattern "tests/unit/**/*.vitest.js"'
  },
  'vitest:coverage': {
    description: 'Run Vitest tests with coverage',
    command: 'node scripts/run-vitest.js --coverage'
  },
  
  // Jest commands
  'jest': {
    description: 'Run all Jest tests (legacy)',
    command: 'npx jest'
  },
  'jest:unit': {
    description: 'Run only Jest unit tests (legacy)',
    command: 'npx jest tests/unit'
  },
  
  // Migration commands
  'prepare-migration': {
    description: 'Prepare for Jest test removal',
    command: 'node scripts/prepare-jest-removal.js'
  },
  'prepare-migration:dry-run': {
    description: 'Prepare for Jest test removal (dry run)',
    command: 'node scripts/prepare-jest-removal.js --dry-run'
  },
  'execute-migration': {
    description: 'Execute Jest test removal (if generated)',
    command: 'node scripts/execute-jest-unit-test-removal.js'
  },
  'execute-migration:dry-run': {
    description: 'Execute Jest test removal dry run (if generated)',
    command: 'node scripts/execute-jest-unit-test-removal.js --dry-run'
  }
};

// Print help
function showHelp() {
  console.log(`
Test Command Helper

Usage:
  node scripts/test-commands.js --command <command>

Available commands:
${Object.entries(COMMANDS)
  .map(([key, value]) => `  ${key.padEnd(25)} - ${value.description}`)
  .join('\n')}

Examples:
  node scripts/test-commands.js --command vitest
  node scripts/test-commands.js --command prepare-migration:dry-run
  `);
}

// Run a command
function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning command: ${command}\n`);
    
    const [cmd, ...cmdArgs] = command.split(' ');
    const childProcess = spawn(cmd, cmdArgs, { 
      stdio: 'inherit',
      shell: true
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    childProcess.on('error', (err) => {
      reject(new Error(`Failed to start command: ${err.message}`));
    });
  });
}

// Main function
async function main() {
  try {
    // Show help if requested
    if (args.help || args.command === 'help') {
      showHelp();
      return;
    }
    
    // Get command
    const commandName = args.command;
    const commandConfig = COMMANDS[commandName];
    
    // Check if command exists
    if (!commandConfig) {
      console.error(`Unknown command: ${commandName}`);
      showHelp();
      process.exit(1);
    }
    
    // Run command
    await runCommand(commandConfig.command);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();