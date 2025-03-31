#!/bin/bash

# Run the coverage report generator script
echo "Running test coverage report generator..."
node --experimental-modules scripts/generate-coverage-report.js

# Check if the report was generated
if [ -f "coverage/coverage-summary.md" ]; then
  echo "Coverage report generated successfully."
  echo "See coverage/coverage-summary.md for the report."
else
  echo "Failed to generate coverage report."
  exit 1
fi