/**
 * LLM API Call Disable Utility
 * 
 * This module provides a way to globally disable LLM API calls to save costs
 * during development and testing.
 */

import logger from './logger.js';

// Default to disabled if environment variable is set
let llmApiCallsDisabled = process.env.DISABLE_LLM_API_CALLS === 'true';

/**
 * Check if LLM API calls are currently disabled
 * @returns {boolean} True if LLM API calls are disabled
 */
export function isLlmApiDisabled() {
  return llmApiCallsDisabled;
}

/**
 * Enable LLM API calls
 */
export function enableLlmApiCalls() {
  if (llmApiCallsDisabled) {
    logger.info('LLM API calls have been enabled');
    llmApiCallsDisabled = false;
  }
}

/**
 * Disable LLM API calls
 */
export function disableLlmApiCalls() {
  if (!llmApiCallsDisabled) {
    logger.info('LLM API calls have been disabled');
    llmApiCallsDisabled = true;
  }
}

/**
 * Toggle the current state of LLM API calls
 * @returns {boolean} The new state (true if disabled)
 */
export function toggleLlmApiCalls() {
  llmApiCallsDisabled = !llmApiCallsDisabled;
  logger.info(`LLM API calls have been ${llmApiCallsDisabled ? 'disabled' : 'enabled'}`);
  return llmApiCallsDisabled;
}