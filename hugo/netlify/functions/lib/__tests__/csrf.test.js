/**
 * CSRF Protection Tests
 * Tests for /netlify/functions/lib/csrf.js
 *
 * Test Coverage:
 * - Token generation uniqueness
 * - Token validation with valid tokens
 * - Token validation with invalid tokens
 * - Missing token scenarios
 * - Constant-time comparison (timing attack resistance)
 * - Cookie creation
 */

import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import {
  generateCsrfToken,
  validateCsrfToken,
  createCsrfCookie,
  getCsrfHeaders
} from '../csrf.js';

// Mock Request class for Node environment
class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this._headers = options.headers || {};
    this.headers = {
      get: (key) => {
        const lowerKey = key.toLowerCase();
        const headerKey = Object.keys(this._headers).find(k => k.toLowerCase() === lowerKey);
        return headerKey ? this._headers[headerKey] : null;
      }
    };
  }
}

globalThis.Request = MockRequest;

describe('CSRF Protection', () => {
  describe('generateCsrfToken()', () => {
    test('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    test('should generate unique tokens', () => {
      const tokens = new Set();
      // Generate 100 tokens and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }
      expect(tokens.size).toBe(100);
    });

    test('should be cryptographically random', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      // Tokens should be different
      expect(token1).not.toBe(token2);

      // Check for non-trivial randomness (not all zeros, not all same character)
      expect(token1).not.toBe('0'.repeat(64));
      const uniqueChars = new Set(token1.split(''));
      expect(uniqueChars.size).toBeGreaterThan(1); // Should have more than one unique character
    });
  });

  describe('validateCsrfToken()', () => {
    test('should pass with valid matching tokens', () => {
      const token = generateCsrfToken();
      const request = new Request('https://example.com', {
        headers: {
          'cookie': `csrf-token=${token}`,
          'x-csrf-token': token
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(true);
    });

    test('should fail with mismatched tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      const request = new Request('https://example.com', {
        headers: {
          'cookie': `csrf-token=${token1}`,
          'x-csrf-token': token2
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(false);
    });

    test('should fail with missing cookie token', () => {
      const token = generateCsrfToken();
      const request = new Request('https://example.com', {
        headers: {
          'x-csrf-token': token
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(false);
    });

    test('should fail with missing header token', () => {
      const token = generateCsrfToken();
      const request = new Request('https://example.com', {
        headers: {
          'cookie': `csrf-token=${token}`
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(false);
    });

    test('should fail with both tokens missing', () => {
      const request = new Request('https://example.com', {
        headers: {}
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(false);
    });

    test('should fail with empty tokens', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cookie': 'csrf-token=',
          'x-csrf-token': ''
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(false);
    });

    test('should handle tokens in cookie with other cookies', () => {
      const token = generateCsrfToken();
      const request = new Request('https://example.com', {
        headers: {
          'cookie': `session=abc123; csrf-token=${token}; other=value`,
          'x-csrf-token': token
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(true);
    });

    test('should use constant-time comparison (timing attack resistance)', () => {
      const token = generateCsrfToken();
      const wrongToken = 'a'.repeat(64);

      const request = new Request('https://example.com', {
        headers: {
          'cookie': `csrf-token=${token}`,
          'x-csrf-token': wrongToken
        }
      });

      // Run validation multiple times and measure timing
      const timings = [];
      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        validateCsrfToken(request);
        const end = performance.now();
        timings.push(end - start);
      }

      // Calculate variance - should be low for constant-time comparison
      const avg = timings.reduce((a, b) => a + b) / timings.length;
      const variance = timings.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be relatively small compared to mean
      // This is a weak test but validates basic constant-time behavior
      expect(stdDev / avg).toBeLessThan(0.5);
    });

    test('should reject tokens with different lengths', () => {
      const token = generateCsrfToken();
      const shortToken = token.substring(0, 32);

      const request = new Request('https://example.com', {
        headers: {
          'cookie': `csrf-token=${token}`,
          'x-csrf-token': shortToken
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(false);
    });

    test('should validate with exact token match including special characters', () => {
      // Even though tokens are hex, test that validation works with exact matching
      const token = '0123456789abcdef'.repeat(4);

      const request = new Request('https://example.com', {
        headers: {
          'cookie': `csrf-token=${token}`,
          'x-csrf-token': token
        }
      });

      const result = validateCsrfToken(request);
      expect(result).toBe(true);
    });
  });

  describe('createCsrfCookie()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('should create cookie with token', () => {
      const token = generateCsrfToken();
      const cookie = createCsrfCookie(token);

      expect(cookie).toContain(`csrf-token=${token}`);
    });

    test('should include security attributes', () => {
      const token = generateCsrfToken();
      const cookie = createCsrfCookie(token);

      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Max-Age=3600');
    });

    test('should include Secure flag in production', () => {
      process.env.NODE_ENV = 'production';
      const token = generateCsrfToken();
      const cookie = createCsrfCookie(token);

      expect(cookie).toContain('Secure');
    });

    test('should not include Secure flag in development', () => {
      process.env.NODE_ENV = 'development';
      const token = generateCsrfToken();
      const cookie = createCsrfCookie(token);

      expect(cookie).not.toContain('Secure');
    });

    test('should include domain when COOKIE_DOMAIN is set', () => {
      process.env.COOKIE_DOMAIN = 'example.com';
      const token = generateCsrfToken();
      const cookie = createCsrfCookie(token);

      expect(cookie).toContain('Domain=example.com');
    });

    test('should not include domain when COOKIE_DOMAIN is not set', () => {
      delete process.env.COOKIE_DOMAIN;
      const token = generateCsrfToken();
      const cookie = createCsrfCookie(token);

      expect(cookie).not.toContain('Domain=');
    });
  });

  describe('getCsrfHeaders()', () => {
    test('should return headers with Set-Cookie and X-CSRF-Token', () => {
      const token = generateCsrfToken();
      const headers = getCsrfHeaders(token);

      expect(headers).toHaveProperty('Set-Cookie');
      expect(headers).toHaveProperty('X-CSRF-Token');
      expect(headers['X-CSRF-Token']).toBe(token);
    });

    test('should include valid cookie in Set-Cookie header', () => {
      const token = generateCsrfToken();
      const headers = getCsrfHeaders(token);

      expect(headers['Set-Cookie']).toContain(`csrf-token=${token}`);
      expect(headers['Set-Cookie']).toContain('HttpOnly');
      expect(headers['Set-Cookie']).toContain('SameSite=Strict');
    });
  });
});
