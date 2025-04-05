#!/bin/bash

# Run Deep Research Background Process
# This script runs the deep research test in the background and logs outputs

echo "Starting deep research test in background mode..."
echo "Output will be logged to perplexity-deep-research-job-*.log"

# Create directories for results if they don't exist
mkdir -p test-results/deep-research
mkdir -p test-results/deep-research-results

# Execute the test script in the background
node complete-perplexity-deep-research.cjs &

# Store the process ID
PID=$!
echo "Process started with PID: $PID"
echo "To check status, run: cat perplexity-deep-research-job-*.log | tail -50"

# Write PID to a file for later reference
echo $PID > deep-research-process.pid

echo "Deep research test is now running in the background."
echo "It may take up to 30 minutes to complete."
echo "View progress by checking the log file."