/**
 * Simple Integrated Workflow Test
 * 
 * This script tests the integration between Claude and Perplexity APIs
 * for a simple research workflow.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Constants
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const CLAUDE_MODEL = 'claude-3-sonnet-20240229';
const PERPLEXITY_MODEL = 'llama-3.1-sonar-small-128k-online';
const DELAY_MS = 12000; // 12 second delay between API calls to respect rate limits

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Main test function
async function runIntegratedTest() {
  console.log('=== Testing Claude-Perplexity Integrated Workflow ===');
  
  try {
    // Check for API keys
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('⚠️ ANTHROPIC_API_KEY environment variable is not set.');
      return;
    }
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
      return;
    }
    
    console.log('✅ Both API keys are available');
    
    // Create output directory
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    
    // Define test scenario
    const testId = uuidv4().substring(0, 8);
    const userQuery = "How should we price our new machine learning API service?";
    
    console.log(`\nRunning test scenario ID: ${testId}`);
    console.log(`User query: "${userQuery}"`);
    
    // Step 1: Claude clarifies the question
    console.log('\n1. Claude clarifies the question...');
    const clarificationStartTime = Date.now();
    
    const claudeQuery = await callClaude({
      userMessage: userQuery,
      systemPrompt: `You are a pricing strategy expert. The user wants advice on pricing a product or service.
Your task is to:
1. Ask clarifying questions to understand their specific product/service and market position
2. Once you have enough information, return a JSON object with this structure:
{
  "clarifiedTopic": "Concise description of the pricing challenge",
  "keyFactors": ["List of 3-5 key factors relevant to this pricing decision"],
  "researchPrompt": "Optimized prompt for an AI research assistant to gather pricing research"
}
For now, just ask the initial clarifying questions - do not generate the JSON yet since you don't have enough information.`
    });
    
    const clarificationDuration = (Date.now() - clarificationStartTime) / 1000;
    console.log(`Claude clarification completed in ${clarificationDuration.toFixed(1)} seconds`);
    
    // Output Claude's clarification questions
    console.log('\nClaude clarification questions:');
    console.log('--------------------------------------');
    console.log(claudeQuery.content.substring(0, 400) + '...');
    console.log('--------------------------------------');
    
    // Save Claude clarification
    const clarificationFile = path.join(outputDir, `claude-clarification-${testId}.json`);
    await fs.writeFile(clarificationFile, JSON.stringify(claudeQuery, null, 2));
    console.log(`Claude clarification saved to ${clarificationFile}`);
    
    // Wait before next API call
    console.log(`\nWaiting ${DELAY_MS}ms before next API call to respect rate limits...`);
    await delay(DELAY_MS);
    
    // Step 2: Simulate user response with hardcoded answers
    const userResponses = `
Our API service offers real-time machine learning model inference for natural language processing tasks.
It's a new product from our established data science company.
Key features: high accuracy, low latency (50ms response time), 99.9% uptime SLA.
Target customers: medium to large tech companies and enterprises needing NLP capabilities.
Competitors charge between $0.01 and $0.10 per API call depending on complexity.
We're considering usage-based pricing but unsure about tiers and volume discounts.
Our processing costs are approximately $0.005 per API call.
`;
    
    // Step 3: Claude converts conversation to research prompt 
    console.log('\n2. Claude converts conversation to a research prompt...');
    const researchPromptStartTime = Date.now();
    
    const claudeResearchPrompt = await callClaude({
      userMessage: `${userQuery}\n\n${userResponses}`,
      systemPrompt: `You are a pricing strategy expert. The user has provided information about their machine learning API service.
Based on this information, create a JSON object with this structure:
{
  "clarifiedTopic": "Concise description of the pricing challenge",
  "keyFactors": ["List of 3-5 key factors relevant to this pricing decision"],
  "researchPrompt": "Optimized prompt for an AI research assistant to gather pricing research"
}
The "researchPrompt" should be detailed and specific enough to gather useful pricing research for this particular ML API service.`
    });
    
    const researchPromptDuration = (Date.now() - researchPromptStartTime) / 1000;
    console.log(`Claude research prompt generation completed in ${researchPromptDuration.toFixed(1)} seconds`);
    
    // Parse the JSON response
    const claudePromptMatch = claudeResearchPrompt.content.match(/\{[\s\S]*\}/);
    let researchPrompt = '';
    let jsonData = {};
    
    if (claudePromptMatch) {
      try {
        jsonData = JSON.parse(claudePromptMatch[0]);
        researchPrompt = jsonData.researchPrompt;
        
        console.log('\nClaude generated research prompt:');
        console.log('--------------------------------------');
        console.log(researchPrompt);
        console.log('--------------------------------------');
        
      } catch (error) {
        console.error('Error parsing Claude JSON:', error);
        researchPrompt = "Provide comprehensive research on pricing strategies for machine learning API services, including usage-based models, tiered pricing, and competitive analysis for enterprise NLP services.";
      }
    } else {
      console.log('Could not extract JSON from Claude response, using fallback prompt');
      researchPrompt = "Provide comprehensive research on pricing strategies for machine learning API services, including usage-based models, tiered pricing, and competitive analysis for enterprise NLP services.";
    }
    
    // Save Claude research prompt
    const researchPromptFile = path.join(outputDir, `claude-research-prompt-${testId}.json`);
    await fs.writeFile(researchPromptFile, JSON.stringify({
      raw: claudeResearchPrompt,
      extracted: jsonData
    }, null, 2));
    console.log(`Claude research prompt saved to ${researchPromptFile}`);
    
    // Wait before next API call
    console.log(`\nWaiting ${DELAY_MS}ms before next API call to respect rate limits...`);
    await delay(DELAY_MS);
    
    // Step 4: Perplexity conducts the research
    console.log('\n3. Perplexity conducts research based on the prompt...');
    const perplexityStartTime = Date.now();
    
    const perplexityResearch = await callPerplexity({
      query: researchPrompt,
      systemPrompt: "You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources."
    });
    
    const perplexityDuration = (Date.now() - perplexityStartTime) / 1000;
    console.log(`Perplexity research completed in ${perplexityDuration.toFixed(1)} seconds`);
    console.log(`Research length: ${perplexityResearch.content.length} characters`);
    console.log(`Citations found: ${perplexityResearch.citations.length}`);
    
    // Preview research
    console.log('\nPerplexity research preview:');
    console.log('--------------------------------------');
    console.log(perplexityResearch.content.substring(0, 400) + '...');
    console.log('--------------------------------------');
    
    // Save Perplexity research
    const perplexityFile = path.join(outputDir, `perplexity-research-${testId}.json`);
    await fs.writeFile(perplexityFile, JSON.stringify(perplexityResearch, null, 2));
    console.log(`Perplexity research saved to ${perplexityFile}`);
    
    // Wait before next API call
    console.log(`\nWaiting ${DELAY_MS}ms before next API call to respect rate limits...`);
    await delay(DELAY_MS);
    
    // Step 5: Claude analyzes the research and creates a recommendation
    console.log('\n4. Claude analyzes research and creates a pricing recommendation...');
    const recommendationStartTime = Date.now();
    
    const claudeRecommendation = await callClaude({
      userMessage: perplexityResearch.content,
      systemPrompt: `You are a pricing strategy expert. Based on the research provided, create a comprehensive pricing recommendation for a machine learning API service with these specifications:
- High-accuracy NLP capabilities
- Low latency (50ms response time)
- 99.9% uptime SLA
- Target customers: medium to large tech companies
- Processing cost: approximately $0.005 per API call
- Competitors charge between $0.01 and $0.10 per API call

Your recommendation should include:
1. A specific pricing structure (usage-based, tiered, etc.)
2. Actual price points and tiers
3. Justification based on the research
4. Implementation suggestions
5. Potential visualization ideas for how to display this pricing to customers

Format your response as a well-structured business recommendation that could be presented to executives.`
    });
    
    const recommendationDuration = (Date.now() - recommendationStartTime) / 1000;
    console.log(`Claude recommendation completed in ${recommendationDuration.toFixed(1)} seconds`);
    
    // Preview recommendation
    console.log('\nClaude pricing recommendation preview:');
    console.log('--------------------------------------');
    console.log(claudeRecommendation.content.substring(0, 400) + '...');
    console.log('--------------------------------------');
    
    // Save Claude recommendation
    const recommendationFile = path.join(outputDir, `claude-recommendation-${testId}.json`);
    await fs.writeFile(recommendationFile, JSON.stringify(claudeRecommendation, null, 2));
    console.log(`Claude recommendation saved to ${recommendationFile}`);
    
    // Create workflow summary
    const totalDuration = (Date.now() - clarificationStartTime) / 1000;
    console.log(`\n=== Integrated Workflow Test Completed in ${totalDuration.toFixed(1)} seconds ===`);
    console.log('All workflow steps were executed successfully:');
    console.log('1. Claude asked clarifying questions about the ML API service ✓');
    console.log('2. Claude created an optimized research prompt ✓');
    console.log('3. Perplexity conducted targeted research with citations ✓');
    console.log('4. Claude analyzed the research and created a pricing recommendation ✓');
    
    // Save workflow summary
    const workflowSummary = {
      testId,
      userQuery,
      timestamps: {
        start: new Date(clarificationStartTime).toISOString(),
        end: new Date().toISOString()
      },
      durations: {
        clarification: clarificationDuration,
        researchPrompt: researchPromptDuration,
        perplexityResearch: perplexityDuration,
        recommendation: recommendationDuration,
        total: totalDuration
      },
      results: {
        clarificationFile,
        researchPromptFile,
        perplexityFile,
        recommendationFile
      },
      status: 'completed'
    };
    
    const summaryFile = path.join(outputDir, `workflow-summary-${testId}.json`);
    await fs.writeFile(summaryFile, JSON.stringify(workflowSummary, null, 2));
    console.log(`\nWorkflow summary saved to ${summaryFile}`);
    
  } catch (error) {
    console.error('Test error:', error.message);
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    }
  }
}

// Helper function to call Claude API
async function callClaude({ userMessage, systemPrompt }) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    };
    
    const requestData = {
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ],
      system: systemPrompt
    };
    
    const response = await axios.post(CLAUDE_API_URL, requestData, { headers });
    
    return {
      content: response.data.content[0].text,
      model: response.data.model,
      rawResponse: response.data
    };
  } catch (error) {
    console.error('Claude API error:', error.message);
    throw error;
  }
}

// Helper function to call Perplexity API
async function callPerplexity({ query, systemPrompt }) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    };
    
    const requestData = {
      model: PERPLEXITY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      max_tokens: 2048,
      temperature: 0.2
    };
    
    const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
    
    return {
      content: response.data.choices[0].message.content,
      citations: response.data.citations || [],
      model: response.data.model,
      rawResponse: response.data
    };
  } catch (error) {
    console.error('Perplexity API error:', error.message);
    throw error;
  }
}

// Run the test
console.log('Starting integrated workflow test...');
runIntegratedTest().catch(console.error);