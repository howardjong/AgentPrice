
/**
 * disableLlmCalls.js
 * 
 * This module provides a flag to disable all LLM API calls globally.
 * This is useful for testing or situations where you want to work on the front-end
 * without running up costs from API calls.
 * 
 * Set to true to disable all LLM API calls
 * Set to false to allow LLM API calls normally
 */

const disableLlmCalls = false;

/**
 * Function to check if LLM API calls are disabled
 * @returns {boolean} True if LLM API calls are disabled, false otherwise
 */
export function areLlmCallsDisabled() {
  return disableLlmCalls;
}

export default disableLlmCalls;
