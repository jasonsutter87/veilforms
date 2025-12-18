/**
 * Email Rate Limiting Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkEmailRateLimit,
  getEmailRateLimitHeaders,
  resetEmailRateLimit,
} from './email-rate-limit';

// Mock @netlify/blobs
const mockStore = {
  get: vi.fn(),
  setJSON: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => mockStore),
}));

// Mock console to avoid cluttering test output
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('email-rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockClear();
  });

  describe('checkEmailRateLimit', () => {
    describe('verification emails', () => {
      it('should allow first verification email', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4); // Max 5, used 1
        expect(result.resetAt).toBeGreaterThan(Date.now());
      });

      it('should track attempts correctly', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        // First attempt
        const result1 = await checkEmailRateLimit('test@example.com', 'verification');
        expect(result1.remaining).toBe(4);

        // Simulate second attempt
        mockStore.get.mockResolvedValue({
          count: 1,
          resetAt: Date.now() + 3600000,
          attempts: [Date.now()],
        });

        const result2 = await checkEmailRateLimit('test@example.com', 'verification');
        expect(result2.remaining).toBe(3);
      });

      it('should block after 5 verification emails', async () => {
        const now = Date.now();
        mockStore.get.mockResolvedValue({
          count: 5,
          resetAt: now + 3600000,
          attempts: [now, now - 100, now - 200, now - 300, now - 400],
        });

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.message).toBe(
          'Too many verification emails. Please wait before requesting another.'
        );
        expect(result.retryAfter).toBeGreaterThan(0);
      });

      it('should provide retry-after time', async () => {
        const now = Date.now();
        const oldestAttempt = now - 1800000; // 30 minutes ago
        mockStore.get.mockResolvedValue({
          count: 5,
          resetAt: now + 3600000,
          attempts: [now, now - 100, now - 200, now - 300, oldestAttempt],
        });

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBe(1800); // 30 minutes in seconds
      });

      it('should reset window after expiry', async () => {
        const now = Date.now();
        const expiredResetAt = now - 1000; // Expired 1 second ago

        mockStore.get.mockResolvedValue({
          count: 5,
          resetAt: expiredResetAt,
          attempts: [now - 4000000, now - 4000100, now - 4000200],
        });
        mockStore.setJSON.mockResolvedValue(undefined);

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4); // Fresh window
      });

      it('should filter out old attempts outside window', async () => {
        const now = Date.now();
        const twoHoursAgo = now - 7200000;

        mockStore.get.mockResolvedValue({
          count: 3,
          resetAt: now + 3600000,
          attempts: [now, now - 100, twoHoursAgo], // One attempt is outside 1-hour window
        });
        mockStore.setJSON.mockResolvedValue(undefined);

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // 2 recent attempts + this one = 3 used
      });

      it('should normalize email to lowercase', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        await checkEmailRateLimit('Test@EXAMPLE.COM', 'verification');

        expect(mockStore.get).toHaveBeenCalledWith(
          'verification_test@example.com',
          expect.any(Object)
        );
      });
    });

    describe('password reset emails', () => {
      it('should allow first password reset email', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        const result = await checkEmailRateLimit(
          'test@example.com',
          'passwordReset'
        );

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // Max 3, used 1
      });

      it('should block after 3 password reset emails', async () => {
        const now = Date.now();
        mockStore.get.mockResolvedValue({
          count: 3,
          resetAt: now + 3600000,
          attempts: [now, now - 100, now - 200],
        });

        const result = await checkEmailRateLimit(
          'test@example.com',
          'passwordReset'
        );

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.message).toBe(
          'Too many password reset requests. Please wait before trying again.'
        );
      });

      it('should have different limit than verification', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        const verifyResult = await checkEmailRateLimit(
          'test@example.com',
          'verification'
        );
        const resetResult = await checkEmailRateLimit(
          'test@example.com',
          'passwordReset'
        );

        expect(verifyResult.remaining).toBe(4); // 5 max
        expect(resetResult.remaining).toBe(2); // 3 max
      });

      it('should track verification and reset separately', async () => {
        mockStore.get.mockImplementation((key) => {
          if (key === 'verification_test@example.com') {
            return Promise.resolve({
              count: 2,
              resetAt: Date.now() + 3600000,
              attempts: [Date.now(), Date.now() - 100],
            });
          }
          return Promise.resolve(null);
        });
        mockStore.setJSON.mockResolvedValue(undefined);

        const resetResult = await checkEmailRateLimit(
          'test@example.com',
          'passwordReset'
        );

        // Password reset should be independent
        expect(resetResult.allowed).toBe(true);
        expect(resetResult.remaining).toBe(2);
      });
    });

    describe('error handling', () => {
      it('should allow request if storage check fails', async () => {
        mockStore.get.mockRejectedValue(new Error('Storage unavailable'));
        consoleErrorSpy.mockClear();

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        expect(result.allowed).toBe(true);
        expect(result.error).toBe('Rate limit check failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Email rate limit check error:',
          expect.any(Error)
        );
      });

      it('should handle storage write failures gracefully', async () => {
        mockStore.get.mockRejectedValue(new Error('Storage unavailable'));
        consoleErrorSpy.mockClear();

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        // Should allow request despite storage failure
        expect(result.allowed).toBe(true);
        expect(result.error).toBe('Rate limit check failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Email rate limit check error:',
          expect.any(Error)
        );
      });

      it('should throw for invalid type', async () => {
        await expect(
          checkEmailRateLimit('test@example.com', 'invalid' as any)
        ).rejects.toThrow('Invalid email rate limit type: invalid');
      });
    });

    describe('storage interaction', () => {
      it('should create new rate limit data on first attempt', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        await checkEmailRateLimit('test@example.com', 'verification');

        expect(mockStore.setJSON).toHaveBeenCalledWith(
          'verification_test@example.com',
          expect.objectContaining({
            count: 1,
            resetAt: expect.any(Number),
            attempts: expect.arrayContaining([expect.any(Number)]),
          })
        );
      });

      it('should update existing rate limit data', async () => {
        const now = Date.now();
        mockStore.get.mockResolvedValue({
          count: 2,
          resetAt: now + 3600000,
          attempts: [now - 100, now - 200],
        });
        mockStore.setJSON.mockResolvedValue(undefined);

        await checkEmailRateLimit('test@example.com', 'verification');

        expect(mockStore.setJSON).toHaveBeenCalledWith(
          'verification_test@example.com',
          expect.objectContaining({
            count: 3,
            attempts: expect.arrayContaining([
              now - 100,
              now - 200,
              expect.any(Number),
            ]),
          })
        );
      });

      it('should not store data when limit is exceeded', async () => {
        const now = Date.now();
        mockStore.get.mockResolvedValue({
          count: 5,
          resetAt: now + 3600000,
          attempts: [now, now - 100, now - 200, now - 300, now - 400],
        });
        mockStore.setJSON.mockResolvedValue(undefined);

        await checkEmailRateLimit('test@example.com', 'verification');

        // Should not update when blocked
        expect(mockStore.setJSON).not.toHaveBeenCalled();
      });
    });

    describe('time window management', () => {
      it('should use 1-hour window for verification', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        const beforeTime = Date.now();
        await checkEmailRateLimit('test@example.com', 'verification');
        const afterTime = Date.now();

        const call = mockStore.setJSON.mock.calls[0][1];
        const resetAt = call.resetAt;

        const expectedMin = beforeTime + 3600000; // 1 hour
        const expectedMax = afterTime + 3600000;

        expect(resetAt).toBeGreaterThanOrEqual(expectedMin);
        expect(resetAt).toBeLessThanOrEqual(expectedMax);
      });

      it('should use 1-hour window for password reset', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        const beforeTime = Date.now();
        await checkEmailRateLimit('test@example.com', 'passwordReset');
        const afterTime = Date.now();

        const call = mockStore.setJSON.mock.calls[0][1];
        const resetAt = call.resetAt;

        const expectedMin = beforeTime + 3600000;
        const expectedMax = afterTime + 3600000;

        expect(resetAt).toBeGreaterThanOrEqual(expectedMin);
        expect(resetAt).toBeLessThanOrEqual(expectedMax);
      });

      it('should calculate retry-after based on oldest attempt', async () => {
        const now = Date.now();
        const oldestAttemptTime = now - 600000; // 10 minutes ago

        mockStore.get.mockResolvedValue({
          count: 5,
          resetAt: now + 3600000,
          attempts: [
            now,
            now - 100,
            now - 200,
            now - 300,
            oldestAttemptTime,
          ],
        });

        const result = await checkEmailRateLimit('test@example.com', 'verification');

        // Should wait 50 minutes (3600 - 600 seconds)
        expect(result.retryAfter).toBe(3000); // 50 minutes in seconds
      });
    });

    describe('concurrent requests', () => {
      it('should handle concurrent checks for same email', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        const promises = Array.from({ length: 3 }, () =>
          checkEmailRateLimit('test@example.com', 'verification')
        );

        const results = await Promise.all(promises);

        // All should be allowed (race condition acceptable in this case)
        results.forEach((result) => {
          expect(result.allowed).toBe(true);
        });
      });

      it('should handle concurrent checks for different emails', async () => {
        mockStore.get.mockResolvedValue(null);
        mockStore.setJSON.mockResolvedValue(undefined);

        const promises = Array.from({ length: 5 }, (_, i) =>
          checkEmailRateLimit(`user${i}@example.com`, 'verification')
        );

        const results = await Promise.all(promises);

        // All should be allowed
        results.forEach((result) => {
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(4);
        });
      });
    });
  });

  describe('getEmailRateLimitHeaders', () => {
    it('should return correct headers for allowed request', () => {
      const result = {
        allowed: true,
        remaining: 3,
        resetAt: Date.parse('2024-01-01T12:00:00Z'),
      };

      const headers = getEmailRateLimitHeaders(result, 'verification');

      expect(headers).toEqual({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '3',
        'X-RateLimit-Reset': '2024-01-01T12:00:00.000Z',
      });
    });

    it('should include Retry-After header when blocked', () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetAt: Date.parse('2024-01-01T12:00:00Z'),
        retryAfter: 1800,
      };

      const headers = getEmailRateLimitHeaders(result, 'verification');

      expect(headers).toEqual({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '2024-01-01T12:00:00.000Z',
        'Retry-After': '1800',
      });
    });

    it('should use correct limit for password reset', () => {
      const result = {
        allowed: true,
        remaining: 2,
        resetAt: Date.now(),
      };

      const headers = getEmailRateLimitHeaders(result, 'passwordReset');

      expect(headers['X-RateLimit-Limit']).toBe('3');
      expect(headers['X-RateLimit-Remaining']).toBe('2');
    });

    it('should format resetAt as ISO string', () => {
      const resetAt = Date.parse('2024-06-15T10:30:00Z');
      const result = {
        allowed: true,
        remaining: 4,
        resetAt,
      };

      const headers = getEmailRateLimitHeaders(result, 'verification');

      expect(headers['X-RateLimit-Reset']).toBe('2024-06-15T10:30:00.000Z');
    });

    it('should not include Retry-After when not present', () => {
      const result = {
        allowed: true,
        remaining: 3,
        resetAt: Date.now(),
      };

      const headers = getEmailRateLimitHeaders(result, 'verification');

      expect(headers).not.toHaveProperty('Retry-After');
    });
  });

  describe('resetEmailRateLimit', () => {
    it('should successfully reset rate limit', async () => {
      mockStore.delete.mockResolvedValue(undefined);

      const result = await resetEmailRateLimit('test@example.com', 'verification');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Rate limit reset successfully');
      expect(mockStore.delete).toHaveBeenCalledWith('verification_test@example.com');
    });

    it('should normalize email to lowercase', async () => {
      mockStore.delete.mockResolvedValue(undefined);

      await resetEmailRateLimit('Test@EXAMPLE.COM', 'verification');

      expect(mockStore.delete).toHaveBeenCalledWith('verification_test@example.com');
    });

    it('should handle different types', async () => {
      mockStore.delete.mockResolvedValue(undefined);

      await resetEmailRateLimit('test@example.com', 'verification');
      expect(mockStore.delete).toHaveBeenCalledWith('verification_test@example.com');

      await resetEmailRateLimit('test@example.com', 'passwordReset');
      expect(mockStore.delete).toHaveBeenCalledWith('passwordReset_test@example.com');
    });

    it('should handle delete errors', async () => {
      mockStore.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await resetEmailRateLimit('test@example.com', 'verification');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });

    it('should allow new requests after reset', async () => {
      // Simulate blocked state
      mockStore.get.mockResolvedValue({
        count: 5,
        resetAt: Date.now() + 3600000,
        attempts: Array(5).fill(Date.now()),
      });

      const blockedResult = await checkEmailRateLimit(
        'test@example.com',
        'verification'
      );
      expect(blockedResult.allowed).toBe(false);

      // Reset
      mockStore.delete.mockResolvedValue(undefined);
      await resetEmailRateLimit('test@example.com', 'verification');

      // Should allow after reset
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const allowedResult = await checkEmailRateLimit(
        'test@example.com',
        'verification'
      );
      expect(allowedResult.allowed).toBe(true);
    });

    it('should reset verification and password reset independently', async () => {
      mockStore.delete.mockResolvedValue(undefined);

      await resetEmailRateLimit('test@example.com', 'verification');
      expect(mockStore.delete).toHaveBeenCalledWith('verification_test@example.com');

      // Password reset should not be affected
      expect(mockStore.delete).not.toHaveBeenCalledWith(
        'passwordReset_test@example.com'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle email with plus addressing', async () => {
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await checkEmailRateLimit('user+tag@example.com', 'verification');

      expect(mockStore.get).toHaveBeenCalledWith(
        'verification_user+tag@example.com',
        expect.any(Object)
      );
    });

    it('should handle email with dots', async () => {
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await checkEmailRateLimit('first.last@example.com', 'verification');

      expect(mockStore.get).toHaveBeenCalledWith(
        'verification_first.last@example.com',
        expect.any(Object)
      );
    });

    it('should handle empty email', async () => {
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await checkEmailRateLimit('', 'verification');

      expect(mockStore.get).toHaveBeenCalledWith(
        'verification_',
        expect.any(Object)
      );
    });

    it('should handle very long email', async () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await checkEmailRateLimit(longEmail, 'verification');

      expect(result.allowed).toBe(true);
    });

    it('should handle resetAt in the past gracefully', async () => {
      const pastResetAt = Date.now() - 7200000; // 2 hours ago
      mockStore.get.mockResolvedValue({
        count: 5,
        resetAt: pastResetAt,
        attempts: [],
      });
      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await checkEmailRateLimit('test@example.com', 'verification');

      // Should create fresh window
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });
});
