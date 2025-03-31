#!/usr/bin/env node

/**
 * Test Coverage Script
 * 
 * This script runs all Vitest tests with coverage reporting and generates a detailed
 * report on test coverage metrics including branches, functions, lines, and statements.
 */

import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

const MIN_COVERAGE = {
  branches: 80,
  functions: 80,
  lines: 80,
  statements: 80
};

async function runTestsWithCoverage() {
  logger.info('Running all tests with coverage reporting...');
  
  try {
    // Run vitest with coverage enabled
    await execa('npx', [
      'vitest', 'run', 
      '--coverage',
      '--reporter', 'verbose'
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });
    
    logger.info('Tests completed. Analyzing coverage report...');
    
    // Try to read the coverage summary
    try {
      const coverageSummaryPath = path.resolve('./reports/coverage/coverage-summary.json');
      const coverageData = JSON.parse(await fs.readFile(coverageSummaryPath, 'utf8'));
      
      const total = coverageData.total;
      
      // Log the coverage metrics
      logger.info('Coverage Summary:');
      console.log('-----------------------------');
      console.log(`Branches:   ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})`);
      console.log(`Functions:  ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})`);
      console.log(`Lines:      ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total})`);
      console.log(`Statements: ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})`);
      console.log('-----------------------------');
      
      // Check if coverage meets requirements
      const passedChecks = [];
      const failedChecks = [];
      
      if (total.branches.pct >= MIN_COVERAGE.branches) {
        passedChecks.push(`✅ Branches: ${total.branches.pct.toFixed(2)}% (target: ${MIN_COVERAGE.branches}%)`);
      } else {
        failedChecks.push(`❌ Branches: ${total.branches.pct.toFixed(2)}% (target: ${MIN_COVERAGE.branches}%)`);
      }
      
      if (total.functions.pct >= MIN_COVERAGE.functions) {
        passedChecks.push(`✅ Functions: ${total.functions.pct.toFixed(2)}% (target: ${MIN_COVERAGE.functions}%)`);
      } else {
        failedChecks.push(`❌ Functions: ${total.functions.pct.toFixed(2)}% (target: ${MIN_COVERAGE.functions}%)`);
      }
      
      if (total.lines.pct >= MIN_COVERAGE.lines) {
        passedChecks.push(`✅ Lines: ${total.lines.pct.toFixed(2)}% (target: ${MIN_COVERAGE.lines}%)`);
      } else {
        failedChecks.push(`❌ Lines: ${total.lines.pct.toFixed(2)}% (target: ${MIN_COVERAGE.lines}%)`);
      }
      
      if (total.statements.pct >= MIN_COVERAGE.statements) {
        passedChecks.push(`✅ Statements: ${total.statements.pct.toFixed(2)}% (target: ${MIN_COVERAGE.statements}%)`);
      } else {
        failedChecks.push(`❌ Statements: ${total.statements.pct.toFixed(2)}% (target: ${MIN_COVERAGE.statements}%)`);
      }
      
      // Print results
      console.log('\nCoverage Requirements Check:');
      for (const check of passedChecks) {
        console.log(check);
      }
      for (const check of failedChecks) {
        console.log(check);
      }
      
      // Calculate detailed coverage per directory
      console.log('\nDetailed Coverage by Directory:');
      console.log('-----------------------------');
      
      const directories = {};
      
      // Process each file to create directory summaries
      for (const [filePath, fileStats] of Object.entries(coverageData)) {
        if (filePath === 'total') continue;
        
        // Skip node_modules files
        if (filePath.includes('node_modules')) continue;
        
        // Get directory path
        const dirPath = path.dirname(filePath);
        if (!directories[dirPath]) {
          directories[dirPath] = {
            files: 0,
            branches: { total: 0, covered: 0 },
            functions: { total: 0, covered: 0 },
            lines: { total: 0, covered: 0 },
            statements: { total: 0, covered: 0 }
          };
        }
        
        directories[dirPath].files++;
        directories[dirPath].branches.total += fileStats.branches.total;
        directories[dirPath].branches.covered += fileStats.branches.covered;
        directories[dirPath].functions.total += fileStats.functions.total;
        directories[dirPath].functions.covered += fileStats.functions.covered;
        directories[dirPath].lines.total += fileStats.lines.total;
        directories[dirPath].lines.covered += fileStats.lines.covered;
        directories[dirPath].statements.total += fileStats.statements.total;
        directories[dirPath].statements.covered += fileStats.statements.covered;
      }
      
      // Calculate percentages and display directory summaries
      for (const [dirPath, stats] of Object.entries(directories).sort()) {
        const branchPct = stats.branches.total ? (stats.branches.covered / stats.branches.total * 100) : 0;
        const functionPct = stats.functions.total ? (stats.functions.covered / stats.functions.total * 100) : 0;
        const linePct = stats.lines.total ? (stats.lines.covered / stats.lines.total * 100) : 0;
        const statementPct = stats.statements.total ? (stats.statements.covered / stats.statements.total * 100) : 0;
        
        const averagePct = (branchPct + functionPct + linePct + statementPct) / 4;
        
        console.log(`${dirPath} (${stats.files} files, avg ${averagePct.toFixed(2)}%):`);
        console.log(`  Branches:   ${branchPct.toFixed(2)}% (${stats.branches.covered}/${stats.branches.total})`);
        console.log(`  Functions:  ${functionPct.toFixed(2)}% (${stats.functions.covered}/${stats.functions.total})`);
        console.log(`  Lines:      ${linePct.toFixed(2)}% (${stats.lines.covered}/${stats.lines.total})`);
        console.log(`  Statements: ${statementPct.toFixed(2)}% (${stats.statements.covered}/${stats.statements.total})`);
        console.log('');
      }
      
      // Identify files with low coverage
      console.log('\nFiles with Low Coverage (<60%):');
      console.log('-----------------------------');
      
      let lowCoverageFiles = 0;
      for (const [filePath, fileStats] of Object.entries(coverageData)) {
        if (filePath === 'total') continue;
        if (filePath.includes('node_modules')) continue;
        
        const branchPct = fileStats.branches.total ? (fileStats.branches.covered / fileStats.branches.total * 100) : 0;
        const functionPct = fileStats.functions.total ? (fileStats.functions.covered / fileStats.functions.total * 100) : 0;
        const linePct = fileStats.lines.total ? (fileStats.lines.covered / fileStats.lines.total * 100) : 0;
        const statementPct = fileStats.statements.total ? (fileStats.statements.covered / fileStats.statements.total * 100) : 0;
        
        const avgPct = (branchPct + functionPct + linePct + statementPct) / 4;
        
        if (avgPct < 60) {
          lowCoverageFiles++;
          console.log(`${filePath} (avg ${avgPct.toFixed(2)}%):`);
          console.log(`  Branches:   ${branchPct.toFixed(2)}% (${fileStats.branches.covered}/${fileStats.branches.total})`);
          console.log(`  Functions:  ${functionPct.toFixed(2)}% (${fileStats.functions.covered}/${fileStats.functions.total})`);
          console.log(`  Lines:      ${linePct.toFixed(2)}% (${fileStats.lines.covered}/${fileStats.lines.total})`);
          console.log(`  Statements: ${statementPct.toFixed(2)}% (${fileStats.statements.covered}/${fileStats.statements.total})`);
          console.log('');
        }
      }
      
      if (lowCoverageFiles === 0) {
        console.log('No files found with coverage below 60%.');
      }
      
      // Get report files
      const htmlReportPath = path.resolve('./reports/coverage/index.html');
      const jsonReportPath = path.resolve('./reports/coverage/coverage-final.json');
      
      console.log('\nDetailed Reports:');
      console.log(`HTML Report: ${htmlReportPath}`);
      console.log(`JSON Report: ${jsonReportPath}`);
      
      // Provide next steps
      console.log('\nNext Steps:');
      if (failedChecks.length > 0) {
        console.log('1. Improve test coverage for the following:');
        for (const check of failedChecks) {
          console.log(`   - ${check.replace('❌ ', '')}`);
        }
        console.log('2. Focus on files with low coverage listed above');
      } else {
        console.log('✅ All coverage requirements are met!');
      }
      
    } catch (readError) {
      logger.error(`Failed to read coverage report: ${readError.message}`);
      console.error('Make sure tests ran successfully and generated coverage reports.');
    }
    
  } catch (testError) {
    logger.error(`Failed to run tests: ${testError.message}`);
    console.error('Check error output for details on test failures.');
  }
}

// Run the script
runTestsWithCoverage();