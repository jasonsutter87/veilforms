export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/src/**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'mjs'],
  transform: {},
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
