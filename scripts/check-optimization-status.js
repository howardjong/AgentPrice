/**
 * System Optimization Health Check
 * 
 * This script checks the status of all system optimization components
 * and reports a health score.
 */

import tokenOptimizer from '../utils/tokenOptimizer.js';
import tieredResponse from '../utils/tieredResponseStrategy.js';
import logger from '../utils/logger.js';

async function checkOptimizationStatus() {
  logger.info('======================================');
  logger.info(' SYSTEM OPTIMIZATION HEALTH CHECK');
  logger.info('======================================');
  
  const results = {
    components: {
      tokenOptimizer: { health: 0, status: 'Unknown' },
      tieredResponse: { health: 0, status: 'Unknown' }
    },
    totalHealth: 0
  };
  
  // Check token optimizer
  try {
    const tokenizerStatus = tokenOptimizer.getStatus();
    results.components.tokenOptimizer.status = tokenizerStatus.status;
    results.components.tokenOptimizer.enabled = tokenizerStatus.enabled;
    
    if (tokenizerStatus.enabled === true) {
      results.components.tokenOptimizer.health = 100;
      results.components.tokenOptimizer.status = 'HEALTHY';
      logger.info('✓ Token Optimizer: HEALTHY');
    } else {
      results.components.tokenOptimizer.health = 0;
      results.components.tokenOptimizer.status = 'ERROR: Not enabled';
      logger.info('✗ Token Optimizer: ERROR (Not enabled)');
    }
  } catch (error) {
    results.components.tokenOptimizer.status = `ERROR: ${error.message}`;
    logger.info(`✗ Token Optimizer: ERROR (${error.message})`);
  }
  
  // Check tiered response
  try {
    const tieredResponseStatus = tieredResponse.getStatus();
    results.components.tieredResponse.defaultTier = tieredResponseStatus.defaultTier;
    results.components.tieredResponse.enabled = tieredResponseStatus.enabled;
    
    if (tieredResponseStatus.enabled === true) {
      results.components.tieredResponse.health = 100;
      results.components.tieredResponse.status = 'HEALTHY';
      logger.info('✓ Tiered Response: HEALTHY');
    } else {
      results.components.tieredResponse.health = 0;
      results.components.tieredResponse.status = 'ERROR: Not enabled';
      logger.info('✗ Tiered Response: ERROR (Not enabled)');
    }
  } catch (error) {
    results.components.tieredResponse.status = `ERROR: ${error.message}`;
    logger.info(`✗ Tiered Response: ERROR (${error.message})`);
  }
  
  // Calculate overall health
  const componentHealths = Object.values(results.components).map(c => c.health);
  const totalHealth = componentHealths.reduce((sum, health) => sum + health, 0) / componentHealths.length;
  results.totalHealth = Math.round(totalHealth);
  
  // Output summary
  logger.info('\n======================================');
  logger.info(` OVERALL OPTIMIZATION HEALTH: ${results.totalHealth}%`);
  logger.info('======================================');
  
  return results;
}

// Run health check if executed directly
if (process.argv[1].includes('check-optimization-status.js')) {
  checkOptimizationStatus();
}

export default checkOptimizationStatus;