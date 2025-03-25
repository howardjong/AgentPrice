
/**
 * Claude Model Details Check
 * 
 * This script makes a direct API call to Anthropic to verify
 * the Claude model's details and self-identification.
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { inspect } from 'util';

// Load environment variables
dotenv.config();

async function checkClaudeModelDetails() {
    try {
        console.log('==================================================');
        console.log('🔍 DETAILED CLAUDE MODEL VERIFICATION');
        console.log('==================================================');
        
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            console.error('Error: ANTHROPIC_API_KEY is not set');
            process.exit(1);
        }
        
        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: apiKey
        });
        
        // The models we want to test
        const requestedModel = "claude-3-5-sonnet-20241022";
        console.log(`🔹 Requested model: ${requestedModel}`);
        
        // Create a detailed system prompt to extract maximum information
        const systemPrompt = `You are Claude, Anthropic's AI assistant. Your task is to provide accurate and complete information about yourself.
        
        Please identify yourself (exact model name and version) and provide a detailed list of your capabilities, limitations, and technical details. 
        
        Include your model date/version, training cutoff date, and any significant design aspects.
        
        End your response with your model identifier in double brackets like [[MODEL NAME]]`;
        
        console.log('\n📤 Sending detailed verification request...\n');
        
        // Send the request
        const response = await anthropic.messages.create({
            model: requestedModel,
            system: systemPrompt,
            max_tokens: 1000,
            messages: [
                { 
                    role: 'user', 
                    content: 'What model are you exactly? Please provide all details about your capabilities, limitations, training, and technical specifications. Be specific about your model version. End with your model identifier in double brackets.'
                }
            ]
        });
        
        // Extract model name from response text
        const modelIdentifierRegex = /\[\[(.*?)\]\]/;
        const content = response.content[0].text;
        const modelMatch = content.match(modelIdentifierRegex);
        const reportedModel = modelMatch ? modelMatch[1].trim() : 'Not explicitly stated';
        
        // Display response metadata
        console.log('==================================================');
        console.log('📊 API RESPONSE METADATA');
        console.log('==================================================');
        console.log(`🆔 Response ID: ${response.id}`);
        console.log(`📋 Response type: ${response.type}`);
        console.log(`🤖 API-reported model: ${response.model}`);
        console.log(`👣 System fingerprint: ${response.system_fingerprint || 'Not provided'}`);
        console.log(`🔢 Stop reason: ${response.stop_reason}`);
        console.log(`📏 Usage: ${JSON.stringify(response.usage, null, 2)}`);
        
        // Display model self-identification
        console.log('\n==================================================');
        console.log('🧠 MODEL SELF-IDENTIFICATION');
        console.log('==================================================');
        console.log(`🏷️ Self-reported model: ${reportedModel}`);
        
        // Verification results
        console.log('\n==================================================');
        console.log('✅ VERIFICATION RESULTS');
        console.log('==================================================');
        
        if (response.model === requestedModel) {
            console.log('✅ MATCH: API model matches requested model');
        } else {
            console.log('❌ MISMATCH: API model does NOT match requested model');
            console.log(`   Requested: ${requestedModel}`);
            console.log(`   Received: ${response.model}`);
        }
        
        // Display full model response
        console.log('\n==================================================');
        console.log('📝 FULL MODEL RESPONSE');
        console.log('==================================================');
        console.log(content);
        
        // Show the raw API response object for debugging
        console.log('\n==================================================');
        console.log('🔧 RAW API RESPONSE OBJECT (for debugging)');
        console.log('==================================================');
        console.log(inspect(response, { colors: true, depth: 2 }));
        
    } catch (error) {
        console.error('Error checking Claude model details:', error);
        if (error.response) {
            console.error('API error details:', error.response.data);
        }
    }
}

// Run the check
checkClaudeModelDetails();
