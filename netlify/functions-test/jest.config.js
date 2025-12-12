export default {
  testEnvironment: 'node',
  rootDir: '../functions',
  testMatch: ['<rootDir>/../functions-test/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'mjs'],
  transform: {},
  collectCoverageFrom: [
    '<rootDir>/lib/**/*.js',
    '<rootDir>/*.js',
    '!<rootDir>/node_modules/**'
  ],
  coverageDirectory: '../functions-test/coverage',
  verbose: true
};
