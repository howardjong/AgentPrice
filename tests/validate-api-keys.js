/**
 * API Key Validation Utility
 * 
 * This script validates the API keys for both Anthropic and Perplexity services
 * by making a minimal test request to each API.
 */
import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

// Load environment variables
dotenv.config();

console.log('\n===== API KEY VALIDATOR =====\n');

// Helper function to validate Anthropic API key
async function validateAnthropicKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is not defined in environment variables');
    return false;
  }
  
  console.log(`Anthropic API key length: ${apiKey.length} characters`);
  console.log(`Key starts with: ${apiKey.substring(0, 4)}...`);
  
  try {
    // Make a minimal request to Anthropic's API
    const response = await axios({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      data: {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Just reply with the word "valid" and nothing else.' }
        ]
      }
    });
    
    console.log('✅ ANTHROPIC API KEY IS VALID!');
    console.log(`Response status: ${response.status}`);
    console.log(`Response data: ${JSON.stringify(response.data.content).substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error('❌ ANTHROPIC API KEY IS INVALID!');
    console.error(`Error: ${error.message}`);
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

// Helper function to validate Perplexity API key
async function validatePerplexityKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error('❌ PERPLEXITY_API_KEY is not defined in environment variables');
    return false;
  }
  
  console.log(`Perplexity API key length: ${apiKey.length} characters`);
  console.log(`Key starts with: ${apiKey.substring(0, 4)}...`);
  
  try {
    // Make a minimal request to Perplexity's API
    const response = await axios({
      method: 'POST',
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Just reply with the word "valid" and nothing else.' }
        ],
        max_tokens: 10
      }
    });
    
    console.log('✅ PERPLEXITY API KEY IS VALID!');
    console.log(`Response status: ${response.status}`);
    console.log(`Response data: ${JSON.stringify(response.data).substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error('❌ PERPLEXITY API KEY IS INVALID!');
    console.error(`Error: ${error.message}`);
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

// Run the validation checks
async function validateAllKeys() {
  console.log('Testing Anthropic API key...');
  const anthropicValid = await validateAnthropicKey();
  
  console.log('\nTesting Perplexity API key...');
  const perplexityValid = await validatePerplexityKey();
  
  console.log('\n===== VALIDATION SUMMARY =====');
  console.log(`Anthropic API Key: ${anthropicValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`Perplexity API Key: ${perplexityValid ? '✅ VALID' : '❌ INVALID'}`);
  
  return anthropicValid && perplexityValid;
}

// Run the validation function
validateAllKeys()
  .then(allValid => {
    if (allValid) {
      console.log('\n✅ All API keys are valid!');
    } else {
      console.error('\n❌ Some API keys are invalid or missing!');
      console.log('Please update the invalid keys in your Replit secrets.');
    }
    process.exit(allValid ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error during validation:', error);
    process.exit(1);
  });