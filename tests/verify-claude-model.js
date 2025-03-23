/**
 * Claude Model Verification Test
 * 
 * This script checks which Claude model is actually being used by making a direct API call
 * and examining the response metadata.
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkClaudeModel() {
  try {
    console.log('Verifying Claude model...');
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set in environment variables');
      return;
    }
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // The model we're intending to use
    const requestedModel = 'claude-3-7-sonnet-20250219';
    console.log(`Requesting model: ${requestedModel}`);
    
    // Make a simple API call
    const response = await anthropic.messages.create({
      model: requestedModel,
      max_tokens: 300,
      system: "You are Claude, an AI assistant created by Anthropic. You are a specific Claude model with a specific version. Please identify yourself correctly and accurately.",
      messages: [
        {
          role: 'user',
          content: 'Please state exactly which Claude model and version you are, including your full model name as it would appear in API calls.'
        }
      ],
    });
    
    // Check the model used in the response
    console.log('API Response:');
    console.log('---------------');
    console.log(`Response model: ${response.model}`);
    console.log(`Response content: ${response.content[0].text}`);
    console.log('---------------');
    
    if (response.model === requestedModel) {
      console.log('✅ SUCCESS: The requested model matches the response model');
    } else {
      console.log(`⚠️ WARNING: Model mismatch! Requested "${requestedModel}" but got "${response.model}"`);
    }
    
    return {
      requestedModel,
      actualModel: response.model,
      content: response.content[0].text
    };
    
  } catch (error) {
    console.error('Error verifying Claude model:', error.message);
    if (error.response) {
      console.error('API error details:', error.response.data);
    }
    throw error;
  }
}

// Run the verification
checkClaudeModel()
  .then(result => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });