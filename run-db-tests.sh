#!/bin/bash

# Run database tests script
# This script runs the database-related tests using Vitest

# Set colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}======================================"
echo -e "       DATABASE TEST RUNNER"
echo -e "======================================${NC}"
echo ""

# Check if PostgreSQL database is available
echo -e "${CYAN}Checking database availability...${NC}"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}DATABASE_URL environment variable not found."
  echo -e "Make sure you have a PostgreSQL database available.${NC}"
  exit 1
fi

# Run the database tests with Vitest
echo -e "\n${CYAN}Running database tests...${NC}"
echo -e "${YELLOW}Executing: npx vitest run tests/storage --coverage${NC}"

# Set environment for testing
export NODE_ENV=test

# Run the tests
npx vitest run tests/storage --coverage

# Check the result
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}======================================"
  echo -e "      DATABASE TESTS SUCCESSFUL"
  echo -e "======================================${NC}"
  exit 0
else
  echo -e "\n${RED}======================================"
  echo -e "        DATABASE TESTS FAILED"
  echo -e "======================================${NC}"
  exit 1
fi