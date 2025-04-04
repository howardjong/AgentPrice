#!/bin/bash
# Script to run dual-mode tests

MODE=${1:-mock}  # Default to mock mode if no argument provided
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/dual-mode-test-${MODE}-${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo "Running tests in ${MODE^} API mode..."
echo "================================================="

if [ "$MODE" = "live" ]; then
  # Run tests with live API
  USE_LIVE_API=true npx vitest run tests/vitest/workflows/dual-mode-query-workflow.vitest.js --reporter verbose | tee $LOG_FILE
else
  # Run tests with mock API (default)
  USE_LIVE_API=false npx vitest run tests/vitest/workflows/dual-mode-query-workflow.vitest.js --reporter verbose | tee $LOG_FILE
fi

exit_code=$?

echo "Log file: $LOG_FILE"
echo "================================================="

exit $exit_code