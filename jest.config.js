
// Creating a configuration file for Jest with ES modules support
// For ESM, we use export default instead of module.exports
export default {
  testEnvironment: 'node',
  // Enable experimental ESM support
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.jsx?$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(cls-hooked|winston)/)'
  ],
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  testMatch: ['**/tests/**/*.test.js'],
  // Setup files for ESM
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: ["/node_modules/"],
  // Explicitly tell Jest to use ESM for TS files
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  
  // Run problematic tests in their own process to prevent module teardown issues
  // This helps with the "You are trying to `import` a file after the Jest environment has been torn down" error
  runner: 'jest-runner',
  projects: [
    {
      // Main test setup for most tests
      displayName: 'main',
      testMatch: ['**/tests/**/*.test.js'],
      testPathIgnorePatterns: [
        "/node_modules/", 
        "tests/unit/services/researchService.test.js",
        "tests/integration/workflow/research.test.js"
      ]
    },
    {
      // Isolated process for problematic research service tests
      displayName: 'research-tests',
      testMatch: [
        "**/tests/unit/services/researchService.test.js",
        "**/tests/integration/workflow/research.test.js"
      ],
      // Run these tests in a separate process
      runner: 'jest-runner',
      runInBand: true,
      maxWorkers: 1,
    }
  ]
}
