#!/usr/bin/env node

/**
 * Database Transaction Isolation Verification Script
 * 
 * This script verifies that database tests don't leave any persistent data
 * in the database after tests run, confirming transaction isolation is working.
 */

const postgres = require('postgres');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Ensure we have DATABASE_URL environment variable
if (!process.env.DATABASE_URL) {
  console.error(`${colors.red}ERROR: DATABASE_URL environment variable is not set.${colors.reset}`);
  console.error('Make sure you have a PostgreSQL database configured.');
  process.exit(1);
}

// Ensure we're only running this on a test database
if (!process.env.DATABASE_URL.includes('test')) {
  console.error(`${colors.red}ERROR: This script should only be run against a test database.${colors.reset}`);
  console.error(`The current DATABASE_URL doesn't appear to be a test database.`);
  process.exit(1);
}

// Connect to the database
const sql = postgres(process.env.DATABASE_URL, { 
  ssl: false,
  max: 10, // Maximum number of connections
});

// Find patterns that might be used in tests
async function findTestDataPatterns() {
  console.log(`${colors.cyan}Scanning test files for test data patterns...${colors.reset}`);
  
  // Test files to scan
  const testsDir = 'tests';
  const testFiles = [];
  
  async function scanDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.js')) {
        testFiles.push(fullPath);
      }
    }
  }
  
  await scanDir(testsDir);
  console.log(`Found ${testFiles.length} test files.`);
  
  // Patterns to look for (e.g., test user IDs, test content strings)
  const patterns = new Set();
  
  for (const file of testFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      
      // Look for test string data
      const stringMatches = content.match(/'test[^']*'|"test[^"]*"/g);
      if (stringMatches) {
        stringMatches.forEach(match => {
          // Remove quotes and add to patterns
          const cleaned = match.replace(/['"]/g, '');
          if (cleaned.length > 5) { // Only include meaningful strings
            patterns.add(cleaned);
          }
        });
      }
      
      // Look for timestamps/uuids used in tests
      const dateNowMatches = content.match(/['"](test-[a-zA-Z0-9-]*)['"]/g);
      if (dateNowMatches) {
        dateNowMatches.forEach(match => {
          const cleaned = match.replace(/['"]/g, '');
          patterns.add(cleaned);
        });
      }
    } catch (error) {
      console.error(`${colors.red}Error reading file ${file}:${colors.reset}`, error.message);
    }
  }
  
  return Array.from(patterns);
}

// Check database tables for test data
async function checkTablesForTestData(patterns) {
  console.log(`\n${colors.cyan}Checking database for leftover test data...${colors.reset}`);
  
  // Get list of tables in the database
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  
  console.log(`Found ${tables.length} tables in the database.`);
  
  let testDataFound = false;
  
  // Check each table for test data
  for (const { table_name } of tables) {
    try {
      // Get all columns for the table to search through
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = ${table_name}
        AND table_schema = 'public'
      `;
      
      // Only check string/text columns
      const textColumns = columns
        .filter(col => ['text', 'character varying', 'varchar', 'char', 'uuid'].includes(col.data_type))
        .map(col => col.column_name);
      
      if (textColumns.length === 0) continue;
      
      // Build query to check for any test data in this table
      for (const pattern of patterns) {
        // Skip very short patterns to avoid false positives
        if (pattern.length < 5) continue;
        
        // Check each column that could contain the test data
        for (const column of textColumns) {
          // Use ILIKE for case-insensitive matching
          const query = `
            SELECT COUNT(*) as count FROM "${table_name}" 
            WHERE "${column}" ILIKE $1
          `;
          
          const result = await sql.unsafe(query, [`%${pattern}%`]);
          
          if (result[0].count > 0) {
            console.log(`${colors.red}Found ${result[0].count} rows with pattern "${pattern}" in ${table_name}.${column}${colors.reset}`);
            testDataFound = true;
            
            // Show a sample of the matching data
            const sampleQuery = `
              SELECT * FROM "${table_name}" 
              WHERE "${column}" ILIKE $1 
              LIMIT 3
            `;
            
            const samples = await sql.unsafe(sampleQuery, [`%${pattern}%`]);
            console.log(`Sample data:`, JSON.stringify(samples, null, 2));
          }
        }
      }
    } catch (error) {
      console.error(`${colors.yellow}Error checking table ${table_name}:${colors.reset}`, error.message);
    }
  }
  
  return !testDataFound;
}

// Main function
async function main() {
  console.log(`${colors.magenta}==============================================${colors.reset}`);
  console.log(`${colors.magenta}   DATABASE ISOLATION VERIFICATION SCRIPT    ${colors.reset}`);
  console.log(`${colors.magenta}==============================================${colors.reset}`);
  
  try {
    // First check that the database connection works
    console.log(`${colors.cyan}Checking database connection...${colors.reset}`);
    await sql`SELECT 1`;
    console.log(`${colors.green}Database connection successful.${colors.reset}`);
    
    // Find patterns to check for
    const patterns = await findTestDataPatterns();
    console.log(`Found ${patterns.length} test data patterns to check for.`);
    
    // Check for test data in the database
    const success = await checkTablesForTestData(patterns);
    
    console.log(`\n${colors.magenta}==============================================${colors.reset}`);
    if (success) {
      console.log(`${colors.green}SUCCESS: No test data found in the database.${colors.reset}`);
      console.log(`${colors.green}Transaction isolation appears to be working correctly.${colors.reset}`);
    } else {
      console.log(`${colors.red}WARNING: Test data found in the database.${colors.reset}`);
      console.log(`${colors.red}Transaction isolation may not be working correctly.${colors.reset}`);
      console.log(`${colors.yellow}Review the test files and ensure they're using proper transaction isolation.${colors.reset}`);
    }
    console.log(`${colors.magenta}==============================================${colors.reset}`);
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Always close the database connection
    await sql.end();
  }
}

main();