/**
 * Claude Model Comparison Test
 * 
 * This script attempts to compare the behavior of Claude 3.5 and Claude 3.7
 * by requesting both models explicitly and checking their responses.
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function compareClaudeModels() {
  try {
    console.log('Comparing Claude 3.5 and Claude 3.7 models...');
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Error: ANTHROPIC_API_KEY is not set in environment variables');
      process.exit(1);
    }
    
    // Models to test
    const testModels = [
      "claude-3-5-sonnet-20240620", // Claude 3.5 explicitly
      "claude-3-7-sonnet-20250219"  // Claude 3.7 explicitly
    ];
    
    const results = {};
    
    // Simple test prompt that should produce different responses
    const testPrompt = "Please identify which Claude model you are. Also, tell me the latest news event you're aware of with its date, and the most recently released movies you know about. Format your answer with clear headings.";
    
    for (const model of testModels) {
      console.log(`\n\n==================================`);
      console.log(`Testing model: ${model}`);
      console.log(`==================================`);
      
      try {
        // Make a request
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: 800,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          system: "Include your model name at the end of your response inside double brackets like this: [[model-name]]. Be precise about your knowledge cutoff date."
        });
        
        console.log('API Response Meta:');
        console.log('-----------------');
        console.log(`• API-reported model: ${response.model}`);
        console.log(`• Request ID: ${response.id}`);
        console.log(`• Tokens used: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`);
        
        const content = response.content[0].text;
        
        // Extract self-reported model
        const modelMatch = content.match(/\[\[(.*?)\]\]/);
        const reportedModel = modelMatch ? modelMatch[1].trim() : "Not reported";
        
        console.log(`• Self-reported model: ${reportedModel}`);
        
        if (reportedModel !== model && !reportedModel.includes(model.split('-20')[0])) {
          console.log(`\n⚠️ MODEL MISMATCH! Requested ${model} but got ${reportedModel}`);
        }
        
        // Store results for comparison
        results[model] = {
          apiReportedModel: response.model,
          selfReportedModel: reportedModel,
          content: content,
          tokens: response.usage
        };
        
        console.log('\nResponse Content:');
        console.log('----------------');
        console.log(content);
        
      } catch (error) {
        console.error(`Error with model ${model}:`, error.message);
        results[model] = { error: error.message };
      }
    }
    
    // Output a summary comparison
    console.log('\n\n==================================');
    console.log('MODEL COMPARISON SUMMARY');
    console.log('==================================');
    
    for (const model of testModels) {
      const result = results[model];
      console.log(`\n${model}:`);
      
      if (result.error) {
        console.log(`  ERROR: ${result.error}`);
        continue;
      }
      
      console.log(`  API reported: ${result.apiReportedModel}`);
      console.log(`  Self-reported: ${result.selfReportedModel}`);
      console.log(`  Tokens: ${result.tokens.input_tokens} input, ${result.tokens.output_tokens} output`);
      
      // Check if the model identification matches
      const modelBase = model.split('-20')[0];
      const selfReportedBase = result.selfReportedModel.toLowerCase().includes(modelBase) ? 
        modelBase : result.selfReportedModel;
        
      if (selfReportedBase !== modelBase) {
        console.log(`  ⚠️ MISMATCH! Requested ${modelBase} but got ${selfReportedBase}`);
      } else {
        console.log(`  ✅ Match: ${modelBase}`);
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('Comparison failed:', error.message);
    throw error;
  }
}

// Run the comparison
compareClaudeModels()
  .then(() => {
    console.log('\nModel comparison completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Comparison script failed:', error);
    process.exit(1);
  });