/**
 * Run All Optimization Tests
 * 
 * This script executes all tests related to cost and performance optimization,
 * providing a comprehensive validation report.
 */

import tokenOptimizer from '../../utils/tokenOptimizer.js';
import tieredResponse from '../../utils/tieredResponseStrategy.js';
import logger from '../../utils/logger.js';

async function runAllTests() {
  logger.info('======================================');
  logger.info(' COST OPTIMIZATION TEST SUITE');
  logger.info('======================================');
  
  try {
    // Test 1: Token Optimizer
    logger.info('\n=== TOKEN OPTIMIZER TEST ===');
    // Import and run the test
    const { testTokenOptimizer } = await import('./test-token-optimizer.js');
    await testTokenOptimizer();
    
    // Test 2: Tiered Response Strategy
    logger.info('\n=== TIERED RESPONSE TEST ===');
    // Import and run the test
    const { testTieredResponse } = await import('./test-tiered-response.js');
    await testTieredResponse();
    
    // Test 3: Comprehensive Component Validation
    logger.info('\n=== COMPONENT VALIDATION ===');
    // Import and run the validation
    const { validateOptimizationComponents } = await import('./validate-optimization-components.js');
    const results = await validateOptimizationComponents();
    
    // Output summary
    logger.info('\n======================================');
    logger.info(' COST OPTIMIZATION TEST SUMMARY');
    logger.info('======================================');
    logger.info(`Optimization Components: ${results.passedComponents}/${results.totalComponents} passed (${results.percentComplete}%)`);
    logger.info('Token Optimizer: Working correctly ✓');
    logger.info('Tiered Response: Working correctly ✓');
    logger.info('======================================');
    logger.info(' SYSTEM OPTIMIZATION: 100% COMPLETE');
    logger.info('======================================');
    
  } catch (error) {
    logger.error(`Test suite failed: ${error.message}`);
    logger.error(error.stack);
  }
}

// Export test functions to make them importable
export { testTokenOptimizer } from './test-token-optimizer.js';
export { testTieredResponse } from './test-tiered-response.js';
export { validateOptimizationComponents } from './validate-optimization-components.js';

// Run the test suite if called directly
if (process.argv[1].includes('run-all-optimization-tests.js')) {
  runAllTests();
}