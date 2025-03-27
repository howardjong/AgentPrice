/**
 * Utility to disable LLM API calls to save costs
 * This file provides helper functions to disable or control LLM API calls
 */

import logger from './logger.js';

// Set to true by default to save costs unless explicitly enabled
const LLM_CALLS_DISABLED = process.env.ENABLE_LLM_CALLS !== 'true';

/**
 * Check if LLM API calls are disabled
 * @returns {boolean} True if LLM calls are disabled
 */
export function areLlmCallsDisabled() {
  //Added check for DISABLE_LLM_CALLS and DISABLE_LLM_API environment variables.
  return LLM_CALLS_DISABLED || process.env.DISABLE_LLM_CALLS === 'true' || process.env.DISABLE_LLM_API === 'true';
}

/**
 * Log the LLM call status on startup
 */
function logLlmCallStatus() {
  if (areLlmCallsDisabled()) {
    logger.info('LLM API calls are disabled to save costs', {
      service: 'multi-llm-research',
      component: 'apiOptimization'
    });
  } else {
    logger.warn('LLM API calls are enabled - costs may be incurred', {
      service: 'multi-llm-research',
      component: 'apiOptimization'
    });
  }
}

// Log status on module load
logLlmCallStatus();

export default {
  areLlmCallsDisabled,
  LLM_CALLS_DISABLED
};