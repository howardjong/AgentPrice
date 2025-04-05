#!/bin/bash

# This script runs the single-query workflow test with Vitest

# Set environment variables for real API testing
export USE_REAL_APIS=true
export ENABLE_LIVE_API_TESTS=true

# Run the specific test with an extended timeout (5 minutes)
# Note: --testTimeout is the correct option, not --timeout
npx vitest run tests/unit/workflows/enhanced-single-query-workflow.vitest.js -t "should complete a basic workflow with real APIs" --testTimeout 300000