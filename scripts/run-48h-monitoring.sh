#!/bin/bash

# 48-Hour Monitoring Script
# This script runs health checks on a schedule for 48 hours
# and logs results to the monitoring report

# Set up colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create logs directory if it doesn't exist
mkdir -p logs
mkdir -p reports

# Setup monitoring report file
REPORT_FILE="reports/48h-monitoring-report-$(date +%Y%m%d_%H%M%S).md"

# Initialize report
cat > "$REPORT_FILE" << EOF
# 48-Hour Monitoring Report

**Start Time:** $(date)
**End Time:** (in progress)

## Monitoring Summary

This report contains the results of the 48-hour monitoring period following
the Socket.IO optimizations and Jest to Vitest migration.

## Health Check Results

| Timestamp | Check Type | Status | Details |
|-----------|------------|--------|---------|
EOF

# Function to log a message to the console and the report
log_message() {
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  local check_type="$1"
  local status="$2"
  local details="$3"
  
  # Log to console
  if [ "$status" == "PASSED" ]; then
    echo -e "${GREEN}[$timestamp] ✅ $check_type: $status${NC} - $details"
  elif [ "$status" == "WARNING" ]; then
    echo -e "${YELLOW}[$timestamp] ⚠️ $check_type: $status${NC} - $details"
  else
    echo -e "${RED}[$timestamp] ❌ $check_type: $status${NC} - $details"
  fi
  
  # Log to report
  echo "| $timestamp | $check_type | $status | $details |" >> "$REPORT_FILE"
}

# Function to run a health check
run_health_check() {
  local check_type="$1"
  local command="$2"
  local log_file="logs/${check_type// /_}_$(date +%Y%m%d_%H%M%S).log"
  
  echo -e "${BLUE}Running $check_type check...${NC}"
  
  # Run the command and capture output and exit code
  eval "$command" > "$log_file" 2>&1
  local exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    log_message "$check_type" "PASSED" "All checks completed successfully"
  else
    # Extract error messages from the log
    local error_summary=$(grep -i "error\|fail\|timeout" "$log_file" | head -n 2 | tr '\n' ' ')
    if [ -z "$error_summary" ]; then
      error_summary="Unknown error, check $log_file for details"
    fi
    log_message "$check_type" "FAILED" "$error_summary"
  fi
}

# Calculate end time (48 hours from now)
END_TIME=$(date -d "+48 hours" +%s)

# Display start message
echo -e "${YELLOW}Starting 48-Hour Monitoring Period${NC}"
echo "================================================="
echo -e "Monitoring will run until: ${BLUE}$(date -d "@$END_TIME")${NC}"
echo -e "Monitoring report will be saved to: ${BLUE}$REPORT_FILE${NC}"
echo "================================================="
echo ""

# Counter for monitoring iterations
ITERATION=1

# Main monitoring loop
while [ $(date +%s) -lt $END_TIME ]; do
  echo -e "\n${YELLOW}Monitoring Iteration #$ITERATION${NC} - $(date)"
  echo "------------------------------------------------"
  
  # Run system health check
  run_health_check "System Health" "node scripts/system-health-monitor.js --once"
  
  # Every 2 hours, run socket health check
  if [ $((ITERATION % 8)) -eq 0 ]; then
    run_health_check "Socket.IO Health" "node tests/unit/websocket/socket-io-health-check.js"
  fi
  
  # Every 4 hours, run end-to-end test
  if [ $((ITERATION % 16)) -eq 0 ]; then
    run_health_check "End-to-End Flow" "node tests/e2e/single-query-flow-test.js"
  fi
  
  # Every 12 hours, check test coverage
  if [ $((ITERATION % 48)) -eq 0 ]; then
    run_health_check "Coverage Check" "node run-searchutils-coverage.js"
  fi
  
  # Wait for the next check (15 minutes)
  echo -e "${BLUE}Waiting 15 minutes until next check...${NC}"
  sleep 900  # 15 minutes in seconds
  
  # Increment iteration counter
  ITERATION=$((ITERATION + 1))
done

# Update report with end time
sed -i "s/\*\*End Time:\*\* (in progress)/\*\*End Time:\*\* $(date)/" "$REPORT_FILE"

# Add summary section to report
cat >> "$REPORT_FILE" << EOF

## Monitoring Summary

Monitoring completed successfully after 48 hours.

### Statistics
- Total checks run: $((ITERATION - 1))
- System health checks: $((ITERATION - 1))
- Socket.IO health checks: $((ITERATION / 8))
- End-to-end flow checks: $((ITERATION / 16))
- Coverage checks: $((ITERATION / 48))

### Conclusion

The 48-hour monitoring period is now complete. Based on the results above,
the team should review any failures or warnings and determine if the Socket.IO
optimizations and Jest to Vitest migration can be considered stable for production.

EOF

# Display end message
echo -e "\n${GREEN}48-Hour Monitoring Period Complete!${NC}"
echo "================================================="
echo -e "Monitoring report saved to: ${BLUE}$REPORT_FILE${NC}"
echo "Please review the report for any issues that need attention."
echo ""