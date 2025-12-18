import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup/vitest.setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/app/api/__tests__/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'e2e',
      '.next',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/hooks/**/*.ts',
        'src/store/**/*.ts',
        'src/components/**/*.tsx',
        'src/app/api/**/*.ts',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/index.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    reporters: ['verbose'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
