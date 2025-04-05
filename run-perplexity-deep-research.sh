#!/bin/bash

# Run Perplexity Deep Research in the background
# This script will run the deep research process and handle the timeouts
# It runs in the background and logs to a file

# Add timestamp to log messages
timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

# Log file
LOG_FILE="perplexity-deep-research-job-$(date +%Y%m%d-%H%M%S).log"

echo "$(timestamp) Starting Perplexity Deep Research job" > "$LOG_FILE"
echo "$(timestamp) Log file: $LOG_FILE" >> "$LOG_FILE"

# Check for environment variable and log path
if [ -z "$PERPLEXITY_API_KEY" ]; then
  echo "$(timestamp) ERROR: PERPLEXITY_API_KEY environment variable is not set." >> "$LOG_FILE"
  exit 1
fi

echo "$(timestamp) PERPLEXITY_API_KEY is set" >> "$LOG_FILE"

# Run the simplified deep research script with timeout protection
echo "$(timestamp) Running enhanced-polling-deep-research.js with 3600 second timeout" >> "$LOG_FILE"

# Using timeout command to prevent infinite waits
timeout 3600 node enhanced-polling-deep-research.js >> "$LOG_FILE" 2>&1
TIMEOUT_EXIT=$?

if [ $TIMEOUT_EXIT -eq 124 ]; then
  echo "$(timestamp) WARNING: Command timed out after 3600 seconds" >> "$LOG_FILE"
  echo "$(timestamp) This is expected for deep research which may take up to 30 minutes" >> "$LOG_FILE"
  echo "$(timestamp) Check deep-research-results directory for poll data files" >> "$LOG_FILE"
elif [ $TIMEOUT_EXIT -ne 0 ]; then
  echo "$(timestamp) ERROR: Command failed with exit code $TIMEOUT_EXIT" >> "$LOG_FILE"
else
  echo "$(timestamp) Command completed successfully" >> "$LOG_FILE"
fi

# Run the polling checker after 10 minutes
echo "$(timestamp) Waiting 10 minutes before checking poll status..." >> "$LOG_FILE"
sleep 600

echo "$(timestamp) Running check-deep-research-status.js" >> "$LOG_FILE"
node check-deep-research-status.js >> "$LOG_FILE" 2>&1
CHECK_EXIT=$?

if [ $CHECK_EXIT -ne 0 ]; then
  echo "$(timestamp) WARNING: Status check failed with exit code $CHECK_EXIT" >> "$LOG_FILE"
else
  echo "$(timestamp) Status check completed successfully" >> "$LOG_FILE"
fi

# Create a report of all results
echo "$(timestamp) Creating final report" >> "$LOG_FILE"
node collect-deep-research-results.js >> "$LOG_FILE" 2>&1
REPORT_EXIT=$?

if [ $REPORT_EXIT -ne 0 ]; then
  echo "$(timestamp) WARNING: Report creation failed with exit code $REPORT_EXIT" >> "$LOG_FILE"
else
  echo "$(timestamp) Report created successfully" >> "$LOG_FILE"
fi

echo "$(timestamp) Job complete. Check deep-research-report.md for results." >> "$LOG_FILE"
echo "$(timestamp) Results will also be available in deep-research-results directory." >> "$LOG_FILE"