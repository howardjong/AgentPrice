#!/bin/bash
# Script to run Socket.IO tests with DEBUG flag

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/socketio-test-${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo "Running Socket.IO tests with DEBUG flag..."
echo "================================================="

# Run tests with DEBUG flag
DEBUG=socket.io*,true npx vitest run tests/unit/websocket/basic-socketio.vitest.js --reporter verbose | tee $LOG_FILE

exit_code=$?

echo "Log file: $LOG_FILE"
echo "================================================="

exit $exit_code