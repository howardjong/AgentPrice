
/**
 * Utility to check if LLM API calls should be disabled
 * Used for development/testing to prevent unwanted API calls
 */

const isLlmApiDisabled = () => {
  return process.env.DISABLE_LLM_API_CALLS === 'true';
};

export { isLlmApiDisabled };
