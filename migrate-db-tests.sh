#!/bin/bash

# Database Test Migration Script
# This script runs the Jest to Vitest migration for database tests

# Set colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}======================================"
echo -e "  DATABASE TEST MIGRATION TO VITEST"
echo -e "======================================${NC}"
echo ""

# Run the migration script
echo -e "${CYAN}Running migration script...${NC}"
node scripts/migrate-db-tests-to-vitest.js

# Check the result
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}Migration script completed successfully.${NC}"
  
  echo -e "\n${YELLOW}Next steps:${NC}"
  echo -e "${YELLOW}1. Run the migrated tests to verify they work correctly${NC}"
  echo -e "${YELLOW}2. Check for any remaining Jest-specific code that needs manual updates${NC}"
  echo -e "${YELLOW}3. Update any imports or requires that might need adjustment${NC}"
  echo -e "${YELLOW}4. Review test timeouts and async handling${NC}"
  
  echo -e "\n${CYAN}To run the migrated tests, use: ./run-db-tests.sh${NC}"
  
  exit 0
else
  echo -e "\n${RED}Migration script failed.${NC}"
  exit 1
fi