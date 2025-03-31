// Test script to examine failures
const Vitest = require('vitest');

// Run specific test file and output detailed results
async function main() {
  try {
    const result = await Vitest.startVitest('run', ['tests/unit/services/router.vitest.js'], {
      reporters: ['verbose']
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

main().catch(console.error);