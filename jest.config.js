
// Creating a configuration file for Jest with ES modules support
// For ESM, we use export default instead of module.exports
export default {
  testEnvironment: 'node',
  // Enable experimental ESM support
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
  extensionsToTreatAsEsm: ['.ts', '.tsx']
}
