/**
 * Post-Merge Critical Path Verification
 * 
 * This script checks the critical paths of the application to ensure 
 * they're still functioning after the Jest to Vitest migration.
 * 
 * Usage: node scripts/verify-critical-paths.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Critical components to verify
const CRITICAL_PATHS = [
  {
    name: "Claude Service",
    testPattern: "Claude",
    importance: "HIGH"
  },
  {
    name: "Perplexity Service",
    testPattern: "Perplexity",
    importance: "HIGH"
  },
  {
    name: "Socket.IO Implementation",
    testPattern: "Socket",
    importance: "HIGH"
  },
  {
    name: "Search Utilities",
    testPattern: "Search",
    importance: "MEDIUM"
  },
  {
    name: "Redis Client",
    testPattern: "Redis",
    importance: "HIGH"
  },
  {
    name: "Circuit Breaker",
    testPattern: "Circuit",
    importance: "MEDIUM"
  },
  {
    name: "Context Manager",
    testPattern: "Context",
    importance: "HIGH"
  }
];

// Terminal colors
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

/**
 * Executes a test for a specific critical path
 */
function verifyCriticalPath(path) {
  console.log(`\n${COLORS.bright}${COLORS.blue}Verifying ${path.name}...${COLORS.reset}`);
  console.log(`${COLORS.cyan}Importance: ${path.importance}${COLORS.reset}`);
  
  try {
    execSync(`node scripts/run-vitest.js --testNamePattern="${path.testPattern}"`, { 
      stdio: 'inherit',
      timeout: 60000 // 60 second timeout
    });
    
    console.log(`${COLORS.green}✅ ${path.name} is functioning correctly${COLORS.reset}`);
    return true;
  } catch (error) {
    console.error(`${COLORS.red}❌ ${path.name} verification failed${COLORS.reset}`);
    console.error(`${COLORS.yellow}This is a ${path.importance} priority component and should be fixed immediately${COLORS.reset}`);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyAllCriticalPaths() {
  console.log(`${COLORS.bright}${COLORS.magenta}CRITICAL PATH VERIFICATION${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.magenta}==========================${COLORS.reset}`);
  console.log("Verifying that critical application components still function after the migration\n");
  
  const results = [];
  
  for (const criticalPath of CRITICAL_PATHS) {
    const success = verifyCriticalPath(criticalPath);
    results.push({
      path: criticalPath,
      success
    });
  }
  
  // Summary
  console.log(`\n${COLORS.bright}${COLORS.magenta}VERIFICATION SUMMARY${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.magenta}===================${COLORS.reset}`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total critical paths: ${results.length}`);
  console.log(`${COLORS.green}Successful: ${successful}${COLORS.reset}`);
  
  if (failed > 0) {
    console.log(`${COLORS.red}Failed: ${failed}${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${COLORS.red}❌ Critical path verification failed${COLORS.reset}`);
    console.log(`${COLORS.yellow}Please fix the failing components before proceeding with deployment${COLORS.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${COLORS.bright}${COLORS.green}✅ All critical paths verified successfully${COLORS.reset}`);
    process.exit(0);
  }
}

// Run the verification
verifyAllCriticalPaths().catch(err => {
  console.error(`${COLORS.red}Error during verification:${COLORS.reset}`, err);
  process.exit(1);
});