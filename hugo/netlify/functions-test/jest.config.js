import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const functionsDir = resolve(__dirname, '../functions');

export default {
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'mjs'],
  transform: {},
  moduleNameMapper: {
    '^\\.\\./(lib/.*)$': `${functionsDir}/$1`,
    '^\\.\\./(auth-.*)$': `${functionsDir}/$1`,
    '^\\.\\./(forms-.*)$': `${functionsDir}/$1`,
    '^\\.\\./(forms\\.js)$': `${functionsDir}/$1`,
    '^\\.\\./(api-keys\\.js)$': `${functionsDir}/$1`,
    '^\\.\\./(audit-logs\\.js)$': `${functionsDir}/$1`,
    '^\\.\\./(retention-cleanup\\.js)$': `${functionsDir}/$1`
  },
  collectCoverageFrom: [
    '../functions/lib/**/*.js',
    '../functions/*.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: './coverage',
  verbose: true
};
