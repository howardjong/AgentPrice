#!/bin/bash
# Script to run Perplexity deep research tests

set -e

# Create output directories
mkdir -p test-results/deep-research
mkdir -p test-results/deep-research-workflow

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for API key
if [ -z "$PERPLEXITY_API_KEY" ]; then
  echo -e "${RED}ERROR: PERPLEXITY_API_KEY environment variable is not set.${NC}"
  echo "Please set it with: export PERPLEXITY_API_KEY=your_api_key_here"
  exit 1
fi

echo -e "${GREEN}Perplexity API key detected.${NC}"

# Get test mode from command line
TEST_MODE=${1:-"all"}

# Function to run a test with proper logging
run_test() {
  local test_script="$1"
  local test_name="$2"
  
  echo ""
  echo -e "${YELLOW}=== Running $test_name ===${NC}"
  echo ""
  
  node "$test_script"
  
  if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ $test_name completed successfully${NC}"
    echo ""
  else
    echo ""
    echo -e "${RED}❌ $test_name failed${NC}"
    echo ""
  fi
}

# Run tests based on mode
case "$TEST_MODE" in
  "direct")
    echo -e "${YELLOW}Running direct API tests only${NC}"
    run_test "perplexity-deep-research-polled-test.js" "Deep Research Polled Test"
    ;;
    
  "workflow")
    echo -e "${YELLOW}Running workflow tests only${NC}"
    # Set USE_MOCK_JOB_MANAGER=true for easier testing without Redis
    export USE_MOCK_JOB_MANAGER=true
    run_test "test-deep-research-job-workflow.js" "Deep Research Job Workflow Test"
    ;;
    
  "all")
    echo -e "${YELLOW}Running all tests${NC}"
    run_test "simple-perplexity-initial-research-test.js" "Initial Research Test"
    run_test "perplexity-deep-research-polled-test.js" "Deep Research Polled Test"
    
    # Set USE_MOCK_JOB_MANAGER=true for easier testing without Redis
    export USE_MOCK_JOB_MANAGER=true
    run_test "test-deep-research-job-workflow.js" "Deep Research Job Workflow Test"
    ;;
    
  *)
    echo -e "${RED}Unknown test mode: $TEST_MODE${NC}"
    echo "Usage: $0 [direct|workflow|all]"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}=== All tests completed ===${NC}"
echo "Results are available in test-results/ directory"