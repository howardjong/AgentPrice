/**
 * Perplexity API Polling Utility
 * 
 * This module provides functions for handling Perplexity's asynchronous API responses,
 * specifically for the deep research model which requires polling for results.
 */

/**
 * Poll for Perplexity deep research results
 * @param {string} taskId - The task ID returned by the initial API call
 * @param {string} apiKey - The Perplexity API key
 * @param {object} options - Polling options
 * @param {number} options.maxAttempts - Maximum number of polling attempts (default: 20)
 * @param {number} options.initialDelayMs - Initial delay before first poll in ms (default: 2000)
 * @param {number} options.maxDelayMs - Maximum delay between polls in ms (default: 10000)
 * @param {number} options.backoffFactor - Exponential backoff multiplier (default: 1.5)
 * @returns {Promise<object>} The research results
 */
export async function pollForResults(taskId, apiKey, options = {}) {
  // Default polling options
  const config = {
    maxAttempts: options.maxAttempts || 20,
    initialDelayMs: options.initialDelayMs || 2000,
    maxDelayMs: options.maxDelayMs || 10000,
    backoffFactor: options.backoffFactor || 1.5
  };
  
  // Initial delay
  await sleep(config.initialDelayMs);
  
  // Polling loop
  let currentDelay = config.initialDelayMs;
  let attempt = 1;
  
  while (attempt <= config.maxAttempts) {
    try {
      console.log(`Polling for Perplexity results (attempt ${attempt}/${config.maxAttempts})...`);
      
      // Make API request to check task status
      const statusUrl = `https://api.perplexity.ai/research/task/${taskId}`;
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Handle API errors
        if (response.status === 429) {
          console.warn('Rate limit exceeded. Extending backoff...');
          currentDelay = Math.min(currentDelay * 2, config.maxDelayMs * 2);
          await sleep(currentDelay);
          attempt++;
          continue;
        }
        
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if the task is complete
      if (data.status === 'completed') {
        console.log('Research task completed.');
        return {
          answer: data.answer,
          sources: data.sources || [],
          model: data.model || 'sonar-deep-research'
        };
      } else if (data.status === 'failed') {
        throw new Error(`Research task failed: ${data.error || 'Unknown error'}`);
      } else if (data.status === 'processing') {
        // Task still processing, continue polling
        console.log('Research task still processing...');
      } else {
        console.warn(`Unexpected task status: ${data.status}`);
      }
      
      // Increase delay with backoff
      currentDelay = Math.min(currentDelay * config.backoffFactor, config.maxDelayMs);
      await sleep(currentDelay);
      attempt++;
      
    } catch (error) {
      console.error('Error polling for research results:', error);
      
      // Decide whether to retry based on the error
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        console.log('Rate limit error, applying extended backoff...');
        await sleep(Math.min(currentDelay * 3, 30000)); // Longer backoff for rate limits
      } else {
        // For other errors, use standard backoff
        await sleep(currentDelay);
      }
      
      attempt++;
    }
  }
  
  throw new Error(`Polling timed out after ${config.maxAttempts} attempts`);
}

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} A promise that resolves after the specified time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a rate-limited fetch function to respect Perplexity's rate limits
 * @param {number} requestsPerMinute - Maximum requests per minute (default: 5)
 * @returns {Function} A rate-limited fetch function
 */
export function createRateLimitedFetch(requestsPerMinute = 5) {
  const intervalMs = 60000 / requestsPerMinute;
  let lastRequestTime = 0;
  
  return async function rateLimitedFetch(url, options) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < intervalMs) {
      const waitTime = intervalMs - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
      await sleep(waitTime);
    }
    
    lastRequestTime = Date.now();
    return fetch(url, options);
  };
}

/**
 * Generate a random exponential backoff delay
 * @param {number} attempt - The current attempt number (1-based)
 * @param {number} baseMs - Base delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
export function exponentialBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
  const delay = Math.min(baseMs * Math.pow(2, attempt - 1) * jitter, maxMs);
  return Math.floor(delay);
}