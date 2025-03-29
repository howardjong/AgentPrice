/**
 * API Key Validation Utility
 * 
 * This script validates the API keys for both Anthropic and Perplexity services
 * by making a minimal test request to each API.
 */

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function validateAnthropicKey() {
  try {
    console.log('\n--- Validating Anthropic API Key ---');
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: ANTHROPIC_API_KEY is not set in environment variables');
      return false;
    }
    
    console.log('🔑 API Key found. Making test request...');
    
    const anthropic = new Anthropic({ apiKey });
    
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello, this is a test request. Please respond with a single short sentence.' }]
    });
    
    console.log('✅ Success! Claude API responded.');
    console.log(`📎 Model: ${response.model}`);
    console.log(`📎 Response: "${response.content[0].text.trim().substring(0, 50)}..."`);
    
    return true;
  } catch (error) {
    console.error('❌ Claude API Key validation failed:', error.message);
    return false;
  }
}

async function validatePerplexityKey() {
  try {
    console.log('\n--- Validating Perplexity API Key ---');
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: PERPLEXITY_API_KEY is not set in environment variables');
      return false;
    }
    
    console.log('🔑 API Key found. Making test request...');
    
    const response = await axios({
      method: 'post',
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Be precise and concise.' },
          { role: 'user', content: 'Hello, this is a test request. Please respond with a single short sentence.' }
        ],
        max_tokens: 100,
        temperature: 0.2
      },
      timeout: 15000
    });
    
    console.log('✅ Success! Perplexity API responded.');
    console.log(`📎 Model: ${response.data.model}`);
    console.log(`📎 Response: "${response.data.choices[0].message.content.trim().substring(0, 50)}..."`);
    
    return true;
  } catch (error) {
    console.error('❌ Perplexity API Key validation failed:', error.message);
    if (error.response) {
      console.error('API error details:', error.response.data);
    }
    return false;
  }
}

async function validateAllKeys() {
  console.log('=== API Key Validation Tool ===');
  console.log('Validating API keys for Anthropic and Perplexity services...');
  
  const claudeValid = await validateAnthropicKey();
  const perplexityValid = await validatePerplexityKey();
  
  console.log('\n=== Validation Summary ===');
  console.log(`Anthropic Claude API: ${claudeValid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`Perplexity API: ${perplexityValid ? '✅ Valid' : '❌ Invalid'}`);
  
  if (claudeValid && perplexityValid) {
    console.log('\n🎉 All API keys are valid! The system is ready to use.');
  } else {
    console.log('\n⚠️ Some API keys are invalid or missing. Please check your environment variables.');
  }
  
  return { claudeValid, perplexityValid };
}

// Run validation when this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateAllKeys()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Validation script error:', error);
      process.exit(1);
    });
}

export { validateAnthropicKey, validatePerplexityKey, validateAllKeys };