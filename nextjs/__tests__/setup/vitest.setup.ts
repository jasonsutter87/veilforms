import '@testing-library/jest-dom/vitest';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock crypto for Node.js environment
if (typeof global.crypto === 'undefined' || !global.crypto.getRandomValues) {
  const nodeCrypto = await import('crypto');
  global.crypto = {
    getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
      if (arr instanceof Uint8Array) {
        const bytes = nodeCrypto.randomBytes(arr.length);
        arr.set(bytes);
      }
      return arr;
    },
    subtle: nodeCrypto.webcrypto.subtle,
    randomUUID: () => nodeCrypto.randomUUID(),
  } as Crypto;
}

// Mock Next.js server components
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
  };
});

// Set test environment variables
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-min-32-chars';
  process.env.NODE_ENV = 'test';
  process.env.NETLIFY_BLOBS_CONTEXT = 'dev';
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global teardown
afterAll(() => {
  vi.restoreAllMocks();
});
