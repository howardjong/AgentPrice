#!/bin/bash

# Create directories
mkdir -p test-results
mkdir -p logs

# Get timestamp for log file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/deep-research-${TIMESTAMP}.log"

# First verify that the script exists
if [ ! -f "complete-perplexity-deep-research.cjs" ]; then
  echo "ERROR: complete-perplexity-deep-research.cjs not found!"
  exit 1
fi

# Test that the environment variables are available to the script
echo "Testing environment variables..."
API_KEY_STATUS=$(node -e "console.log(process.env.PERPLEXITY_API_KEY ? 'API key is available' : 'API key is NOT available')")
echo "$API_KEY_STATUS"

if [[ "$API_KEY_STATUS" != *"available"* ]]; then
  echo "ERROR: Perplexity API key is not available. Cannot start the deep research script."
  exit 1
fi

# Run a simple test first to ensure everything is working
echo "Running a quick test to verify functionality..."
node -e "
const axios = require('axios');
const apiKey = process.env.PERPLEXITY_API_KEY;
if (!apiKey) {
  console.error('API key not available');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': \`Bearer \${apiKey}\`
};

console.log('Sending test request to Perplexity API...');
axios.post('https://api.perplexity.ai/chat/completions', {
  model: 'llama-3.1-sonar-small-128k-online',
  messages: [{role: 'user', content: 'Hello, testing API connection'}],
  max_tokens: 50
}, { headers })
  .then(res => {
    console.log('Test successful! API is working.');
  })
  .catch(err => {
    console.error('Test failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data));
    }
    process.exit(1);
  });
" || { echo "API test failed, cannot continue"; exit 1; }

# Run the deep research script in the background and save output to a file
echo "Starting deep research script in background..."
nohup node complete-perplexity-deep-research.cjs > "${LOG_FILE}" 2>&1 &

# Get the process ID
PID=$!
echo "Script started with PID: $PID"
echo "Output is being saved to ${LOG_FILE}"
echo "You can check progress using: tail -f ${LOG_FILE}"
echo "Results will be saved in the test-results directory"
echo "Process will continue running in the background even after this script exits"

# Create a symbolic link to latest log for convenience
ln -sf "${LOG_FILE}" latest-deep-research.log
echo "For convenience, latest log is also available at: latest-deep-research.log"

# Check if the process started successfully
sleep 2
if kill -0 $PID 2>/dev/null; then
  echo "Process is running successfully."
else
  echo "WARNING: Process may have terminated. Check logs for details."
fi