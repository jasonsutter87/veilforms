/**
 * Rate Limiting Tests
 * Tests for /netlify/functions/lib/rate-limit.js
 *
 * Test Coverage:
 * - Requests within limit pass
 * - Requests exceeding limit are blocked
 * - Rate limit window reset after time passes
 * - Account lockout after 5 failed attempts
 * - Lockout duration (15 minutes)
 * - Lockout expiration
 * - Clear failed attempts
 * - Client ID extraction from headers
 * - Rate limit headers in response
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock @netlify/blobs before importing the module under test
const mockStore = {
  get: jest.fn(),
  setJSON: jest.fn(),
  delete: jest.fn()
};

const mockGetStore = jest.fn(() => mockStore);

jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: mockGetStore
}));

// Import after mocking
const {
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  isAccountLocked,
  getRateLimitHeaders
} = await import('../rate-limit.js');

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

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockStore.get.mockReset();
    mockStore.setJSON.mockReset();
    mockStore.delete.mockReset();
    mockGetStore.mockClear();
  });

  describe('checkRateLimit()', () => {
    test('should allow first request and set count to 1', async () => {
      mockStore.get.mockResolvedValue(null);

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await checkRateLimit(request);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // MAX_REQUESTS (10) - 1
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'rate:192.168.1.1',
        expect.objectContaining({
          count: 1,
          windowStart: expect.any(Number)
        })
      );
    });

    test('should allow requests within limit', async () => {
      const windowStart = Date.now();
      mockStore.get.mockResolvedValue({
        windowStart,
        count: 5
      });

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await checkRateLimit(request);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'rate:192.168.1.1',
        expect.objectContaining({
          count: 6,
          windowStart
        })
      );
    });

    test('should block requests exceeding limit', async () => {
      const windowStart = Date.now();
      mockStore.get.mockResolvedValue({
        windowStart,
        count: 11 // Already over limit
      });

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await checkRateLimit(request);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(mockStore.setJSON).not.toHaveBeenCalled(); // Don't update store when over limit
    });

    test('should block request at exactly the limit', async () => {
      const windowStart = Date.now();
      mockStore.get.mockResolvedValue({
        windowStart,
        count: 10 // At limit
      });

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await checkRateLimit(request);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should reset window after time passes', async () => {
      const oldWindowStart = Date.now() - 70000; // 70 seconds ago (past 1 minute window)
      mockStore.get.mockResolvedValue({
        windowStart: oldWindowStart,
        count: 10
      });

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await checkRateLimit(request);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'rate:192.168.1.1',
        expect.objectContaining({
          count: 1,
          windowStart: expect.any(Number)
        })
      );

      // Verify new window start is recent
      const setCall = mockStore.setJSON.mock.calls[0][1];
      expect(setCall.windowStart).toBeGreaterThan(oldWindowStart);
    });

    test('should handle custom options', async () => {
      mockStore.get.mockResolvedValue(null);

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await checkRateLimit(request, {
        windowMs: 120000, // 2 minutes
        maxRequests: 20,
        keyPrefix: 'custom'
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'custom:192.168.1.1',
        expect.any(Object)
      );
    });

    test('should extract client ID from x-forwarded-for header', async () => {
      mockStore.get.mockResolvedValue(null);

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
      });

      await checkRateLimit(request);

      expect(mockStore.get).toHaveBeenCalledWith('rate:192.168.1.1', { type: 'json' });
    });

    test('should extract client ID from x-real-ip header', async () => {
      mockStore.get.mockResolvedValue(null);

      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '192.168.1.2' }
      });

      await checkRateLimit(request);

      expect(mockStore.get).toHaveBeenCalledWith('rate:192.168.1.2', { type: 'json' });
    });

    test('should use "unknown" as fallback client ID', async () => {
      mockStore.get.mockResolvedValue(null);

      const request = new Request('https://example.com', {
        headers: {}
      });

      await checkRateLimit(request);

      expect(mockStore.get).toHaveBeenCalledWith('rate:unknown', { type: 'json' });
    });

    test('should calculate correct retryAfter value', async () => {
      const windowStart = Date.now() - 30000; // 30 seconds ago
      mockStore.get.mockResolvedValue({
        windowStart,
        count: 11
      });

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await checkRateLimit(request);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(20); // At least 20 seconds remaining
      expect(result.retryAfter).toBeLessThanOrEqual(30); // At most 30 seconds
    });

    test('should cleanup old entries', async () => {
      const veryOldWindowStart = Date.now() - 150000; // 2.5 minutes ago
      mockStore.get.mockResolvedValueOnce({
        windowStart: veryOldWindowStart,
        count: 5
      }).mockResolvedValueOnce(null); // After cleanup

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      await checkRateLimit(request);

      // Should have called delete during cleanup
      expect(mockStore.delete).toHaveBeenCalledWith('rate:192.168.1.1');
    });
  });

  describe('recordFailedAttempt()', () => {
    test('should record first failed attempt', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await recordFailedAttempt('test@example.com');

      expect(result.count).toBe(1);
      expect(result.lockedUntil).toBeNull();
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'lockout:test@example.com',
        expect.objectContaining({
          count: 1,
          firstAttempt: expect.any(Number),
          lockedUntil: null
        })
      );
    });

    test('should increment failed attempt count', async () => {
      const firstAttempt = Date.now() - 30000;
      mockStore.get.mockResolvedValue({
        firstAttempt,
        count: 2,
        lockedUntil: null
      });

      const result = await recordFailedAttempt('test@example.com');

      expect(result.count).toBe(3);
      expect(result.lockedUntil).toBeNull();
    });

    test('should lock account after 5 failed attempts', async () => {
      const firstAttempt = Date.now() - 30000;
      mockStore.get.mockResolvedValue({
        firstAttempt,
        count: 4,
        lockedUntil: null
      });

      const result = await recordFailedAttempt('test@example.com');

      expect(result.count).toBe(5);
      expect(result.lockedUntil).toBeGreaterThan(Date.now());
      expect(result.lockedUntil).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
    });

    test('should enforce 15 minute lockout duration', async () => {
      const firstAttempt = Date.now() - 30000;
      mockStore.get.mockResolvedValue({
        firstAttempt,
        count: 4,
        lockedUntil: null
      });

      const beforeLock = Date.now();
      const result = await recordFailedAttempt('test@example.com');
      const afterLock = Date.now();

      const expectedLockout = 15 * 60 * 1000; // 15 minutes in ms
      const lockoutDuration = result.lockedUntil - beforeLock;

      expect(lockoutDuration).toBeGreaterThanOrEqual(expectedLockout - 100);
      expect(lockoutDuration).toBeLessThanOrEqual(expectedLockout + 100);
    });

    test('should reset after lockout duration expires', async () => {
      const veryOldAttempt = Date.now() - (16 * 60 * 1000); // 16 minutes ago
      mockStore.get.mockResolvedValue({
        firstAttempt: veryOldAttempt,
        count: 5,
        lockedUntil: Date.now() - 60000 // Lockout expired 1 minute ago
      });

      const result = await recordFailedAttempt('test@example.com');

      expect(result.count).toBe(1); // Reset to 1
      expect(result.lockedUntil).toBeNull();
    });

    test('should normalize email to lowercase', async () => {
      mockStore.get.mockResolvedValue(null);

      await recordFailedAttempt('Test@Example.COM');

      expect(mockStore.get).toHaveBeenCalledWith('lockout:test@example.com', { type: 'json' });
      expect(mockStore.setJSON).toHaveBeenCalledWith('lockout:test@example.com', expect.any(Object));
    });
  });

  describe('clearFailedAttempts()', () => {
    test('should delete lockout record', async () => {
      await clearFailedAttempts('test@example.com');

      expect(mockStore.delete).toHaveBeenCalledWith('lockout:test@example.com');
    });

    test('should normalize email to lowercase', async () => {
      await clearFailedAttempts('Test@Example.COM');

      expect(mockStore.delete).toHaveBeenCalledWith('lockout:test@example.com');
    });
  });

  describe('isAccountLocked()', () => {
    test('should return not locked when no data exists', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await isAccountLocked('test@example.com');

      expect(result.locked).toBe(false);
    });

    test('should return not locked when lockedUntil is null', async () => {
      mockStore.get.mockResolvedValue({
        firstAttempt: Date.now(),
        count: 3,
        lockedUntil: null
      });

      const result = await isAccountLocked('test@example.com');

      expect(result.locked).toBe(false);
    });

    test('should return locked when lockout is active', async () => {
      const lockedUntil = Date.now() + 600000; // 10 minutes from now
      mockStore.get.mockResolvedValue({
        firstAttempt: Date.now() - 300000,
        count: 5,
        lockedUntil
      });

      const result = await isAccountLocked('test@example.com');

      expect(result.locked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.remainingMinutes).toBeGreaterThan(0);
    });

    test('should calculate remaining time correctly', async () => {
      const lockedUntil = Date.now() + 600000; // 10 minutes from now
      mockStore.get.mockResolvedValue({
        firstAttempt: Date.now() - 300000,
        count: 5,
        lockedUntil
      });

      const result = await isAccountLocked('test@example.com');

      expect(result.remainingMs).toBeGreaterThan(590000); // About 10 minutes
      expect(result.remainingMs).toBeLessThanOrEqual(600000);
      expect(result.remainingMinutes).toBe(10);
    });

    test('should delete expired lockout and return not locked', async () => {
      const expiredLockout = Date.now() - 60000; // 1 minute ago
      mockStore.get.mockResolvedValue({
        firstAttempt: Date.now() - 900000,
        count: 5,
        lockedUntil: expiredLockout
      });

      const result = await isAccountLocked('test@example.com');

      expect(result.locked).toBe(false);
      expect(mockStore.delete).toHaveBeenCalledWith('lockout:test@example.com');
    });

    test('should normalize email to lowercase', async () => {
      mockStore.get.mockResolvedValue(null);

      await isAccountLocked('Test@Example.COM');

      expect(mockStore.get).toHaveBeenCalledWith('lockout:test@example.com', { type: 'json' });
    });
  });

  describe('getRateLimitHeaders()', () => {
    test('should return remaining header', () => {
      const result = { remaining: 5 };
      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('5');
    });

    test('should include Retry-After when present', () => {
      const result = { remaining: 0, retryAfter: 30 };
      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['Retry-After']).toBe('30');
    });

    test('should not include Retry-After when not present', () => {
      const result = { remaining: 5 };
      const headers = getRateLimitHeaders(result);

      expect(headers['Retry-After']).toBeUndefined();
    });
  });

  describe('Blob Store Integration', () => {
    test('should use correct store name and consistency', async () => {
      mockStore.get.mockResolvedValue(null);

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      await checkRateLimit(request);

      expect(mockGetStore).toHaveBeenCalledWith({
        name: 'veilforms-ratelimit',
        consistency: 'strong'
      });
    });

    test('should handle blob store errors gracefully in cleanup', async () => {
      mockStore.get.mockRejectedValueOnce(new Error('Blob error'))
        .mockResolvedValueOnce(null);

      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      // Should not throw despite cleanup error
      await expect(checkRateLimit(request)).resolves.not.toThrow();
    });
  });
});
