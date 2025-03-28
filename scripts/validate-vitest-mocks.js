/**
 * Vitest Mock Validation Script
 * 
 * This script scans Vitest files to identify common mocking issues and 
 * provides suggestions for fixing them. It helps ensure consistent mocking
 * patterns across the test suite.
 */

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Key patterns to check for in Vitest files
const PATTERNS = {
  IMPORT_AFTER_MOCK: {
    pattern: /vi\.mock\(['"](.+?)['"]\).*?\nimport .+ from ['"](\1)['"]/gs,
    message: "Import should appear BEFORE mock declaration"
  },
  DIRECT_MOCK_ACCESS: {
    pattern: /(?<!['"])(\w+)\.(\w+)\.mockImplementation/g, 
    message: "Direct mock access without importing the module first"
  },
  MISSING_RESET: {
    pattern: /describe\([^]*?\n(?!.*afterEach\([^]*?clearAllMocks[^]*?\))/g,
    message: "Test suite might be missing vi.clearAllMocks() in afterEach hook"
  },
  SHADOWED_VARIABLES: {
    pattern: /import (\w+)[^]*?let \1/g,
    message: "Variable shadowing detected - same name used for import and local variable"
  },
  INCORRECT_MOCK_RETURN: {
    pattern: /vi\.mock\([^]*?=>\s*{[^]*?return\s+[^{][^]*?}\)/g,
    message: "Mock factory should return an object, not a value"
  }
};

// List of known test files to scan
async function findVitestFiles() {
  const { stdout } = await exec('find . -name "*.vitest.js" -not -path "./node_modules/*"');
  return stdout.trim().split('\n').filter(Boolean);
}

async function validateFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];

    // Check each pattern
    for (const [name, { pattern, message }] of Object.entries(PATTERNS)) {
      let match;
      let foundIssue = false;
      pattern.lastIndex = 0;  // Reset regex state
      
      while ((match = pattern.exec(content)) !== null) {
        if (!foundIssue) {
          issues.push({ name, message, matches: [] });
          foundIssue = true;
        }
        issues[issues.length - 1].matches.push(match[0].substring(0, 60) + "...");
      }
    }

    return { filePath, issues };
  } catch (error) {
    return { filePath, error: error.message };
  }
}

async function main() {
  try {
    const testFiles = await findVitestFiles();
    console.log(`Found ${testFiles.length} Vitest files to validate`);
    
    const results = await Promise.all(testFiles.map(validateFile));
    
    let issueCount = 0;
    let filesWithIssues = 0;
    
    // Report results
    console.log("\n====== VITEST MOCK VALIDATION REPORT ======\n");
    
    for (const result of results) {
      if (result.error) {
        console.log(`❌ Error processing ${result.filePath}: ${result.error}`);
        continue;
      }
      
      if (result.issues.length > 0) {
        filesWithIssues++;
        console.log(`\n📄 ${result.filePath}:`);
        
        for (const issue of result.issues) {
          issueCount++;
          console.log(`  ⚠️  ${issue.name}: ${issue.message}`);
          if (issue.matches.length <= 3) {
            issue.matches.forEach(match => {
              console.log(`    • ${match}`);
            });
          } else {
            console.log(`    • ${issue.matches.length} instances found`);
          }
        }
      }
    }
    
    console.log("\n====== SUMMARY ======");
    console.log(`Total files scanned: ${testFiles.length}`);
    console.log(`Files with issues: ${filesWithIssues}`);
    console.log(`Total issues found: ${issueCount}`);
    
    if (issueCount === 0) {
      console.log("\n✅ All Vitest files have correct mocking patterns!");
    } else {
      console.log("\n⚠️  Some issues were found in the Vitest files. Please fix them to ensure consistent testing.");
    }
    
  } catch (error) {
    console.error("Error running validation:", error);
    process.exit(1);
  }
}

main();