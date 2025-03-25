
/**
 * Enhanced Claude Model Verification
 * 
 * This script makes a direct API call to Anthropic and requests detailed
 * information about the model's identity, including full version details,
 * capabilities, and knowledge cutoff date.
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import util from 'util';

// Load environment variables
dotenv.config();

async function checkClaudeModelDetails() {
  try {
    console.log('==================================================');
    console.log('🔍 DETAILED CLAUDE MODEL VERIFICATION');
    console.log('==================================================');
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ Error: ANTHROPIC_API_KEY is not set in environment variables');
      process.exit(1);
    }
    
    // The models we want to test
    const requestedModel = "claude-3-7-sonnet-20250219";
    console.log(`🔹 Requested model: ${requestedModel}`);
    
    // Create a detailed system prompt to extract maximum information
    const systemPrompt = `
    You are Claude, an AI assistant. Please provide extremely detailed information about yourself.
    Follow these instructions carefully:

    1. Identify your EXACT model name and version (e.g., Claude 3.7 Sonnet).
    2. Specify your knowledge cutoff date in MM/DD/YYYY format.
    3. List your core capabilities and limitations.
    4. Include your model's training corpus information if available.
    5. Provide your system fingerprint or unique identifier if available.
    6. State which specific Anthropic model you are (include full identifier with date if applicable).
    7. Rate your performance in these categories (1-10): reasoning, mathematical ability, coding ability, retrieval precision.
    
    Format your response with clear headings and include ALL available technical details about your model architecture.
    At the end of your response, include your full model identifier in double brackets like this: [[model-identifier]]
    `;
    
    console.log('\n📤 Sending detailed verification request...');
    
    // Make a request with the detailed prompt
    const response = await anthropic.messages.create({
      model: requestedModel,
      max_tokens: 1000,
      temperature: 0,
      messages: [
        { role: 'user', content: 'Identify yourself in complete detail. What exact model are you? Include ALL technical specifications and version information.' }
      ],
      system: systemPrompt
    });
    
    // Extract the self-reported model information
    const modelRegex = /\[\[(.*?)\]\]/;
    const modelMatch = response.content[0].text.match(modelRegex);
    const selfReportedModel = modelMatch ? modelMatch[1].trim() : 'Not specified';
    
    // API metadata
    console.log('\n==================================================');
    console.log('📊 API RESPONSE METADATA');
    console.log('==================================================');
    console.log(`🆔 Response ID: ${response.id}`);
    console.log(`📋 Response type: ${response.type}`);
    console.log(`🤖 API-reported model: ${response.model}`);
    console.log(`👣 System fingerprint: ${response.system_fingerprint || 'Not provided'}`);
    console.log(`🔢 Stop reason: ${response.stop_reason}`);
    console.log(`📏 Usage: ${JSON.stringify(response.usage, null, 2)}`);
    
    // Self-reported information
    console.log('\n==================================================');
    console.log('🧠 MODEL SELF-IDENTIFICATION');
    console.log('==================================================');
    console.log(`🏷️ Self-reported model: ${selfReportedModel}`);
    
    // Model verification result
    console.log('\n==================================================');
    console.log('✅ VERIFICATION RESULTS');
    console.log('==================================================');
    
    // Check if the model matches what was requested
    const modelVerification = response.model === requestedModel 
      ? '✅ MATCH: API model matches requested model'
      : `❌ MISMATCH: API model (${response.model}) differs from requested model (${requestedModel})`;
    
    console.log(modelVerification);
    
    // Full model response
    console.log('\n==================================================');
    console.log('📝 FULL MODEL RESPONSE');
    console.log('==================================================');
    console.log(response.content[0].text);
    
    // Raw API response for debugging
    console.log('\n==================================================');
    console.log('🔧 RAW API RESPONSE OBJECT (for debugging)');
    console.log('==================================================');
    console.log(util.inspect(response, { depth: null, colors: true }));
    
    return {
      requestedModel,
      actualModel: response.model,
      selfReportedModel,
      response: response.content[0].text,
      fullResponse: response
    };
  } catch (error) {
    console.error('❌ Error checking Claude model:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the verification
checkClaudeModelDetails();
