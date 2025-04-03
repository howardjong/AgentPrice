#!/bin/bash

# Database Tests Runner Script
# This script runs database tests with proper setup and teardown

# Set colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}======================================"
echo -e "         DATABASE TESTS RUNNER"
echo -e "======================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL}" ]; then
  echo -e "${RED}ERROR: DATABASE_URL environment variable is not set.${NC}"
  echo -e "Make sure you have a PostgreSQL database configured."
  exit 1
fi

# Check database connection
echo -e "${CYAN}Checking database connection...${NC}"
npx tsx -e "
const pg = require('postgres');
const client = pg('${DATABASE_URL}', { ssl: false });
async function check() {
  try {
    const result = await client\`SELECT 1 as check\`;
    if (result[0].check === 1) {
      console.log('Database connection successful!');
      process.exit(0);
    } else {
      console.error('Database connection test failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
check();
"

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to connect to the database.${NC}"
  echo -e "Please check your DATABASE_URL and make sure the database is running."
  exit 1
fi

echo -e "${GREEN}Database connection successful.${NC}\n"

# Run the tests with coverage
echo -e "${CYAN}Running database tests...${NC}"
npx vitest run tests/storage/ --coverage

# Check the result
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}Database tests completed successfully.${NC}"
  
  # Show coverage report if available
  if [ -d "coverage" ]; then
    echo -e "\n${YELLOW}Coverage Report:${NC}"
    echo -e "${CYAN}Check the coverage/index.html file for detailed report.${NC}"
  fi
  
  exit 0
else
  echo -e "\n${RED}Database tests failed.${NC}"
  exit 1
fi