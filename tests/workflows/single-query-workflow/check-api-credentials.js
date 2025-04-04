#!/usr/bin/env node
/**
 * API Credentials Checker for Single Query Workflow Tests
 * 
 * This script validates that the required API credentials are available
 * without actually making any API calls. It's useful for verifying the
 * environment is properly configured for real API tests.
 */

// Import required modules
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if API credentials are properly configured
 */
async function checkApiCredentials() {
  console.log('Checking API credentials for single-query workflow tests...\n');
  
  const results = {
    anthropic: {
      available: false,
      keyLength: 0,
      keyPrefix: '',
      valid: false
    },
    perplexity: {
      available: false,
      keyLength: 0,
      keyPrefix: '',
      valid: false
    }
  };
  
  // Check Anthropic (Claude) API key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicApiKey) {
    results.anthropic.available = true;
    results.anthropic.keyLength = anthropicApiKey.length;
    results.anthropic.keyPrefix = anthropicApiKey.substring(0, 5) + '...';
    
    // Basic validation (Anthropic keys typically start with 'sk-ant-')
    results.anthropic.valid = anthropicApiKey.startsWith('sk-ant-');
  }
  
  // Check Perplexity API key
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  if (perplexityApiKey) {
    results.perplexity.available = true;
    results.perplexity.keyLength = perplexityApiKey.length;
    results.perplexity.keyPrefix = perplexityApiKey.substring(0, 5) + '...';
    
    // Basic validation (Perplexity keys are typically 32+ characters)
    results.perplexity.valid = perplexityApiKey.length >= 32;
  }
  
  // Display results
  console.log('Anthropic API Key (Claude):');
  console.log(`- Available: ${results.anthropic.available ? 'Yes' : 'No'}`);
  if (results.anthropic.available) {
    console.log(`- Key Length: ${results.anthropic.keyLength} characters`);
    console.log(`- Key Format: ${results.anthropic.valid ? 'Valid' : 'Invalid'} format`);
    console.log(`- Key Prefix: ${results.anthropic.keyPrefix}`);
  }
  
  console.log('\nPerplexity API Key:');
  console.log(`- Available: ${results.perplexity.available ? 'Yes' : 'No'}`);
  if (results.perplexity.available) {
    console.log(`- Key Length: ${results.perplexity.keyLength} characters`);
    console.log(`- Key Format: ${results.perplexity.valid ? 'Valid' : 'Invalid'} format`);
    console.log(`- Key Prefix: ${results.perplexity.keyPrefix}`);
  }
  
  // Overall conclusion
  const readyForRealApiTests = results.anthropic.available && results.perplexity.available && 
                             results.anthropic.valid && results.perplexity.valid;
  
  console.log('\nReady for real API tests?', readyForRealApiTests ? 'Yes' : 'No');
  
  if (!readyForRealApiTests) {
    console.log('\nMissing or invalid API keys:');
    if (!results.anthropic.available) {
      console.log('- ANTHROPIC_API_KEY is not set in the environment');
    } else if (!results.anthropic.valid) {
      console.log('- ANTHROPIC_API_KEY appears to have an invalid format (should start with "sk-ant-")');
    }
    
    if (!results.perplexity.available) {
      console.log('- PERPLEXITY_API_KEY is not set in the environment');
    } else if (!results.perplexity.valid) {
      console.log('- PERPLEXITY_API_KEY appears to have an invalid format');
    }
    
    console.log('\nTo configure API keys:');
    console.log('1. Add them to your .env file, or');
    console.log('2. Set them in Replit Secrets');
  }
  
  return readyForRealApiTests;
}

// Run the check if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await checkApiCredentials();
  process.exit(result ? 0 : 1);
}

export { checkApiCredentials };