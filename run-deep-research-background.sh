#!/bin/bash
# Run Deep Research in Background
# This script initiates a deep research request and runs it in the background

# Generate a timestamp
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="perplexity-deep-research-job-$TIMESTAMP.log"

echo "Starting Perplexity deep research job at $TIMESTAMP"
echo "Output will be logged to $LOG_FILE"

# Run the deep research script in the background
nohup node enhanced-polling-deep-research.js > "$LOG_FILE" 2>&1 &

# Capture the process ID
PID=$!
echo "Process ID: $PID"
echo "Process ID: $PID" >> "$LOG_FILE"

echo "Job started in background. Check $LOG_FILE for progress."
echo "You can also run 'check-deep-research-status.js' later to see the results."