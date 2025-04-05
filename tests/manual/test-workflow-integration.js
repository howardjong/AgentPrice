
/**
 * Test Workflow Integration
 * 
 * This test verifies the full workflow integration:
 * 1. Claude service for clarifying questions and enhancing research prompt
 * 2. Perplexity service for deep research
 * 3. Claude service for generating chart data
 */

const claudeService = require('../../services/claudeService');
const perplexityService = require('../../services/perplexityService');
const promptManager = require('../../services/promptManager');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create output directory if it doesn't exist
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'output');

// Simple delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run the full workflow integration test
 */
async function testWorkflowIntegration() {
  console.log('=================================================');
  console.log('         WORKFLOW INTEGRATION TEST');
  console.log('=================================================');
  
  try {
    // Parse command line args
    const args = process.argv.slice(2);
    const useDeepResearch = !args.includes('--no-deep-research');
    const query = args.find(arg => arg.startsWith('--query='))?.substring('--query='.length) 
      || "What are the pricing strategies for SaaS products in different market segments?";
    
    console.log(`Query: "${query}"`);
    console.log(`Deep Research: ${useDeepResearch ? 'Enabled' : 'Disabled'}`);
    
    // Start tracking time
    const startTime = Date.now();
    
    // Step 1: Claude generates clarifying questions
    console.log('\n[1/5] Generating clarifying questions...');
    const clarifyingPrompt = await promptManager.getPrompt('claude', 'clarifying_questions');
    const clarifyingResponse = await claudeService.processText(
      clarifyingPrompt.replace('{{QUERY}}', query)
    );
    
    // Extract questions from response
    const questions = extractQuestions(clarifyingResponse.content);
    console.log(`Generated ${questions.length} clarifying questions`);
    questions.forEach((q, i) => console.log(`  ${i+1}. ${q}`));
    
    // Step 2: Simulate user responses to clarifying questions
    console.log('\n[2/5] Simulating user responses...');
    const userResponses = simulateUserResponses(questions);
    
    // Step 3: Claude enhances research prompt
    console.log('\n[3/5] Enhancing research prompt...');
    const enhancementPrompt = await promptManager.getPrompt('claude', 'response_generation');
    const enhancedPrompt = await claudeService.processText(
      enhancementPrompt
        .replace('{{QUERY}}', query)
        .replace('{{QUESTIONS_AND_ANSWERS}}', formatQuestionsAndAnswers(questions, userResponses))
    );
    
    console.log('Enhanced research prompt created');
    console.log('Preview:');
    console.log('-'.repeat(50));
    console.log(enhancedPrompt.content.substring(0, 500) + '...');
    console.log('-'.repeat(50));
    
    // Step 4: Perplexity performs deep research
    console.log('\n[4/5] Performing research...');
    const researchStartTime = Date.now();
    const researchResults = await perplexityService.performDeepResearch(
      enhancedPrompt.content,
      {
        enableChunking: true,
        wantsDeepResearch: useDeepResearch,
        model: useDeepResearch ? 'sonar-deep-research' : 'sonar'
      }
    );
    const researchTime = Date.now() - researchStartTime;
    
    console.log(`Research completed in ${(researchTime/1000).toFixed(1)}s`);
    console.log(`Model used: ${researchResults.modelUsed}`);
    console.log(`Content length: ${researchResults.content.length} characters`);
    console.log(`Citations: ${researchResults.citations.length}`);
    
    // Step 5: Claude generates chart data
    console.log('\n[5/5] Generating chart data...');
    const chartPrompt = await promptManager.getPrompt('claude', 'chart_data/van_westendorp');
    const chartDataResponse = await claudeService.processText(
      chartPrompt.replace('{{RESEARCH_CONTENT}}', researchResults.content)
    );
    
    // Parse chart data
    const chartData = extractChartData(chartDataResponse.content);
    console.log('Chart data generated');
    
    // Generate Plotly visualization
    console.log('\nGenerating Plotly visualization...');
    const plotlyPrompt = await promptManager.getPrompt('claude', 'plotly_visualization');
    const plotlyResponse = await claudeService.processText(
      plotlyPrompt
        .replace('{{CHART_DATA}}', JSON.stringify(chartData))
        .replace('{{CHART_TYPE}}', 'van_westendorp')
        .replace('{{CHART_TITLE}}', 'Van Westendorp Price Sensitivity Analysis')
        .replace('{{CHART_DESCRIPTION}}', 'Based on deep research into SaaS pricing strategies')
    );
    
    // Parse Plotly config
    const plotlyConfig = extractJsonConfig(plotlyResponse.content);
    
    // Calculate total time
    const totalTime = Date.now() - startTime;
    console.log(`\nWorkflow completed in ${(totalTime/1000).toFixed(1)} seconds`);
    
    // Save results
    const results = {
      query,
      clarifyingQuestions: questions,
      userResponses,
      enhancedPrompt: enhancedPrompt.content,
      researchResults: {
        content: researchResults.content,
        citations: researchResults.citations,
        modelUsed: researchResults.modelUsed
      },
      chartData,
      plotlyConfig,
      metrics: {
        totalTime,
        researchTime
      },
      timestamp: new Date().toISOString()
    };
    
    await saveResults(results, 'workflow-integration-test');
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Extract questions from Claude's response
 */
function extractQuestions(content) {
  const lines = content.split('\n');
  return lines
    .filter(line => line.trim().match(/^\d+[\.\)]\s+.+\?$/))
    .map(line => line.replace(/^\d+[\.\)]\s+/, '').trim());
}

