/**
 * Simple Perplexity API Test
 * 
 * This script tests the basic Perplexity API functionality with a simple query
 * using the standard 'sonar' model instead of the deep research model.
 */

// Use wrapper to handle potential ESM/CJS compatibility issues
let perplexityService;
let uuidv4;
let fs;

// Initialize dependencies with explicit error handling
async function initDependencies() {
  try {
    // Import perplexityService (handle both ESM and default exports)
    const perplexityModule = await import('./services/perplexityService.js');
    perplexityService = perplexityModule.default || perplexityModule;
    
    // Import uuid
    const uuidModule = await import('uuid');
    uuidv4 = uuidModule.v4;
    
    // Import fs
    const fsModule = await import('fs/promises');
    fs = fsModule.default || fsModule;
    
    return true;
  } catch (error) {
    console.error(`Failed to initialize dependencies: ${error.message}`);
    return false;
  }
}

// Configuration
const TEST_TIMEOUT = 30000; // 30 seconds timeout for the test
const STANDARD_MODEL = 'sonar'; // Using standard model to avoid timeouts

async function runTest() {
  const output = [];
  
  function log(message) {
    console.log(message);
    output.push(message);
  }
  
  log('======= PERPLEXITY API TEST =======');
  log('Testing standard search (non-deep research)');
  log(`Using model: ${STANDARD_MODEL}`);
  log('Query: "What is JavaScript?"');
  
  const testId = uuidv4().substring(0, 8);
  log('Test ID:', testId);
  
  // Check if Perplexity API key is available
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  log('Perplexity API Key available:', perplexityKey ? 'Yes' : 'No');
  
  // Check service status
  try {
    const serviceStatus = perplexityService.getStatus ? perplexityService.getStatus() : 'Status check not available';
    log('Perplexity Service Status:', serviceStatus);
  } catch (error) {
    log('Error checking service status:', error.message);
  }
  
  const startTime = Date.now();
  
  try {
    // Set a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timed out')), TEST_TIMEOUT)
    );
    
    // Run the actual query
    const queryPromise = perplexityService.processWebQuery(
      'What is JavaScript?', 
      {
        model: STANDARD_MODEL,
        fullResponse: true,
        maxTokens: 500
      }
    );
    
    // Race the query against the timeout
    const response = await Promise.race([queryPromise, timeoutPromise]);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log('\n✅ Test completed successfully');
    log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
    
    // Validate model information
    log('\nModel Information:');
    log(`- Model requested: ${STANDARD_MODEL}`);
    log(`- Model used: ${response.model || 'unknown'}`);
    log(`- Model match: ${response.model === STANDARD_MODEL ? '✓' : '❌'}`);
    
    // Response information
    log('\nResponse Information:');
    log(`- Content length: ${response.content ? response.content.length : 0} characters`);
    
    // Content sample
    if (response.content) {
      const contentPreview = response.content.substring(0, 150) + '...';
      log('\nContent Preview:');
      log(contentPreview);
    }
    
    // Save output to file
    try {
      await fs.writeFile('perplexity-test-output.txt', output.join('\n'));
      log('\nTest output written to perplexity-test-output.txt');
    } catch (error) {
      log(`Error writing output file: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    log('\n❌ Test failed:');
    log(`Error: ${error.message}`);
    
    if (error.response) {
      log('API Response Error:');
      log(`Status: ${error.response.status}`);
      log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    // Save error output to file too
    try {
      await fs.writeFile('perplexity-test-error-output.txt', output.join('\n'));
      log('\nError output written to perplexity-test-error-output.txt');
    } catch (writeError) {
      log(`Error writing output file: ${writeError.message}`);
    }
    
    return false;
  } finally {
    log('\n================================');
  }
}

// Wrapped runner function to initialize dependencies and then run test
async function runWrappedTest() {
  try {
    console.log('Starting Perplexity API test...');
    
    // Initialize dependencies first
    console.log('Initializing dependencies...');
    const initialized = await initDependencies();
    if (!initialized) {
      console.error('Failed to initialize dependencies. Exiting test.');
      
      // Write error to file directly
      try {
        const fs = require('fs');
        fs.writeFileSync('perplexity-init-error.txt', 'Failed to initialize dependencies');
      } catch (e) {}
      
      return false;
    }
    
    console.log('Dependencies initialized successfully.');
    console.log('Running test...');
    
    return await runTest();
  } catch (error) {
    console.error('Unexpected error in test wrapper:', error);
    
    // Write error to file directly
    try {
      const fs = require('fs');
      fs.writeFileSync('perplexity-fatal-error.txt', `Fatal error: ${error.message}\n${error.stack}`);
    } catch (e) {}
    
    return false;
  }
}

// Run the test if executed directly
if (process.argv[1] === import.meta.url) {
  runWrappedTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runWrappedTest as runTest };