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
    console.log('Checking which Claude model is actually serving requests...');
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Error: ANTHROPIC_API_KEY is not set in environment variables');
      process.exit(1);
    }
    
    // The model we're requesting
    const requestedModel = "claude-3-7-sonnet-20250219";
    console.log(`Requesting model: ${requestedModel}`);
    
    // Make a simple request
    const response = await anthropic.messages.create({
      model: requestedModel,
      max_tokens: 300,
      messages: [
        { 
          role: 'user', 
          content: 'Please identify which Claude model you are. Reply with only the model name and nothing else.' 
        }
      ],
      system: "Return your model name at the end of your response inside double brackets like this: [[model-name]]"
    });
    
    console.log('\nResponse information:');
    console.log('-------------------');
    console.log(`API-reported model: ${response.model}`);
    
    // Try to extract model from content using regex
    const content = response.content[0].text;
    const modelMatch = content.match(/\[\[(.*?)\]\]/);
    
    if (modelMatch && modelMatch[1]) {
      const reportedModel = modelMatch[1].trim();
      console.log(`Self-reported model: ${reportedModel}`);
      
      if (reportedModel !== requestedModel) {
        console.log(`\n⚠️ WARNING: Self-reported model "${reportedModel}" differs from requested "${requestedModel}"`);
      }
    } else {
      console.log('No self-reported model found in response');
    }
    
    if (response.model !== requestedModel) {
      console.log(`\n⚠️ WARNING: Model mismatch! Requested "${requestedModel}" but got "${response.model}"`);
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

// Run the check
checkClaudeModel()
  .then(result => {
    console.log('\nModel verification completed');
    console.log('Response content:');
    console.log('-------------------');
    console.log(result.content);
    process.exit(0);
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });