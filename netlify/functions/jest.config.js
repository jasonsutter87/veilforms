export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'mjs'],
  transform: {},
  collectCoverageFrom: [
    'lib/**/*.js',
    '*.js',
    '!node_modules/**',
    '!__tests__/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
