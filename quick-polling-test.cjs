/**
 * Quick Polling Test for Perplexity Deep Research
 * Using CommonJS format to avoid ESM issues
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const LOG_FILE = 'perplexity-quick-poll-test.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  fs.appendFileSync(LOG_FILE, `${logMessage}\n`);
}

async function testDeepResearch() {
  try {
    log('=== Starting Quick Polling Test ===');
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set');
    }
    
    const requestData = {
      model: DEEP_RESEARCH_MODEL,
      messages: [
        { 
          role: 'user', 
          content: 'What are the current pricing strategies used by SaaS companies in 2025?' 
        }
      ],
      max_tokens: 500,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    log(`Sending deep research request to ${PERPLEXITY_API_URL}`);
    log(`Model: ${DEEP_RESEARCH_MODEL}`);
    
    const response = await axios.post(PERPLEXITY_API_URL, requestData, {
      headers,
      timeout: 20000 // 20 second timeout for initial request
    });
    
    log(`Received response with status code: ${response.status}`);
    
    // Save the response to a file
    fs.writeFileSync('deep-research-response.json', JSON.stringify(response.data, null, 2));
    log('Response saved to deep-research-response.json');
    
    // Check for poll_url indicating successful deep research
    if (response.data && response.data.poll_url) {
      log(`Deep research is working! Poll URL: ${response.data.poll_url}`);
      
      // Make one poll request to check status
      log('Making one polling request to check status...');
      
      const pollResponse = await axios.get(response.data.poll_url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 10000
      });
      
      log(`Poll response status: ${pollResponse.status}`);
      fs.writeFileSync('poll-response.json', JSON.stringify(pollResponse.data, null, 2));
      log('Poll response saved to poll-response.json');
      
      return {
        success: true,
        message: 'Deep research is working with polling'
      };
    } else {
      log('No poll URL found in response. Deep research may not be working as expected.');
      
      return {
        success: false,
        message: 'Deep research did not return a poll URL'
      };
    }
  } catch (error) {
    log(`ERROR: ${error.message}`);
    
    if (error.response) {
      log(`Status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
      
      fs.writeFileSync('error-response.json', JSON.stringify(error.response.data, null, 2));
      log('Error response saved to error-response.json');
    } else if (error.code === 'ECONNABORTED') {
      log('Request timed out. The API did not respond within the timeout period.');
    }
    
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  } finally {
    log('=== Quick Polling Test Complete ===');
  }
}

// Run the test
testDeepResearch()
  .then(result => {
    log(`Test result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    log(`Message: ${result.message}`);
  })
  .catch(err => {
    log(`Fatal error: ${err.message}`);
  });