/**
 * Simulate user responses to clarifying questions
 */
function simulateUserResponses(questions) {
  const responses = {};
  
  // Generic responses based on question content
  questions.forEach((question, index) => {
    if (question.toLowerCase().includes('budget') || question.toLowerCase().includes('price')) {
      responses[`question${index+1}`] = "Our budget range is flexible, but we're looking at mid-market pricing between $50-200 per user per month depending on features.";
    } else if (question.toLowerCase().includes('industry') || question.toLowerCase().includes('market')) {
      responses[`question${index+1}`] = "We're primarily focused on the B2B SaaS market for small to medium enterprises in the technology and professional services industries.";
    } else if (question.toLowerCase().includes('competitor') || question.toLowerCase().includes('competition')) {
      responses[`question${index+1}`] = "Our main competitors are using a combination of tiered and usage-based pricing models with freemium offerings to acquire customers.";
    } else if (question.toLowerCase().includes('customer') || question.toLowerCase().includes('user')) {
      responses[`question${index+1}`] = "Our target customers are primarily professional teams who value ease of use and integration capabilities over having the absolute lowest price.";
    } else if (question.toLowerCase().includes('feature') || question.toLowerCase().includes('functionality')) {
      responses[`question${index+1}`] = "The key features we want to price appropriately include data analytics, team collaboration tools, API access, and premium support.";
    } else {
      responses[`question${index+1}`] = "Yes, that's an important consideration for our pricing strategy. We want to optimize for long-term customer value rather than short-term gains.";
    }
  });
  
  return responses;
}

/**
 * Format questions and answers for prompt enhancement
 */
function formatQuestionsAndAnswers(questions, responses) {
  return questions.map((question, index) => {
    const responseKey = `question${index+1}`;
    return `Question: ${question}\nAnswer: ${responses[responseKey]}`;
  }).join('\n\n');
}

/**
 * Extract chart data from Claude's response
 */
function extractChartData(content) {
  try {
    // Look for JSON block in the response
    const jsonMatch = content.match(/```json([\s\S]+?)```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // Alternative format
    const dataMatch = content.match(/\{[\s\S]+\}/);
    if (dataMatch) {
      return JSON.parse(dataMatch[0]);
    }
    
    throw new Error('Could not extract chart data from response');
  } catch (error) {
    console.error('Error parsing chart data:', error);
    return {
      error: 'Failed to parse chart data',
      rawContent: content
    };
  }
}

/**
 * Extract JSON configuration from Claude's response
 */
function extractJsonConfig(content) {
  try {
    // Look for JSON block in the response
    const jsonMatch = content.match(/```json([\s\S]+?)```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // Alternative format
    const configMatch = content.match(/\{[\s\S]+\}/);
    if (configMatch) {
      return JSON.parse(configMatch[0]);
    }
    
    throw new Error('Could not extract JSON configuration from response');
  } catch (error) {
    console.error('Error parsing JSON configuration:', error);
    return {
      error: 'Failed to parse JSON configuration',
      rawContent: content
    };
  }
}

/**
 * Save results to file
 */
async function saveResults(results, filePrefix) {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${filePrefix}-${timestamp}.json`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    
    // Save results
    await fs.writeFile(
      outputPath,
      JSON.stringify(results, null, 2)
    );
    
    console.log(`Results saved to: ${outputPath}`);
    return outputPath;
    
  } catch (error) {
    console.error('Error saving results:', error);
  }
}

// Run the test
testWorkflowIntegration();
