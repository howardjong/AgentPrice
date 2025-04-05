
/**
 * Verify Deep Research Workflow
 * 
 * This script tests the complete deep research workflow:
 * 1. Makes a call to Perplexity API using deep research model
 * 2. Polls for results with exponential backoff
 * 3. Processes the results using Claude for chart generation
 * 4. Creates visualizations with the processed data
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Ensure API keys are available
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!PERPLEXITY_API_KEY) {
  console.error('Error: PERPLEXITY_API_KEY is not set!');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set!');
  process.exit(1);
}

// Constants for API calls
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';
const PERPLEXITY_DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'output');

// Ensure output directory exists
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Output directory ensured: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('Error creating output directory:', error);
    throw error;
  }
}

// Make the initial request to Perplexity API for deep research
async function initiateDeepResearch(query) {
  console.log('Initiating deep research for query:', query);
  
  try {
    const response = await axios.post(`${PERPLEXITY_API_URL}/chat/completions`, {
      model: PERPLEXITY_DEEP_RESEARCH_MODEL,
      messages: [{ role: 'user', content: query }],
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      }
    });
    
    // For deep research model, we get a task ID back
    if (response.data && response.data.task_id) {
      console.log(`Deep research task initiated with ID: ${response.data.task_id}`);
      return response.data.task_id;
    } else {
      console.error('Unexpected response format:', response.data);
      throw new Error('Did not receive task_id from Perplexity deep research API');
    }
  } catch (error) {
    console.error('Error initiating deep research:', error.response?.data || error.message);
    throw error;
  }
}

// Poll for deep research results
async function pollForDeepResearchResults(taskId) {
  console.log('Starting to poll for deep research results...');
  
  // Polling configuration with exponential backoff
  let attempt = 0;
  const maxAttempts = 30; // About ~15 minutes of total waiting time with backoff
  let delay = 10000; // Start with 10-second delay
  
  while (attempt < maxAttempts) {
    attempt++;
    console.log(`Poll attempt ${attempt}/${maxAttempts} for task ${taskId}`);
    
    try {
      const response = await axios.get(`${PERPLEXITY_API_URL}/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
        }
      });
      
      // If the task is completed, return the results
      if (response.data && response.data.status === 'completed') {
        console.log(`Deep research task completed after ${attempt} attempts!`);
        
        // Extract sources/citations from the content if available
        const content = response.data.content;
        const sources = extractSourcesFromContent(content);
        
        return {
          content,
          sources,
          modelUsed: PERPLEXITY_DEEP_RESEARCH_MODEL,
          requestedModel: PERPLEXITY_DEEP_RESEARCH_MODEL
        };
      }
      
      // If still processing, log the status and wait
      console.log(`Task status: ${response.data.status}. Waiting ${delay/1000} seconds before next attempt...`);
      
      // Wait before next poll with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 60000); // Increase delay, max 60 seconds
    } catch (error) {
      console.error(`Poll attempt ${attempt} failed:`, error.response?.data || error.message);
      
      // For network errors, we should wait and retry
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log(`Network error, waiting ${delay/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 60000);
        continue;
      }
      
      // For 429 errors (rate limiting), we should back off more aggressively
      if (error.response && error.response.status === 429) {
        console.log('Rate limit reached, backing off...');
        await new Promise(resolve => setTimeout(resolve, delay * 2));
        delay = Math.min(delay * 2, 120000); // More aggressive backoff for rate limits
        continue;
      }
      
      // For other errors, we might want to fail faster
      throw error;
    }
  }
  
  throw new Error(`Deep research task did not complete after ${maxAttempts} polling attempts`);
}

// Extract sources from the research content
function extractSourcesFromContent(content) {
  // Simple regex extraction of URLs or citations
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const sourcesSet = new Set();
  let match;
  
  while ((match = urlRegex.exec(content)) !== null) {
    sourcesSet.add(match[0]);
  }
  
  return Array.from(sourcesSet);
}

// Call Claude API to generate chart data from research content
async function generateChartData(researchContent, chartType = 'bar') {
  console.log(`Generating ${chartType} chart data from research content...`);
  
  try {
    // Create request to Claude API for chart data generation
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: `Based on the following research, extract key data points for a ${chartType} chart visualization. Format the output as a JSON object with 'data' and 'insights' keys. The 'data' should contain the structured data points, and 'insights' should be an array of key findings.
          
          Research content:
          ${researchContent.substring(0, 12000)} // Limit content to avoid token limits
          
          Output the result as a single valid JSON object.`
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    // Extract JSON from Claude's response
    let chartData;
    try {
      const content = response.data.content[0].text;
      // Extract JSON if wrapped in code blocks or other formatting
      let jsonContent = content;
      if (content.includes('```json')) {
        jsonContent = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonContent = content.split('```')[1].split('```')[0].trim();
      }
      
      chartData = JSON.parse(jsonContent);
    } catch (error) {
      console.error('Error parsing JSON from Claude response:', error);
      console.log('Claude response:', response.data.content[0].text);
      throw new Error('Failed to parse chart data JSON from Claude response');
    }
    
    console.log('Successfully generated chart data from research content');
    return chartData;
  } catch (error) {
    console.error('Error generating chart data:', error.response?.data || error.message);
    throw error;
  }
}

// Generate Plotly visualization from chart data
async function generatePlotlyVisualization(chartData, chartType) {
  console.log(`Generating Plotly visualization for ${chartType} chart...`);
  
  try {
    // Create request to Claude API for Plotly config generation
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: `Create a Plotly visualization configuration for the following chart data. The output should be a JSON object with 'data', 'layout', and 'config' properties for Plotly.

          Chart Type: ${chartType}
          Chart Data: ${JSON.stringify(chartData)}
          
          Output the result as a single valid JSON object containing the Plotly configuration.`
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    // Extract JSON from Claude's response
    let plotlyConfig;
    try {
      const content = response.data.content[0].text;
      // Extract JSON if wrapped in code blocks or other formatting
      let jsonContent = content;
      if (content.includes('```json')) {
        jsonContent = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonContent = content.split('```')[1].split('```')[0].trim();
      }
      
      plotlyConfig = JSON.parse(jsonContent);
    } catch (error) {
      console.error('Error parsing JSON from Claude response:', error);
      console.log('Claude response:', response.data.content[0].text);
      throw new Error('Failed to parse Plotly config JSON from Claude response');
    }
    
    console.log('Successfully generated Plotly visualization');
    return plotlyConfig;
  } catch (error) {
    console.error('Error generating Plotly visualization:', error.response?.data || error.message);
    throw error;
  }
}

// Save results to file
async function saveResults(fileName, data) {
  try {
    const filePath = path.join(OUTPUT_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Results saved to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving results to ${fileName}:`, error);
    throw error;
  }
}

// Complete verification workflow
async function verifyDeepResearchWorkflow() {
  console.log('\n====== DEEP RESEARCH WORKFLOW VERIFICATION ======\n');
  
  // Generate a unique test ID
  const testId = uuidv4().substring(0, 8);
  
  try {
    // Ensure output directory exists
    await ensureOutputDir();
    
    // Test query (can be replaced with command-line argument)
    const query = process.argv[2] || 
                 "What is the current competitive landscape for childcare facilities in Vancouver, Canada? Include pricing and services offered.";
    
    console.log(`Test ID: ${testId}`);
    console.log(`Test Query: "${query}"\n`);
    
    // Step 1: Initiate deep research
    console.log('======= STEP 1: INITIATING DEEP RESEARCH =======');
    const startTime = Date.now();
    const taskId = await initiateDeepResearch(query);
    
    // Step 2: Poll for research results
    console.log('\n======= STEP 2: POLLING FOR RESEARCH RESULTS =======');
    const researchResults = await pollForDeepResearchResults(taskId);
    const researchTime = Date.now() - startTime;
    console.log(`\nDeep research completed in ${(researchTime/1000).toFixed(1)} seconds`);
    
    // Save research results
    const researchFileName = `deep-research-${testId}.json`;
    await saveResults(researchFileName, researchResults);
    
    // Step 3: Generate chart data
    console.log('\n======= STEP 3: GENERATING CHART DATA =======');
    const chartType = 'bar'; // Default chart type
    const chartData = await generateChartData(researchResults.content, chartType);
    
    // Save chart data
    const chartDataFileName = `chart-data-${testId}.json`;
    await saveResults(chartDataFileName, chartData);
    
    // Step 4: Generate Plotly visualization
    console.log('\n======= STEP 4: GENERATING PLOTLY VISUALIZATION =======');
    const plotlyConfig = await generatePlotlyVisualization(chartData, chartType);
    
    // Save Plotly config
    const plotlyFileName = `plotly-config-${testId}.json`;
    await saveResults(plotlyFileName, plotlyConfig);
    
    // Calculate total time
    const totalTime = Date.now() - startTime;
    
    // Create verification summary
    const summary = {
      testId,
      query,
      completedAt: new Date().toISOString(),
      timing: {
        researchTime: `${(researchTime/1000).toFixed(1)} seconds`,
        totalTime: `${(totalTime/1000).toFixed(1)} seconds`
      },
      files: {
        researchResults: researchFileName,
        chartData: chartDataFileName,
        plotlyConfig: plotlyFileName
      },
      status: 'SUCCESS',
      model: researchResults.modelUsed
    };
    
    // Save summary
    await saveResults(`verification-summary-${testId}.json`, summary);
    
    console.log('\n====== VERIFICATION SUMMARY ======');
    console.log(`Test ID: ${testId}`);
    console.log(`Query: "${query}"`);
    console.log(`Deep Research Model: ${researchResults.modelUsed}`);
    console.log(`Research Time: ${(researchTime/1000).toFixed(1)} seconds`);
    console.log(`Total Time: ${(totalTime/1000).toFixed(1)} seconds`);
    console.log(`Sources Found: ${researchResults.sources.length}`);
    console.log(`Files Generated:`);
    console.log(`  - ${researchFileName}`);
    console.log(`  - ${chartDataFileName}`);
    console.log(`  - ${plotlyFileName}`);
    console.log(`  - verification-summary-${testId}.json`);
    console.log('\nVERIFICATION STATUS: SUCCESS');
    
    return summary;
  } catch (error) {
    console.error('\n====== VERIFICATION ERROR ======');
    console.error(`Error in Deep Research Workflow Verification: ${error.message}`);
    if (error.response) {
      console.error('API Error Details:', error.response.data);
      console.error('Status Code:', error.response.status);
    }
    
    // Save error information
    const errorSummary = {
      testId,
      query: process.argv[2] || "Default query",
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        response: error.response?.data || null,
        status: error.response?.status || null
      },
      status: 'FAILED'
    };
    
    await saveResults(`verification-error-${testId}.json`, errorSummary);
    console.error(`Error details saved to: verification-error-${testId}.json`);
    console.log('\nVERIFICATION STATUS: FAILED');
    
    process.exit(1);
  }
}

// Execute the verification if this file is being run directly
if (process.argv[1] === import.meta.url) {
  verifyDeepResearchWorkflow().catch(error => {
    console.error('Verification workflow failed:', error);
    process.exit(1);
  });
}

export default verifyDeepResearchWorkflow;
