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

/**
 * Enhanced Claude model verification that examines the complete API response
 * and provides detailed diagnostic information
 */
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
    
    // Detailed response inspection
    console.log('\nComplete API Response Details:');
    console.log('============================');
    console.log('Request ID:', response.id);
    console.log('API-reported model:', response.model);
    console.log('Response type:', response.type);
    console.log('Stop reason:', response.stop_reason);
    console.log('Usage tokens:', JSON.stringify(response.usage, null, 2));
    
    // For debugging - print all available response fields
    console.log('\nAll Response Fields:');
    console.log('------------------');
    const allResponseFields = Object.keys(response);
    console.log(allResponseFields.join(', '));
    
    // Extract model info from the response
    const content = response.content[0].text;
    
    console.log('\nModel Identification Check:');
    console.log('-------------------------');
    
    // Try to extract model from content using regex
    const modelMatch = content.match(/\[\[(.*?)\]\]/);
    
    if (modelMatch && modelMatch[1]) {
      const reportedModel = modelMatch[1].trim();
      console.log(`Self-reported model: ${reportedModel}`);
      
      // Create clean base names for comparison (without version numbers)
      const requestedModelBase = requestedModel.split('-20')[0];
      const reportedModelBase = reportedModel.split('-20')[0];
      
      if (reportedModelBase !== requestedModelBase) {
        console.log(`\n📝 MODEL IDENTIFICATION NOTE: Self-reported model differs from requested model:`);
        console.log(`  - Requested: ${requestedModel} (${requestedModelBase})`);
        console.log(`  - Self-reported: ${reportedModel} (${reportedModelBase})`);
        console.log(`  - API metadata reports: ${response.model}`);
        
        // Check if API metadata matches requested model
        if (response.model === requestedModel) {
          console.log(`  ✅ API METADATA MATCH: API reports correct requested model, which is the source of truth`);
        } else {
          console.log(`  ⚠️ API METADATA MISMATCH: API reports ${response.model} instead of ${requestedModel}`);
        }
      } else if (reportedModel !== requestedModel) {
        console.log(`\n📝 VERSION DIFFERENCE: Same model family but different version:`);
        console.log(`  - Requested: ${requestedModel}`);
        console.log(`  - Self-reported: ${reportedModel}`);
        console.log(`  - API metadata reports: ${response.model}`);
      } else {
        console.log(`✅ MATCH! Requested and received the same model: ${requestedModel}`);
      }
    } else {
      console.log('⚠️ No self-reported model found in response');
    }
    
    if (response.model !== requestedModel) {
      console.log(`\n⚠️ API METADATA MISMATCH! API response indicates:`);
      console.log(`  - Requested: ${requestedModel}`);
      console.log(`  - API reports: ${response.model}`);
    }
    
    return {
      requestedModel,
      actualModel: response.model,
      content: response.content[0].text,
      selfReportedModel: modelMatch && modelMatch[1] ? modelMatch[1].trim() : null,
      fullResponse: response
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