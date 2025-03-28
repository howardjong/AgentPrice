/**
 * Test Token Optimizer Component
 */

import tokenOptimizer from '../../utils/tokenOptimizer.js';
import logger from '../../utils/logger.js';

export async function testTokenOptimizer() {
  logger.info('======================================');
  logger.info('     TESTING TOKEN OPTIMIZER');
  logger.info('======================================');
  
  // Check component status
  const status = tokenOptimizer.getStatus();
  logger.info('Token Optimizer Status:', status);
  
  // Validate the expected status fields
  logger.info(`\nValidation Results:`);
  logger.info(`- Has 'enabled' field: ${status.enabled !== undefined}`);
  logger.info(`- 'enabled' is true: ${status.enabled === true}`);
  
  // Test optimization functionality
  const testText = "This is a test text that contains repetitive repetitive words and " +
                  "due to the fact that we need to test optimization, we are using verbose phrases " +
                  "in order to see if the token optimizer is working properly.";
  
  const result = tokenOptimizer.optimize(testText);
  
  logger.info(`\nOptimization Results:`);
  logger.info(`- Original: "${testText}"`);
  logger.info(`- Optimized: "${result.optimized}"`);
  logger.info(`- Original Length: ${result.original.length} characters`);
  logger.info(`- Optimized Length: ${result.optimized.length} characters`);
  logger.info(`- Character Diff: ${result.original.length - result.optimized.length}`);
  
  logger.info('\n======================================');
  logger.info('     TOKEN OPTIMIZER TEST COMPLETE');
  logger.info('======================================');
}

// Run the test
testTokenOptimizer();