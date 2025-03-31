/**
 * Extract coverage information for redis-test-utils.js
 */
import fs from 'fs';

const coverageSummary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));

const targetFiles = [
  '/home/runner/workspace/utils/redis-test-utils.js',
  '/home/runner/workspace/services/redisService.js'
];

console.log('\n=== Coverage Summary ===\n');

for (const targetFile of targetFiles) {
  if (coverageSummary[targetFile]) {
    const fileData = coverageSummary[targetFile];
    const fileName = targetFile.split('/').pop();
    
    console.log(`File: ${fileName}`);
    console.log('-------------------');
    console.log(`Lines: ${fileData.lines.covered}/${fileData.lines.total} (${fileData.lines.pct}%)`);
    console.log(`Functions: ${fileData.functions.covered}/${fileData.functions.total} (${fileData.functions.pct}%)`);
    console.log(`Statements: ${fileData.statements.covered}/${fileData.statements.total} (${fileData.statements.pct}%)`);
    console.log(`Branches: ${fileData.branches.covered}/${fileData.branches.total} (${fileData.branches.pct}%)`);
    console.log('\n');
  } else {
    console.log(`No coverage data found for ${targetFile.split('/').pop()}`);
    console.log('\n');
  }
}

// Target coverage goal check
const targetFile = '/home/runner/workspace/utils/redis-test-utils.js';
if (coverageSummary[targetFile]) {
  const fileData = coverageSummary[targetFile];
  const targetCoverage = 80; // Target is 80%
  
  const linesCoverage = fileData.lines.pct;
  const functionsCoverage = fileData.functions.pct;
  
  console.log('=== Goal Analysis ===\n');
  
  if (linesCoverage >= targetCoverage) {
    console.log(`✅ Line coverage (${linesCoverage}%) meets the target of ${targetCoverage}%`);
  } else {
    console.log(`❌ Line coverage (${linesCoverage}%) is below the target of ${targetCoverage}%`);
  }
  
  if (functionsCoverage >= targetCoverage) {
    console.log(`✅ Function coverage (${functionsCoverage}%) meets the target of ${targetCoverage}%`);
  } else {
    console.log(`❌ Function coverage (${functionsCoverage}%) is below the target of ${targetCoverage}%`);
    
    // Calculate how many more functions need to be covered to reach the target
    const totalFunctions = fileData.functions.total;
    const coveredFunctions = fileData.functions.covered;
    const targetFunctions = Math.ceil(totalFunctions * (targetCoverage / 100));
    const neededFunctions = targetFunctions - coveredFunctions;
    
    console.log(`   Need to cover ${neededFunctions} more functions to reach ${targetCoverage}% coverage`);
  }
}