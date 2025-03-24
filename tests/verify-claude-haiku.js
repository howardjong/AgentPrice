
/**
 * Claude Haiku Model Verification Test
 * 
 * This script specifically tests whether the claude-3-5-haiku-20241022 model
 * returns what it claims to be, by making a direct API call and examining
 * the response metadata and self-identification.
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Verify Claude Haiku model identity
 */
async function verifyClaudeHaikuModel() {
  try {
    console.log('===== Claude Haiku Model Verification Test =====');
    console.log('Checking what model is actually returned when requesting claude-3-5-haiku-20241022\n');
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Error: ANTHROPIC_API_KEY is not set in environment variables');
      process.exit(1);
    }
    
    // The model we're specifically testing
    const requestedModel = "claude-3-5-haiku-20241022";
    console.log(`Requesting model: ${requestedModel}`);
    
    // Make a direct request with a strong prompt for self-identification
    const response = await anthropic.messages.create({
      model: requestedModel,
      max_tokens: 300,
      messages: [
        { 
          role: 'user', 
          content: 'What is your exact model name and version? Please identify yourself completely and accurately. Include your full model identifier if possible.' 
        }
      ],
      system: "You are an AI assistant created by Anthropic. You MUST identify yourself accurately and transparently. Return your EXACT model name and version at the end of your response inside double brackets like this: [[model-name]]"
    });
    
    // Detailed response inspection
    console.log('\nAPI Response Details:');
    console.log('====================');
    console.log('API-reported model:', response.model);
    console.log('Response type:', response.type);
    console.log('Usage tokens:', JSON.stringify(response.usage, null, 2));
    
    // Extract model info from the response
    const content = response.content[0].text;
    console.log('\nResponse Content:');
    console.log('-----------------');
    console.log(content);
    
    // Try to extract model from content using regex
    const modelMatch = content.match(/\[\[(.*?)\]\]/);
    
    console.log('\nModel Identity Analysis:');
    console.log('----------------------');
    
    if (modelMatch && modelMatch[1]) {
      const reportedModel = modelMatch[1].trim();
      console.log(`Self-reported model identity: ${reportedModel}`);
      
      // Compare with requested model
      if (reportedModel !== requestedModel) {
        console.log(`\n⚠️ MODEL MISMATCH! The model self-identifies differently than requested:`);
        console.log(`  - Requested: ${requestedModel}`);
        console.log(`  - Actual (self-reported): ${reportedModel}`);
      } else {
        console.log(`✅ MATCH! Requested and received the same model: ${requestedModel}`);
      }
    } else {
      console.log('⚠️ No self-reported model identifier found in brackets');
      
      // Look for clues in the general response
      if (content.toLowerCase().includes('haiku')) {
        console.log('  Model mentions "Haiku" in its response');
      } else if (content.toLowerCase().includes('sonnet')) {
        console.log('  Model mentions "Sonnet" in its response');
      } else if (content.toLowerCase().includes('opus')) {
        console.log('  Model mentions "Opus" in its response');
      }
    }
    
    // Check API-reported model
    if (response.model !== requestedModel) {
      console.log(`\n⚠️ API METADATA MISMATCH! API response indicates:`);
      console.log(`  - Requested: ${requestedModel}`);
      console.log(`  - API reports: ${response.model}`);
    } else {
      console.log('\n✅ API metadata matches requested model');
    }
    
    return {
      requestedModel,
      apiReportedModel: response.model,
      selfReportedModel: modelMatch && modelMatch[1] ? modelMatch[1].trim() : null,
      fullContent: content
    };
    
  } catch (error) {
    console.error('Error verifying Claude Haiku model:', error.message);
    if (error.response) {
      console.error('API error details:', error.response.data);
    }
    throw error;
  }
}

// Run the verification
verifyClaudeHaikuModel()
  .then(result => {
    console.log('\n===== Verification Summary =====');
    console.log(`Requested: ${result.requestedModel}`);
    console.log(`API reported: ${result.apiReportedModel}`);
    console.log(`Self-reported: ${result.selfReportedModel || 'None explicitly stated'}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
