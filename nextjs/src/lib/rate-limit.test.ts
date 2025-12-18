/**
 * VeilForms - Rate Limiting Tests
 * Tests for persistent rate limiting and account lockout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  isAccountLocked,
  getRateLimitHeaders,
} from './rate-limit';
import { TEST_PREFIX } from '../../__tests__/helpers/cleanup.helper';

// Mock storage at module level
const mockStorage = new Map<string, unknown>();

const mockStore = {
  get: vi.fn(async (key: string, options?: { type?: string }) => {
    const data = mockStorage.get(key);
    if (data === undefined) return null;
    if (options?.type === 'json') return data;
    return JSON.stringify(data);
  }),
  setJSON: vi.fn(async (key: string, value: unknown) => {
    mockStorage.set(key, value);
  }),
  delete: vi.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
};

// Mock Netlify Blobs
vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => mockStore),
}));

// Helper to create a mock NextRequest
function createMockRequest(ip = '192.168.1.1'): NextRequest {
  return {
    headers: {
      get: vi.fn((name: string) => {
        if (name === 'x-forwarded-for') return ip;
        if (name === 'x-real-ip') return ip;
        return null;
      }),
    },
  } as unknown as NextRequest;
}

// Helper to clear mock storage
function clearMockStorage() {
  mockStorage.clear();
}

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockStorage();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', async () => {
      const req = createMockRequest();
      const result = await checkRateLimit(req);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // MAX_REQUESTS (10) - 1
      expect(result.retryAfter).toBeUndefined();
    });

    it('should track multiple requests within window', async () => {
      const req = createMockRequest();

      const result1 = await checkRateLimit(req);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9);

      const result2 = await checkRateLimit(req);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(8);

      const result3 = await checkRateLimit(req);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(7);
    });

    it('should enforce rate limit after max requests', async () => {
      const req = createMockRequest();

      // Make 10 requests (the max)
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(req);
      }

      // 11th request should be blocked
      const result = await checkRateLimit(req);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should use different limits for different IPs', async () => {
      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');

      const result1 = await checkRateLimit(req1);
      const result2 = await checkRateLimit(req2);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result1.remaining).toBe(9);
      expect(result2.remaining).toBe(9);
    });

    it('should reset window after time expires', async () => {
      const req = createMockRequest();

      // First request
      const result1 = await checkRateLimit(req);
      expect(result1.remaining).toBe(9);

      // Simulate window expiry by manually updating the data
      // Set window start to 2 minutes ago (past the 1-minute window)
      const key = 'rate:192.168.1.1';
      mockStorage.set(key, {
        windowStart: Date.now() - 120000,
        count: 5,
      });

      // Next request should start a new window
      const result2 = await checkRateLimit(req);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(9);
    });

    it('should respect custom options', async () => {
      const req = createMockRequest();
      const options = {
        windowMs: 30000, // 30 seconds
        maxRequests: 5,
        keyPrefix: 'custom',
      };

      // Make 5 requests (the custom max)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(req, options);
      }

      // 6th request should be blocked
      const result = await checkRateLimit(req, options);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle unknown client identifier', async () => {
      const req = {
        headers: {
          get: vi.fn(() => null),
        },
      } as unknown as NextRequest;

      const result = await checkRateLimit(req);
      expect(result.allowed).toBe(true);
    });

    it('should cleanup old entries', async () => {
      const req = createMockRequest();

      // First request to create entry
      await checkRateLimit(req);

      // Simulate very old entry (past cleanup threshold)
      const key = 'rate:192.168.1.1';
      mockStorage.set(key, {
        windowStart: Date.now() - 180000, // 3 minutes ago
        count: 5,
      });

      // Next request should trigger cleanup and start fresh
      const result = await checkRateLimit(req);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  describe('recordFailedAttempt', () => {
    const testEmail = `${TEST_PREFIX}user@example.com`;

    it('should record first failed attempt', async () => {
      const result = await recordFailedAttempt(testEmail);

      expect(result.count).toBe(1);
      expect(result.lockedUntil).toBeNull();
      expect(result.firstAttempt).toBeGreaterThan(Date.now() - 1000);
    });

    it('should increment failed attempts', async () => {
      await recordFailedAttempt(testEmail);
      const result = await recordFailedAttempt(testEmail);

      expect(result.count).toBe(2);
      expect(result.lockedUntil).toBeNull();
    });

    it('should lock account after threshold attempts', async () => {
      // Record 5 failed attempts (the threshold)
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt(testEmail);
      }

      const result = await recordFailedAttempt(testEmail);

      expect(result.count).toBe(5);
      expect(result.lockedUntil).not.toBeNull();
      expect(result.lockedUntil).toBeGreaterThan(Date.now());
    });

    it('should reset after lockout duration', async () => {
      // Record a failed attempt
      await recordFailedAttempt(testEmail);

      // Simulate lockout duration passing
      const key = `lockout:${testEmail.toLowerCase()}`;
      mockStorage.set(key, {
        firstAttempt: Date.now() - 20 * 60 * 1000, // 20 minutes ago
        count: 3,
        lockedUntil: null,
      });

      // Next attempt should reset
      const result = await recordFailedAttempt(testEmail);
      expect(result.count).toBe(1);
    });

    it('should handle email case-insensitivity', async () => {
      await recordFailedAttempt('Test@Example.COM');
      const result = await recordFailedAttempt('test@example.com');

      expect(result.count).toBe(2);
    });
  });

  describe('clearFailedAttempts', () => {
    const testEmail = `${TEST_PREFIX}clear@example.com`;

    it('should clear failed attempts after successful login', async () => {
      // Record some failed attempts
      await recordFailedAttempt(testEmail);
      await recordFailedAttempt(testEmail);

      // Clear attempts
      await clearFailedAttempts(testEmail);

      // Verify cleared
      const lockResult = await isAccountLocked(testEmail);
      expect(lockResult.locked).toBe(false);
    });

    it('should handle clearing non-existent data', async () => {
      await expect(clearFailedAttempts('nonexistent@example.com')).resolves.not.toThrow();
    });
  });

  describe('isAccountLocked', () => {
    const testEmail = `${TEST_PREFIX}locked@example.com`;

    it('should return false for no lockout data', async () => {
      const result = await isAccountLocked(testEmail);

      expect(result.locked).toBe(false);
      expect(result.remainingMs).toBeUndefined();
      expect(result.remainingMinutes).toBeUndefined();
    });

    it('should return false when not locked', async () => {
      // Record attempts but not enough to lock
      await recordFailedAttempt(testEmail);
      await recordFailedAttempt(testEmail);

      const result = await isAccountLocked(testEmail);
      expect(result.locked).toBe(false);
    });

    it('should return true when account is locked', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(testEmail);
      }

      const result = await isAccountLocked(testEmail);

      expect(result.locked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.remainingMinutes).toBeGreaterThan(0);
    });

    it('should clear expired lockout', async () => {
      // Create expired lockout
      const key = `lockout:${testEmail.toLowerCase()}`;
      mockStorage.set(key, {
        firstAttempt: Date.now() - 20 * 60 * 1000,
        count: 5,
        lockedUntil: Date.now() - 1000, // Expired 1 second ago
      });

      const result = await isAccountLocked(testEmail);

      expect(result.locked).toBe(false);
      expect(mockStorage.has(key)).toBe(false);
    });

    it('should calculate remaining time correctly', async () => {
      // Create lockout with known time
      const key = `lockout:${testEmail.toLowerCase()}`;
      const lockedUntil = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      mockStorage.set(key, {
        firstAttempt: Date.now(),
        count: 5,
        lockedUntil,
      });

      const result = await isAccountLocked(testEmail);

      expect(result.locked).toBe(true);
      expect(result.remainingMinutes).toBe(10);
      expect(result.remainingMs).toBeLessThanOrEqual(10 * 60 * 1000);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should return headers for allowed request', () => {
      const result = {
        allowed: true,
        remaining: 5,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('5');
      expect(headers['Retry-After']).toBeUndefined();
    });

    it('should include retry-after when blocked', () => {
      const result = {
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['Retry-After']).toBe('60');
    });

    it('should handle zero remaining', () => {
      const result = {
        allowed: true,
        remaining: 0,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent rate limit checks', async () => {
      const req = createMockRequest();

      // Simulate 5 concurrent requests
      const results = await Promise.all([
        checkRateLimit(req),
        checkRateLimit(req),
        checkRateLimit(req),
        checkRateLimit(req),
        checkRateLimit(req),
      ]);

      // All should be allowed, but with decreasing remaining counts
      results.forEach((result) => {
        expect(result.allowed).toBe(true);
      });

      // Verify final state
      const finalResult = await checkRateLimit(req);
      expect(finalResult.remaining).toBeLessThan(10);
    });

    it('should handle concurrent lockout attempts', async () => {
      const testEmail = `${TEST_PREFIX}concurrent@example.com`;

      // Simulate concurrent failed login attempts
      const results = await Promise.all([
        recordFailedAttempt(testEmail),
        recordFailedAttempt(testEmail),
        recordFailedAttempt(testEmail),
      ]);

      results.forEach((result) => {
        expect(result.count).toBeGreaterThan(0);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle storage errors gracefully', async () => {
      // Make get throw an error
      vi.mocked(mockStore.get).mockRejectedValueOnce(new Error('Storage error'));

      const req = createMockRequest();
      const result = await checkRateLimit(req);

      // Should allow request on error
      expect(result.allowed).toBe(true);
    });

    it('should handle corrupted data', async () => {
      // Set corrupted data that won't match the expected type
      mockStorage.set('rate:192.168.1.1', null);

      const req = createMockRequest();
      const result = await checkRateLimit(req);

      // Should start fresh when data is corrupted
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should handle multiple x-forwarded-for IPs', async () => {
      const req = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1, 172.16.0.1';
            return null;
          }),
        },
      } as unknown as NextRequest;

      const result = await checkRateLimit(req);

      expect(result.allowed).toBe(true);
      // Should use first IP in the chain
    });

    it('should handle empty email strings', async () => {
      await expect(recordFailedAttempt('')).resolves.toBeDefined();
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(200) + '@example.com';
      const result = await recordFailedAttempt(longEmail);

      expect(result.count).toBe(1);
    });
  });
});
