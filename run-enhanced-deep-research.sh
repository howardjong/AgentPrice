#!/bin/bash

# Run Enhanced Deep Research Test in the background
# This script will run the test and handle timeouts appropriately

# Add timestamp to log messages
timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

# Log file
LOG_FILE="enhanced-deep-research-job-$(date +%Y%m%d-%H%M%S).log"

echo "$(timestamp) Starting Enhanced Deep Research job" | tee -a "$LOG_FILE"
echo "$(timestamp) Log file: $LOG_FILE" | tee -a "$LOG_FILE"

# Check for environment variable
if [ -z "$PERPLEXITY_API_KEY" ]; then
  echo "$(timestamp) ERROR: PERPLEXITY_API_KEY environment variable is not set." | tee -a "$LOG_FILE"
  exit 1
fi

echo "$(timestamp) PERPLEXITY_API_KEY is set" | tee -a "$LOG_FILE"

# Create necessary directories
mkdir -p test-results/deep-research
mkdir -p test-results/deep-research-completed

# Run the enhanced deep research script with timeout protection
echo "$(timestamp) Running enhanced-deep-research-test.js with 3600 second timeout" | tee -a "$LOG_FILE"

# Using timeout command to prevent infinite waits
timeout 3600 node enhanced-deep-research-test.js >> "$LOG_FILE" 2>&1
TIMEOUT_EXIT=$?

# Check the exit code
if [ $TIMEOUT_EXIT -eq 124 ]; then
  # 124 is the exit code when timeout kills the process
  echo "$(timestamp) Process timed out after 3600 seconds" | tee -a "$LOG_FILE"
  echo "$(timestamp) Check $LOG_FILE for more details" | tee -a "$LOG_FILE"
elif [ $TIMEOUT_EXIT -ne 0 ]; then
  echo "$(timestamp) Process failed with exit code $TIMEOUT_EXIT" | tee -a "$LOG_FILE"
  echo "$(timestamp) Check $LOG_FILE for more details" | tee -a "$LOG_FILE"
else
  echo "$(timestamp) Process completed successfully" | tee -a "$LOG_FILE"
fi

echo "$(timestamp) Job complete. Log file: $LOG_FILE" | tee -a "$LOG_FILE"