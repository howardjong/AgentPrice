/**
 * Script to check which items in the merge preparation plan have been completed and which are still pending
 */

import * as fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

async function checkMergePreparation() {
  console.log('===== MERGE PREPARATION STATUS CHECK =====\n');
  
  // Check search utilities coverage
  console.log('1. Verifying SearchUtils Coverage:');
  try {
    const searchUtilsCoverage = execSync('grep -A 1 "searchUtils\\.js" searchUtils-coverage.txt || echo "Not found"').toString();
    console.log(searchUtilsCoverage);
    
    // Extract coverage numbers
    const coverageMatch = searchUtilsCoverage.match(/searchUtils\.js\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)\s+\|\s+(\d+\.\d+)/);
    if (coverageMatch) {
      const [, statement, branch, func] = coverageMatch;
      console.log(`Statement Coverage: ${statement}% (Target: 80%)`);
      console.log(`Branch Coverage: ${branch}% (Target: 80%)`);
      console.log(`Function Coverage: ${func}% (Target: 80%)`);
      
      // Check against targets
      const statementCoverage = parseFloat(statement);
      const branchCoverage = parseFloat(branch);
      const funcCoverage = parseFloat(func);
      
      if (statementCoverage >= 80 && branchCoverage >= 80) {
        console.log('✅ SearchUtils meets coverage targets for statements and branches');
      } else {
        console.log('❌ SearchUtils does not meet coverage targets for statements and branches');
      }
      
      if (funcCoverage >= 80) {
        console.log('✅ SearchUtils meets coverage target for functions');
      } else {
        console.log('❌ SearchUtils does not meet coverage target for functions (currently at ' + funcCoverage + '%)');
        console.log('   Note: Function coverage is affected by not testing some private helper functions');
      }
    } else {
      console.log('❌ Could not parse coverage information');
    }
  } catch (error) {
    console.log('❌ Error checking SearchUtils coverage:', error.message);
  }
  
  // Check memory optimization settings
  console.log('\n2. Verifying Memory Optimization Settings:');
  try {
    const backupExists = await fileExists('./backups/optimization-settings.backup.json');
    if (backupExists) {
      console.log('✅ Backup of memory optimization settings found');
    } else {
      console.log('❌ Backup of memory optimization settings not found');
    }
    
    const settingsExist = await fileExists('./data/optimization-settings.json');
    if (settingsExist) {
      const settings = JSON.parse(await fs.readFile('./data/optimization-settings.json', 'utf8'));
      
      console.log('Current memory optimization settings:');
      console.log(`- Low Memory Mode: ${settings.memory.lowMemoryMode}`);
      console.log(`- Aggressive GC Enabled: ${settings.memory.aggressiveGcEnabled}`);
      console.log(`- GC Interval: ${settings.memory.gcInterval}ms`);
      console.log(`- Max Cache Size: ${settings.memory.maxCacheSize}`);
      console.log(`- Fuzzy Match Enabled: ${settings.memory.enableFuzzyMatch}`);
      
      if (settings.memory.lowMemoryMode === true && 
          settings.memory.aggressiveGcEnabled === true && 
          settings.memory.gcInterval <= 60000 && 
          settings.memory.maxCacheSize <= 100 && 
          settings.memory.enableFuzzyMatch === false) {
        console.log('✅ Memory optimization settings are properly configured for merge');
      } else {
        console.log('❌ Memory optimization settings are not fully optimized for merge');
      }
    } else {
      console.log('❌ Memory optimization settings file not found');
    }
  } catch (error) {
    console.log('❌ Error checking memory optimization settings:', error.message);
  }
  
  // Check Socket.IO cleanup patterns
  console.log('\n3. Verifying Socket.IO Cleanup Patterns:');
  try {
    // Just a basic check to see if removeAllListeners is used in the Socket.IO tests
    const socketIOCleanupCount = parseInt(execSync('grep -r "removeAllListeners" ./tests/ | wc -l').toString());
    if (socketIOCleanupCount > 0) {
      console.log(`✅ Found ${socketIOCleanupCount} instances of removeAllListeners() in tests`);
    } else {
      console.log('❌ No removeAllListeners() calls found in Socket.IO tests');
    }
  } catch (error) {
    console.log('❌ Error checking Socket.IO cleanup patterns:', error.message);
  }
  
  // Check database test safeguards
  console.log('\n4. Verifying Database Test Safeguards:');
  try {
    const transactionIsolationChecks = parseInt(execSync('grep -r "transaction isolation" ./tests/ | wc -l').toString());
    if (transactionIsolationChecks > 0) {
      console.log(`✅ Found ${transactionIsolationChecks} references to transaction isolation in tests`);
    } else {
      console.log('❌ No references to transaction isolation found in database tests');
    }
    
    // Check for destructive operations
    const destructiveOps = execSync('grep -r "DROP TABLE\\|DELETE FROM\\|TRUNCATE" ./tests/ || echo "None found"').toString();
    if (destructiveOps.includes('None found')) {
      console.log('✅ No destructive database operations found in tests');
    } else {
      console.log('❌ Potentially destructive database operations found in tests:');
      console.log(destructiveOps);
    }
  } catch (error) {
    console.log('❌ Error checking database test safeguards:', error.message);
  }
  
  // Check merge preparation tasks in the plan
  console.log('\n5. Checking Merge Preparation Tasks:');
  try {
    const mergePreparationPlan = await fs.readFile('./tests/docs/migration/MERGE_PREPARATION_PLAN.md', 'utf8');
    
    // Count completed tasks
    const completedTaskCount = (mergePreparationPlan.match(/- \[x\]/g) || []).length;
    // Count pending tasks
    const pendingTaskCount = (mergePreparationPlan.match(/- \[ \]/g) || []).length;
    
    console.log(`Completed Tasks: ${completedTaskCount}`);
    console.log(`Pending Tasks: ${pendingTaskCount}`);
    
    // Check key merge steps
    const mergeSectionMatch = mergePreparationPlan.match(/### Merge Process([\s\S]*?)##/);
    if (mergeSectionMatch) {
      const mergeSection = mergeSectionMatch[1];
      const pendingMergeTasks = (mergeSection.match(/- \[ \]/g) || []).length;
      
      if (pendingMergeTasks > 0) {
        console.log(`❌ ${pendingMergeTasks} pending tasks in the Merge Process section`);
      } else {
        console.log('✅ All tasks in the Merge Process section are complete');
      }
    }
    
    // Check if we're on track for merging
    if (pendingTaskCount === 0) {
      console.log('✅ All merge preparation tasks are complete and ready for final merge!');
    } else if (pendingTaskCount <= 10) {
      console.log('⚠️ Close to completion with only ' + pendingTaskCount + ' tasks remaining');
    } else {
      console.log('❌ Significant number of tasks (' + pendingTaskCount + ') still pending before merge');
    }
    
    // Scan for any performance testing timeouts
    if (mergePreparationPlan.includes('timeout')) {
      console.log('⚠️ References to timeouts found in the merge plan - verify these are addressed');
    }
  } catch (error) {
    console.log('❌ Error checking merge preparation tasks:', error.message);
  }
  
  console.log('\n===== END OF MERGE PREPARATION STATUS CHECK =====');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

checkMergePreparation();