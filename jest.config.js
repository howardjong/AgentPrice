
// Creating a CommonJS configuration file for Jest
// This works better with projects configured as ESM
// In CommonJS modules, the top-level this is not defined so we use module.exports
module.exports = {
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
  // Remove setupFiles since it's causing issues with ESM
  // setupFiles: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: ["/node_modules/"]
}
