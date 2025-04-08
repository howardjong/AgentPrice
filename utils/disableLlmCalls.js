
/**
 * disableLlmCalls.js
 * 
 * This module provides a flag to disable all LLM API calls globally.
 * This is useful for testing or situations where you want to work on the front-end
 * without running up costs from API calls.
 */

// Default configuration - can be controlled via environment variable
const disableLlmCalls = process.env.DISABLE_LLM_CALLS === 'true';

/**
 * Check if LLM calls are disabled
 * @returns {boolean} Whether LLM calls are disabled
 */
export function areLlmCallsDisabled() {
  return disableLlmCalls;
}

/**
 * Utility to conditionally disable/enable LLM calls
 * Primarily used for testing purposes
 */
export function toggleLlmCalls(disabled) {
  // This function only affects the local variable, not the environment variable
  return disabled;
}

// Default export for backward compatibility
export default disableLlmCalls;
