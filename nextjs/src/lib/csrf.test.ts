import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateCsrfToken,
  validateCsrfToken,
  createCsrfCookie,
  getCsrfHeaders,
} from './csrf';

describe('csrf', () => {
  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }

      expect(tokens.size).toBe(100);
    });

    it('should only contain lowercase hex characters', () => {
      const token = generateCsrfToken();

      expect(token).toMatch(/^[0-9a-f]+$/);
      expect(token).not.toMatch(/[A-F]/);
    });
  });

  describe('validateCsrfToken', () => {
    it('should return true when cookie and header tokens match', () => {
      const token = generateCsrfToken();

      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-csrf-token': token,
        },
      });

      // Mock cookies
      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn().mockReturnValue({ value: token }),
        },
      });

      expect(validateCsrfToken(req)).toBe(true);
    });

    it('should return false when tokens do not match', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-csrf-token': 'header-token-value',
        },
      });

      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn().mockReturnValue({ value: 'different-cookie-token' }),
        },
      });

      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when cookie token is missing', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-csrf-token': 'header-token',
        },
      });

      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn().mockReturnValue(undefined),
        },
      });

      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when header token is missing', () => {
      const req = new NextRequest('http://localhost/api/test');

      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn().mockReturnValue({ value: 'cookie-token' }),
        },
      });

      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when tokens have different lengths', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-csrf-token': 'short',
        },
      });

      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn().mockReturnValue({ value: 'much-longer-token-value' }),
        },
      });

      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should use constant-time comparison (same length, different content)', () => {
      const token1 = 'a'.repeat(64);
      const token2 = 'b'.repeat(64);

      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-csrf-token': token1,
        },
      });

      Object.defineProperty(req, 'cookies', {
        value: {
          get: vi.fn().mockReturnValue({ value: token2 }),
        },
      });

      expect(validateCsrfToken(req)).toBe(false);
    });
  });

  describe('createCsrfCookie', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create cookie with required attributes', () => {
      process.env.NODE_ENV = 'test';
      const token = 'test-token-123';
      const cookie = createCsrfCookie(token);

      expect(cookie).toContain(`csrf-token=${token}`);
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Max-Age=3600');
    });

    it('should include Secure flag in production', () => {
      process.env.NODE_ENV = 'production';
      const cookie = createCsrfCookie('token');

      expect(cookie).toContain('Secure');
    });

    it('should not include Secure flag in development', () => {
      process.env.NODE_ENV = 'development';
      const cookie = createCsrfCookie('token');

      expect(cookie).not.toContain('Secure');
    });

    it('should include Domain when COOKIE_DOMAIN is set', () => {
      process.env.COOKIE_DOMAIN = 'example.com';
      const cookie = createCsrfCookie('token');

      expect(cookie).toContain('Domain=example.com');
    });

    it('should not include Domain when COOKIE_DOMAIN is not set', () => {
      delete process.env.COOKIE_DOMAIN;
      const cookie = createCsrfCookie('token');

      expect(cookie).not.toContain('Domain=');
    });
  });

  describe('getCsrfHeaders', () => {
    it('should return Set-Cookie and X-CSRF-Token headers', () => {
      const token = 'test-token-456';
      const headers = getCsrfHeaders(token);

      expect(headers['Set-Cookie']).toContain(`csrf-token=${token}`);
      expect(headers['X-CSRF-Token']).toBe(token);
    });

    it('should return properly formatted cookie', () => {
      const headers = getCsrfHeaders('my-token');

      expect(headers['Set-Cookie']).toContain('Path=/');
      expect(headers['Set-Cookie']).toContain('HttpOnly');
    });
  });
});
