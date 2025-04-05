/**
 * Complete Perplexity Deep Research Script
 * 
 * This script handles the entire deep research process:
 * 1. Initiating a research request
 * 2. Saving the poll URL
 * 3. Setting up a background process to periodically check status
 * 4. Collecting and organizing results
 * 
 * Run with a specific query:
 * node complete-perplexity-deep-research.cjs "What are the latest SaaS pricing strategies in 2025?"
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Constants
const API_URL = 'https://api.perplexity.ai/chat/completions';
const LOG_FILE = 'perplexity-deep-research.log';
const RESULTS_DIR = path.join(__dirname, 'test-results', 'deep-research');
const MAX_POLLING_ATTEMPTS = 30;  // With 5 seconds delay, this is ~2.5 minutes of polling
const POLLING_DELAY_MS = 5000;    // 5 seconds between polls

// Get query from command line arguments or use default
const query = process.argv[2] || 'What are the current best practices for SaaS pricing strategies in 2025? Please include specific examples of successful companies.';

// Create a unique request ID
const requestId = uuidv4();

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  await fs.appendFile(LOG_FILE, `${logMessage}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

async function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }
  await log('✅ API key is available');
  return apiKey;
}

/**
 * Execute a query against the Perplexity API with the deep research model
 */
async function initiateDeepResearch(query, options = {}) {
  await log(`Initiating deep research with request ID: ${requestId}`);
  await log(`Query: ${query}`);
  
  try {
    const apiKey = await checkApiKey();
    
    // Ensure the results directory exists
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    
    const model = 'sonar-deep-research';
    const requestData = {
      model,
      messages: [
        { role: 'user', content: query }
      ],
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.0,
      stream: false
    };
    
    // Add system message if provided
    if (options.systemPrompt) {
      requestData.messages.unshift({ 
        role: 'system', 
        content: options.systemPrompt 
      });
      await log(`Using system prompt: "${options.systemPrompt.substring(0, 50)}..."`);
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    await log(`Sending request to Perplexity API (${model})...`);
    const response = await axios.post(API_URL, requestData, {
      headers,
      timeout: 60000 // 60 second timeout
    });
    
    const status = response.status;
    await log(`Response status: ${status}`);
    
    // Save initial response
    const responseFile = path.join(RESULTS_DIR, `initial-response-${requestId}.json`);
    await fs.writeFile(responseFile, JSON.stringify(response.data, null, 2));
    await log(`Saved initial response to ${responseFile}`);
    
    // Check for poll URL
    const pollUrl = extractPollUrl(response.data);
    if (pollUrl) {
      await log(`Received poll URL: ${pollUrl}`);
      
      // Save poll data for potential future use
      const pollData = {
        requestId,
        pollUrl,
        timestamp: new Date().toISOString(),
        query,
        options
      };
      
      const pollDataFile = path.join(RESULTS_DIR, `poll-data-${requestId}.json`);
      await fs.writeFile(pollDataFile, JSON.stringify(pollData, null, 2));
      await log(`Saved poll data to ${pollDataFile}`);
      
      // Also save as an intermediate file with timestamp for backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const intermediateFile = path.join(RESULTS_DIR, `request-${requestId}-${timestamp}-intermediate.json`);
      
      // Include more metadata in the intermediate file
      const intermediateData = {
        requestId,
        query,
        options: {
          model,
          systemPrompt: options.systemPrompt || '',
          temperature: options.temperature || 0.0,
          maxTokens: options.maxTokens || 2000,
          searchContext: options.searchContext || 'high'
        },
        status: 'starting',
        startTime: new Date().toISOString()
      };
      
      await fs.writeFile(intermediateFile, JSON.stringify(intermediateData, null, 2));
      await log(`Saved intermediate request data to ${intermediateFile}`);
      
      return {
        status: 'polling_required',
        requestId,
        pollUrl,
        initialResponse: response.data
      };
    } else {
      await log('No poll URL found - research completed synchronously');
      
      // Extract model info from response
      const modelInfo = extractModelInfo(response.data, model);
      await log(`Model used: ${modelInfo}`);
      
      return {
        status: 'completed',
        requestId,
        response: response.data
      };
    }
  } catch (error) {
    await log(`Error initiating deep research: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
      
      // Save error response
      const errorFile = path.join(RESULTS_DIR, `error-${requestId}.json`);
      await fs.writeFile(errorFile, JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
}

/**
 * Extract poll URL from response
 */
function extractPollUrl(response) {
  if (!response) return null;
  
  // Case 1: Direct poll_url field in response
  if (response.poll_url) {
    return response.poll_url;
  }
  
  return null;
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) return defaultModel;
  
  // Case 1: Direct model field in response
  if (response.model) {
    return response.model;
  }
  
  // Case 2: Extract from completion.model if available
  if (response.completion && response.completion.model) {
    return response.completion.model;
  }
  
  return defaultModel;
}

/**
 * Schedule a background check for the research status
 */
function scheduleStatusCheck(pollUrl, requestId) {
  // Create a new status check script that will be executed later
  const statusCheckScript = `
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const RESULTS_DIR = path.join(__dirname, 'test-results', 'deep-research');
const LOG_FILE = 'perplexity-deep-research-status-${requestId}.log';
const pollUrl = "${pollUrl}";
const requestId = "${requestId}";
const apiKey = process.env.PERPLEXITY_API_KEY;

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = \`[\${timestamp}] \${message}\`;
  console.log(logMessage);
  
  await fs.appendFile(LOG_FILE, \`\${logMessage}\\n\`)
    .catch(err => console.error(\`Error writing to log: \${err.message}\`));
}

async function checkStatus() {
  await log('=== Checking Deep Research Status ===');
  await log(\`Request ID: \${requestId}\`);
  await log(\`Poll URL: \${pollUrl}\`);
  
  try {
    const response = await axios.get(pollUrl, {
      headers: {
        'Authorization': \`Bearer \${apiKey}\`
      },
      timeout: 30000
    });
    
    await log(\`Received response with status code: \${response.status}\`);
    
    // Save the response
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const responseFile = path.join(RESULTS_DIR, \`poll-response-\${requestId}-\${timestamp}.json\`);
    await fs.writeFile(responseFile, JSON.stringify(response.data, null, 2));
    
    // Check if completed
    let status = 'unknown';
    if (response.data.status) {
      status = response.data.status;
    } else if (response.data.completion && response.data.completion.text) {
      status = 'completed';
    }
    
    await log(\`Research status: \${status}\`);
    
    // If completed, save as a completed response
    if (status === 'completed') {
      const completeFile = path.join(RESULTS_DIR, \`complete-response-\${requestId}.json\`);
      await fs.writeFile(completeFile, JSON.stringify(response.data, null, 2));
      await log('Research complete!');
    }
    
    return status;
  } catch (error) {
    await log(\`Error checking status: \${error.message}\`);
    if (error.response) {
      await log(\`Status: \${error.response.status}\`);
      await log(\`Response data: \${JSON.stringify(error.response.data)}\`);
    }
    return 'error';
  }
}

// Run the check
checkStatus();
  `;
  
  const scriptFile = path.join(__dirname, `check-status-${requestId}.js`);
  
  // Write the script to a file
  fs.writeFile(scriptFile, statusCheckScript)
    .then(() => log(`Created status check script: ${scriptFile}`))
    .catch(err => log(`Error creating status check script: ${err.message}`));
  
  // Schedule the check to run in 5 minutes
  const cronEntry = `*/5 * * * * cd ${__dirname} && node ${scriptFile} >> perplexity-deep-research-status-${requestId}.log 2>&1`;
  
  // Log the cron entry for manual setup
  log(`To check status every 5 minutes, you can add this to your crontab:`);
  log(cronEntry);
  
  // We can't directly add to crontab in the Replit environment, so we'll just run it once for demonstration
  setTimeout(() => {
    log(`Running initial status check in 2 minutes...`);
    exec(`node ${scriptFile}`, (error, stdout, stderr) => {
      if (error) {
        log(`Error running status check: ${error.message}`);
        return;
      }
      if (stderr) {
        log(`Status check stderr: ${stderr}`);
      }
      log(`Status check stdout: ${stdout}`);
    });
  }, 2 * 60 * 1000); // Check after 2 minutes
}

/**
 * Main function to run the complete deep research process
 */
async function runCompleteDeepResearch() {
  await log('=== Starting Complete Deep Research Process ===');
  await log(`Request ID: ${requestId}`);
  
  try {
    // Set up research options
    const options = {
      systemPrompt: "You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources when possible.",
      temperature: 0.2,
      maxTokens: 4000,
      searchContext: "high"
    };
    
    // Initiate the research
    const result = await initiateDeepResearch(query, options);
    
    if (result.status === 'polling_required') {
      await log('Deep research requires polling. Setting up background checks...');
      
      // Schedule background checks
      scheduleStatusCheck(result.pollUrl, requestId);
      
      await log(`Research initiated successfully! Request ID: ${requestId}`);
      await log('The research will continue in the background.');
      await log(`You can check the status later with: node check-deep-research-status.js`);
      await log(`Or view the report: node collect-deep-research-results.js`);
    } else if (result.status === 'completed') {
      await log('Deep research completed synchronously!');
    }
    
  } catch (error) {
    await log(`Error in deep research process: ${error.message}`);
  } finally {
    await log('=== Complete Deep Research Process Finished ===');
  }
}

// Run the process
runCompleteDeepResearch();