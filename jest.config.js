export default {
  testEnvironment: 'jsdom',
  testMatch: [
    '**/src/**/__tests__/**/*.test.js',
    '**/netlify/functions/**/__tests__/**/*.test.js'
  ],
  moduleFileExtensions: ['js', 'mjs'],
  transform: {},
  collectCoverageFrom: [
    'src/**/*.js',
    'netlify/functions/**/*.js',
    '!src/**/__tests__/**',
    '!netlify/functions/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
