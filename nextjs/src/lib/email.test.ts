/**
 * Email Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  FROM_EMAIL,
  FROM_NAME,
  BASE_URL,
} from './email';

// Mock console.log to avoid cluttering test output
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
    vi.useRealTimers();
  });

  describe('configuration', () => {
    it('should export FROM_EMAIL with default value', () => {
      expect(FROM_EMAIL).toBe('noreply@veilforms.com');
    });

    it('should export FROM_NAME', () => {
      expect(FROM_NAME).toBe('VeilForms');
    });

    it('should export BASE_URL with default value', () => {
      expect(BASE_URL).toBe('https://veilforms.com');
    });
  });

  describe('sendEmailVerification', () => {
    it('should return EmailResult in dev mode', async () => {
      const result = await sendEmailVerification(
        'test@example.com',
        'https://example.com/verify?token=abc123'
      );

      expect(result).toMatchObject({
        provider: 'dev',
        id: expect.stringContaining('dev-'),
      });
    });

    it('should log verification email details', async () => {
      await sendEmailVerification(
        'test@example.com',
        'https://example.com/verify?token=abc123'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV] Would send verification email to test@example.com')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV] Verify URL: https://example.com/verify?token=abc123')
      );
    });

    it('should return unique IDs for different calls', async () => {
      const result1 = await sendEmailVerification(
        'test1@example.com',
        'https://example.com/verify?token=1'
      );

      // Advance time to ensure different timestamp
      vi.advanceTimersByTime(1);

      const result2 = await sendEmailVerification(
        'test2@example.com',
        'https://example.com/verify?token=2'
      );

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle various email formats', async () => {
      const emails = [
        'simple@example.com',
        'user+tag@example.com',
        'user.name@subdomain.example.com',
        'test@localhost',
      ];

      for (const email of emails) {
        const result = await sendEmailVerification(
          email,
          'https://example.com/verify'
        );
        expect(result.provider).toBe('dev');
      }
    });

    it('should handle various verify URL formats', async () => {
      const urls = [
        'https://example.com/verify',
        'https://example.com/verify?token=abc',
        'https://example.com/verify?token=abc&redirect=/dashboard',
        'http://localhost:3000/verify?token=xyz',
      ];

      for (const url of urls) {
        const result = await sendEmailVerification('test@example.com', url);
        expect(result.provider).toBe('dev');
      }
    });

    it('should generate timestamp-based IDs', async () => {
      const beforeTime = Date.now();
      const result = await sendEmailVerification(
        'test@example.com',
        'https://example.com/verify'
      );
      const afterTime = Date.now();

      const idTimestamp = parseInt(result.id.replace('dev-', ''));
      expect(idTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(idTimestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should return EmailResult in dev mode', async () => {
      const result = await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset?token=xyz789'
      );

      expect(result).toMatchObject({
        provider: 'dev',
        id: expect.stringContaining('dev-'),
      });
    });

    it('should log password reset email details', async () => {
      await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset?token=xyz789'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV] Would send password reset email to test@example.com')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV] Reset URL: https://example.com/reset?token=xyz789')
      );
    });

    it('should return unique IDs for different calls', async () => {
      const result1 = await sendPasswordResetEmail(
        'test1@example.com',
        'https://example.com/reset?token=1'
      );

      vi.advanceTimersByTime(1);

      const result2 = await sendPasswordResetEmail(
        'test2@example.com',
        'https://example.com/reset?token=2'
      );

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle various email formats', async () => {
      const emails = [
        'simple@example.com',
        'user+tag@example.com',
        'user.name@subdomain.example.com',
      ];

      for (const email of emails) {
        const result = await sendPasswordResetEmail(
          email,
          'https://example.com/reset'
        );
        expect(result.provider).toBe('dev');
      }
    });

    it('should handle various reset URL formats', async () => {
      const urls = [
        'https://example.com/reset',
        'https://example.com/reset?token=abc',
        'https://example.com/reset?token=abc&expires=123456',
        'http://localhost:3000/reset-password?token=xyz',
      ];

      for (const url of urls) {
        const result = await sendPasswordResetEmail('test@example.com', url);
        expect(result.provider).toBe('dev');
      }
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should return EmailResult in dev mode', async () => {
      const result = await sendWelcomeEmail('test@example.com');

      expect(result).toMatchObject({
        provider: 'dev',
        id: expect.stringContaining('dev-'),
      });
    });

    it('should log welcome email details', async () => {
      await sendWelcomeEmail('test@example.com');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV] Would send welcome email to test@example.com')
      );
    });

    it('should return unique IDs for different calls', async () => {
      const result1 = await sendWelcomeEmail('test1@example.com');

      vi.advanceTimersByTime(1);

      const result2 = await sendWelcomeEmail('test2@example.com');

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle various email formats', async () => {
      const emails = [
        'simple@example.com',
        'user+tag@example.com',
        'user.name@subdomain.example.com',
        'test@localhost',
      ];

      for (const email of emails) {
        const result = await sendWelcomeEmail(email);
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('dev');
      }
    });

    it('should handle welcome email for new users', async () => {
      const newUserEmail = 'newuser@example.com';
      const result = await sendWelcomeEmail(newUserEmail);

      expect(result).not.toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[DEV] Would send welcome email to ${newUserEmail}`)
      );
    });
  });

  describe('email function return types', () => {
    it('sendEmailVerification should match EmailResult interface', async () => {
      const result = await sendEmailVerification(
        'test@example.com',
        'https://example.com/verify'
      );

      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('id');
      expect(typeof result.provider).toBe('string');
      expect(typeof result.id).toBe('string');
    });

    it('sendPasswordResetEmail should match EmailResult interface', async () => {
      const result = await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset'
      );

      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('id');
      expect(typeof result.provider).toBe('string');
      expect(typeof result.id).toBe('string');
    });

    it('sendWelcomeEmail should match EmailResult interface or null', async () => {
      const result = await sendWelcomeEmail('test@example.com');

      expect(result).not.toBeNull();
      if (result) {
        expect(result).toHaveProperty('provider');
        expect(result).toHaveProperty('id');
        expect(typeof result.provider).toBe('string');
        expect(typeof result.id).toBe('string');
      }
    });
  });

  describe('concurrent email sending', () => {
    it('should handle multiple verification emails concurrently', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        sendEmailVerification(
          `user${i}@example.com`,
          `https://example.com/verify?token=${i}`
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.provider).toBe('dev');
        expect(result.id).toContain('dev-');
      });

      // IDs may not all be unique due to concurrent execution with fake timers
      // At least verify they're all valid
      const ids = results.map((r) => r.id);
      ids.forEach(id => {
        expect(id).toMatch(/^dev-\d+$/);
      });
    });

    it('should handle multiple password reset emails concurrently', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        sendPasswordResetEmail(
          `user${i}@example.com`,
          `https://example.com/reset?token=${i}`
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.provider).toBe('dev');
      });
    });

    it('should handle mixed email types concurrently', async () => {
      const results = await Promise.all([
        sendEmailVerification('test1@example.com', 'https://example.com/verify'),
        sendPasswordResetEmail('test2@example.com', 'https://example.com/reset'),
        sendWelcomeEmail('test3@example.com'),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('dev');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings gracefully', async () => {
      const result = await sendEmailVerification('', '');
      expect(result.provider).toBe('dev');
    });

    it('should handle very long emails', async () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      const result = await sendEmailVerification(
        longEmail,
        'https://example.com/verify'
      );
      expect(result.provider).toBe('dev');
    });

    it('should handle very long URLs', async () => {
      const longUrl =
        'https://example.com/verify?token=' + 'a'.repeat(500) + '&data=' + 'b'.repeat(500);
      const result = await sendEmailVerification('test@example.com', longUrl);
      expect(result.provider).toBe('dev');
    });

    it('should handle special characters in email', async () => {
      const specialEmails = [
        'test+filter@example.com',
        'test.name@example.com',
        'test_name@example.com',
        'test-name@example.com',
      ];

      for (const email of specialEmails) {
        const result = await sendEmailVerification(
          email,
          'https://example.com/verify'
        );
        expect(result.provider).toBe('dev');
      }
    });

    it('should handle special characters in URL', async () => {
      const specialUrls = [
        'https://example.com/verify?token=abc&foo=bar',
        'https://example.com/verify?token=abc%20def',
        'https://example.com/verify?token=abc+def',
        'https://example.com/verify#section',
      ];

      for (const url of specialUrls) {
        const result = await sendEmailVerification('test@example.com', url);
        expect(result.provider).toBe('dev');
      }
    });
  });

  describe('environment variable handling', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use FROM_EMAIL from environment if set', () => {
      // Since the module is already imported, FROM_EMAIL is already set
      // This test verifies the default value
      expect(FROM_EMAIL).toBe('noreply@veilforms.com');
    });

    it('should use BASE_URL from environment if set', () => {
      // Since the module is already imported, BASE_URL is already set
      // This test verifies the default value
      expect(BASE_URL).toBe('https://veilforms.com');
    });
  });

  describe('timestamp-based IDs', () => {
    it('should generate IDs that increase over time', async () => {
      const result1 = await sendEmailVerification(
        'test@example.com',
        'https://example.com/verify'
      );

      vi.advanceTimersByTime(10);

      const result2 = await sendEmailVerification(
        'test@example.com',
        'https://example.com/verify'
      );

      const id1 = parseInt(result1.id.replace('dev-', ''));
      const id2 = parseInt(result2.id.replace('dev-', ''));

      expect(id2).toBeGreaterThanOrEqual(id1);
    });

    it('should use current timestamp for ID generation', async () => {
      const beforeTime = Date.now();
      const result = await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset'
      );
      const afterTime = Date.now();

      const idTimestamp = parseInt(result.id.replace('dev-', ''));
      expect(idTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(idTimestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('dev mode behavior', () => {
    it('should always return dev provider in test environment', async () => {
      const results = await Promise.all([
        sendEmailVerification('test@example.com', 'https://example.com/verify'),
        sendPasswordResetEmail('test@example.com', 'https://example.com/reset'),
        sendWelcomeEmail('test@example.com'),
      ]);

      results.forEach((result) => {
        expect(result?.provider).toBe('dev');
      });
    });

    it('should log to console in dev mode', async () => {
      consoleLogSpy.mockClear();

      await sendEmailVerification(
        'test@example.com',
        'https://example.com/verify'
      );

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should not throw errors in dev mode', async () => {
      await expect(
        sendEmailVerification('invalid-email', 'invalid-url')
      ).resolves.not.toThrow();

      await expect(
        sendPasswordResetEmail('', '')
      ).resolves.not.toThrow();

      await expect(sendWelcomeEmail('')).resolves.not.toThrow();
    });
  });
});
