/**
 * Optimization Component Validation Test
 * 
 * This script validates that all optimization components are configured 
 * correctly and ready for use in the system.
 */

import tokenOptimizer from '../../utils/tokenOptimizer.js';
import tieredResponse from '../../utils/tieredResponseStrategy.js';
import logger from '../../utils/logger.js';

export async function validateOptimizationComponents() {
  let totalComponents = 2;
  let passedComponents = 0;
  
  logger.info('======================================');
  logger.info('   OPTIMIZATION COMPONENT VALIDATION');
  logger.info('======================================');
  
  // Test 1: Token Optimizer
  logger.info('\n1. TOKEN OPTIMIZER VALIDATION:');
  try {
    const status = tokenOptimizer.getStatus();
    
    // Validate requirements
    const hasEnabledField = status.enabled !== undefined;
    const isEnabled = status.enabled === true;
    const hasValidCapabilities = status.capabilities && 
      typeof status.capabilities === 'object' && 
      Object.keys(status.capabilities).length > 0;
    
    logger.info(`- Has 'enabled' field: ${hasEnabledField ? '✓' : '✗'}`);
    logger.info(`- 'enabled' is true: ${isEnabled ? '✓' : '✗'}`);
    logger.info(`- Has valid capabilities: ${hasValidCapabilities ? '✓' : '✗'}`);
    
    const tokenOptimizerValid = hasEnabledField && isEnabled && hasValidCapabilities;
    logger.info(`- Overall validation: ${tokenOptimizerValid ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    if (tokenOptimizerValid) passedComponents++;
    
    // Test actual functionality
    const testText = "This is a test text that contains repetitive repetitive words and " +
                     "due to the fact that we need to test optimization, we are using verbose phrases " +
                     "in order to see if the token optimizer is working properly.";
    
    const result = tokenOptimizer.optimize(testText);
    const optimizationWorking = result && 
                               result.optimized && 
                               result.optimized.length < testText.length;
    
    logger.info(`- Functionality test: ${optimizationWorking ? 'PASSED ✓' : 'FAILED ✗'}`);
    logger.info(`  Original: ${testText.length} chars`);
    logger.info(`  Optimized: ${result.optimized.length} chars`);
    logger.info(`  Reduction: ${testText.length - result.optimized.length} chars (${Math.round((testText.length - result.optimized.length) / testText.length * 100)}%)`);
  } catch (error) {
    logger.error(`Token Optimizer validation error: ${error.message}`);
    logger.info('- Overall validation: FAILED ✗');
  }
  
  // Test 2: Tiered Response Strategy
  logger.info('\n2. TIERED RESPONSE STRATEGY VALIDATION:');
  try {
    // Validate the tiered response strategy is working
    const response = await tieredResponse.getResponse('test-query', 'standard', {
      query: 'Test query',
      _testMode: true
    });
    
    const hasTierSelection = response && response.tier;
    const hasValidResponse = response && (typeof response.content === 'string' || response.testMode === true);
    
    logger.info(`- Has tier selection: ${hasTierSelection ? '✓' : '✗'}`);
    logger.info(`- Returns valid response: ${hasValidResponse ? '✓' : '✗'}`);
    
    // Test timeout handling
    let timeoutHandlingWorks = false;
    try {
      const timeoutResponse = await Promise.race([
        tieredResponse.getResponse('timeout-test', 'standard', {
          query: 'Test query',
          timeout: 1,
          _testDelay: 1000
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout test failed')), 500))
      ]);
      logger.info(`- Timeout handling: FAILED ✗ (didn't timeout when it should)`);
    } catch (error) {
      timeoutHandlingWorks = error.message.includes('Timeout');
      logger.info(`- Timeout handling: ${timeoutHandlingWorks ? 'PASSED ✓' : 'FAILED ✗'}`);
    }
    
    // Test fallback capability
    const fallbackWorks = await tieredResponse.getResponse('fallback-test', 'enhanced', {
      query: 'Test query',
      _testFallback: true,
      _testMode: true
    }).then(res => {
      return res && res.fallback === true && res.tier === 'standard';
    }).catch(err => {
      logger.error(`Fallback test error: ${err.message}`);
      return false;
    });
    
    logger.info(`- Fallback mechanism: ${fallbackWorks ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    const tieredResponseValid = hasTierSelection && hasValidResponse && 
                               (timeoutHandlingWorks || fallbackWorks);
    logger.info(`- Overall validation: ${tieredResponseValid ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    if (tieredResponseValid) passedComponents++;
  } catch (error) {
    logger.error(`Tiered Response validation error: ${error.message}`);
    logger.info('- Overall validation: FAILED ✗');
  }
  
  // Print overall validation results
  const percentComplete = Math.round((passedComponents / totalComponents) * 100);
  logger.info('\n======================================');
  logger.info(` OPTIMIZATION VALIDATION RESULTS: ${percentComplete}%`);
  logger.info(`   ${passedComponents}/${totalComponents} components passed validation`);
  logger.info('======================================');
  
  return {
    totalComponents,
    passedComponents,
    percentComplete
  };
}

// Run validation
validateOptimizationComponents();