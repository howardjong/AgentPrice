#!/bin/bash

# Script for running query workflow tests in CI environment
# This script ensures that only mock API calls are used, never live ones

# Set environment variable to force mock mode
export USE_LIVE_APIS=false

# Output header
echo "=============================================="
echo "Running Single Query Workflow Test (MOCK MODE)"
echo "=============================================="

# Run the test
npx vitest run tests/vitest/workflows/single-query-workflow.vitest.js

# Check exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Single Query Workflow Test passed!"
else
  echo "❌ Single Query Workflow Test failed!"
  exit $EXIT_CODE
fi

# Show a warning message about live mode
echo ""
echo "⚠️  NOTE: CI/CD pipeline always uses MOCK MODE for API calls."
echo "   If you need to test with live APIs, use:"
echo "   node scripts/run-query-workflow-test.js --live"
echo ""

exit 0