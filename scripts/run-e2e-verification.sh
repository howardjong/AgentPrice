#!/bin/bash

# End-to-End Verification Script
# This script runs a quick verification of the system functionality post-merge

# Set up colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running End-to-End Verification Tests${NC}"
echo "================================="
echo ""

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to run a test and report result
run_test() {
  local test_name="$1"
  local command="$2"
  local log_file="logs/${test_name// /_}_$(date +%Y%m%d_%H%M%S).log"
  
  echo -e "🔍 Running ${YELLOW}$test_name${NC}..."
  
  # Run the command and capture output and exit code
  eval "$command" > "$log_file" 2>&1
  local exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    echo -e "✅ ${GREEN}PASSED:${NC} $test_name"
  else
    echo -e "❌ ${RED}FAILED:${NC} $test_name (see $log_file for details)"
    echo -e "  Last 3 lines of logs:"
    tail -n 3 "$log_file" | sed 's/^/    /'
  fi
  
  return $exit_code
}

echo "Running System Health Check..."
run_test "System Health Check" "node scripts/system-health-monitor.js --once"
health_status=$?

echo -e "\nChecking Socket.IO Functionality..."
run_test "Basic Socket.IO Test" "npx vitest run tests/unit/websocket/basic-socketio.vitest.js"
socketio_status=$?

echo -e "\nChecking Reconnection Handling..."
run_test "Socket.IO Reconnection Test" "npx vitest run tests/unit/websocket/optimized-reconnect-test.vitest.js"
reconnect_status=$?

echo -e "\nChecking Search Utils Coverage..."
run_test "SearchUtils Coverage Check" "node run-searchutils-coverage.js"
coverage_status=$?

echo -e "\nChecking End-to-End Query Flow..."
# Create if test file doesn't exist yet
if [ ! -f "tests/e2e/single-query-flow-test.js" ]; then
  echo -e "${YELLOW}End-to-End Query Flow test not found, skipping...${NC}"
  echo "Consider creating this test for a complete verification."
  query_status=0
else
  run_test "End-to-End Query Flow Test" "node tests/e2e/single-query-flow-test.js"
  query_status=$?
fi

# Summarize results
echo -e "\n${YELLOW}Verification Results Summary${NC}"
echo "================================="

total_tests=4
if [ -f "tests/e2e/single-query-flow-test.js" ]; then
  total_tests=5
fi

passed_tests=$((total_tests - $(( health_status + socketio_status + reconnect_status + coverage_status + query_status ))))

echo -e "Tests Run: $total_tests"
echo -e "Tests Passed: ${GREEN}$passed_tests${NC}"
echo -e "Tests Failed: ${RED}$((total_tests - passed_tests))${NC}"

if [ $passed_tests -eq $total_tests ]; then
  echo -e "\n${GREEN}✅ All verification tests passed!${NC}"
  echo "The system appears to be functioning correctly post-merge."
  echo "You can now begin the 48-hour monitoring period:"
  echo "  ./scripts/run-48h-monitoring.sh"
else
  echo -e "\n${RED}❌ Some verification tests failed!${NC}"
  echo "Please review the logs and fix any issues before starting the monitoring period."
fi

exit $((total_tests - passed_tests))