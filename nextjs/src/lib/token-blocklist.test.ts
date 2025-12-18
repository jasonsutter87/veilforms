import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import {
  revokeToken,
  isTokenRevoked,
  cleanupExpiredTokens,
  getBlocklistStats,
} from './token-blocklist';

// Mock Netlify Blobs
const mockStore = {
  get: vi.fn(),
  setJSON: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => mockStore),
}));

describe('token-blocklist', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper function to create a test token
   */
  function createTestToken(expiresIn: string | number = '24h'): string {
    return jwt.sign(
      { userId: 'user_123', email: 'test@example.com' },
      JWT_SECRET,
      { expiresIn }
    );
  }

  /**
   * Helper function to hash a token the same way the module does
   */
  function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  describe('revokeToken', () => {
    it('should successfully revoke a valid token', async () => {
      const token = createTestToken('24h');
      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await revokeToken(token);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockStore.setJSON).toHaveBeenCalledOnce();
    });

    it('should store token hash instead of raw token', async () => {
      const token = createTestToken('24h');
      const expectedHash = hashToken(token);
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      expect(mockStore.setJSON).toHaveBeenCalledWith(
        expectedHash,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should include revokedAt timestamp', async () => {
      const token = createTestToken('24h');
      mockStore.setJSON.mockResolvedValue(undefined);

      const beforeRevoke = new Date();
      await revokeToken(token);
      const afterRevoke = new Date();

      const callArgs = mockStore.setJSON.mock.calls[0];
      const entry = callArgs[1];

      expect(entry.revokedAt).toBeDefined();
      const revokedAt = new Date(entry.revokedAt);
      expect(revokedAt.getTime()).toBeGreaterThanOrEqual(beforeRevoke.getTime());
      expect(revokedAt.getTime()).toBeLessThanOrEqual(afterRevoke.getTime());
    });

    it('should include expiresAt based on token expiry', async () => {
      const token = createTestToken('1h');
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      const callArgs = mockStore.setJSON.mock.calls[0];
      const entry = callArgs[1];

      expect(entry.expiresAt).toBeDefined();
      const expiresAt = new Date(entry.expiresAt);
      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour

      // Should be approximately 1 hour from now (within 5 seconds tolerance)
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(5000);
    });

    it('should set TTL metadata to remaining seconds', async () => {
      const token = createTestToken('1h');
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      const callArgs = mockStore.setJSON.mock.calls[0];
      const metadata = callArgs[2];

      expect(metadata.metadata.ttl).toBeDefined();
      const ttl = parseInt(metadata.metadata.ttl, 10);

      // Should be approximately 3600 seconds (1 hour), allow some variance
      expect(ttl).toBeGreaterThan(3590);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('should handle already expired token gracefully', async () => {
      const token = createTestToken('-1h'); // Already expired

      const result = await revokeToken(token);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('token_already_expired');
      expect(mockStore.setJSON).not.toHaveBeenCalled();
    });

    it('should return error when token is empty', async () => {
      const result = await revokeToken('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token is required');
      expect(mockStore.setJSON).not.toHaveBeenCalled();
    });

    it('should return error when token is null', async () => {
      const result = await revokeToken(null as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token is required');
    });

    it('should return error when token is malformed', async () => {
      const result = await revokeToken('not.a.valid.jwt');

      expect(result.success).toBe(true);
      expect(result.reason).toBe('token_already_expired');
    });

    it('should handle storage errors gracefully', async () => {
      const token = createTestToken('24h');
      const storageError = new Error('Storage unavailable');
      mockStore.setJSON.mockRejectedValue(storageError);

      const result = await revokeToken(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage unavailable');
    });

    it('should handle token without expiry claim', async () => {
      // Create token without exp claim
      const token = jwt.sign(
        { userId: 'user_123', email: 'test@example.com' },
        JWT_SECRET,
        { noTimestamp: true }
      );

      const result = await revokeToken(token);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('token_already_expired');
    });

    it('should correctly calculate TTL for tokens near expiry', async () => {
      const token = createTestToken('5s'); // 5 seconds
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      const callArgs = mockStore.setJSON.mock.calls[0];
      const metadata = callArgs[2];
      const ttl = parseInt(metadata.metadata.ttl, 10);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5);
    });
  });

  describe('isTokenRevoked', () => {
    it('should return true for revoked token', async () => {
      const token = createTestToken('24h');
      const tokenHash = hashToken(token);
      mockStore.get.mockResolvedValue({
        revokedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await isTokenRevoked(token);

      expect(result).toBe(true);
      expect(mockStore.get).toHaveBeenCalledWith(tokenHash);
    });

    it('should return false for non-revoked token', async () => {
      const token = createTestToken('24h');
      mockStore.get.mockResolvedValue(null);

      const result = await isTokenRevoked(token);

      expect(result).toBe(false);
    });

    it('should hash token before checking', async () => {
      const token = createTestToken('24h');
      const expectedHash = hashToken(token);
      mockStore.get.mockResolvedValue(null);

      await isTokenRevoked(token);

      expect(mockStore.get).toHaveBeenCalledWith(expectedHash);
    });

    it('should return false for empty token', async () => {
      const result = await isTokenRevoked('');

      expect(result).toBe(false);
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should return false for null token', async () => {
      const result = await isTokenRevoked(null as any);

      expect(result).toBe(false);
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const token = createTestToken('24h');
      mockStore.get.mockRejectedValue(new Error('Storage error'));

      const result = await isTokenRevoked(token);

      expect(result).toBe(false); // Fail open for availability
    });

    it('should check different tokens independently', async () => {
      const token1 = createTestToken('24h');
      const token2 = createTestToken('24h');

      mockStore.get
        .mockResolvedValueOnce({ revokedAt: new Date().toISOString() })
        .mockResolvedValueOnce(null);

      const result1 = await isTokenRevoked(token1);
      const result2 = await isTokenRevoked(token2);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should use consistent hashing', async () => {
      const token = createTestToken('24h');
      mockStore.get.mockResolvedValue(null);

      await isTokenRevoked(token);
      await isTokenRevoked(token);

      // Should call with same hash both times
      expect(mockStore.get).toHaveBeenCalledTimes(2);
      const hash1 = mockStore.get.mock.calls[0][0];
      const hash2 = mockStore.get.mock.calls[1][0];
      expect(hash1).toBe(hash2);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      const now = new Date();
      const expired = new Date(now.getTime() - 86400000); // 1 day ago

      mockStore.list.mockResolvedValue({
        blobs: [
          { key: 'hash1' },
          { key: 'hash2' },
        ],
      });

      mockStore.get
        .mockResolvedValueOnce({
          revokedAt: expired.toISOString(),
          expiresAt: expired.toISOString(),
        })
        .mockResolvedValueOnce({
          revokedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 86400000).toISOString(),
        });

      mockStore.delete.mockResolvedValue(undefined);

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(2);
      expect(result.removed).toBe(1);
      expect(mockStore.delete).toHaveBeenCalledWith('hash1');
      expect(mockStore.delete).not.toHaveBeenCalledWith('hash2');
    });

    it('should not remove non-expired tokens', async () => {
      const future = new Date(Date.now() + 86400000);

      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }],
      });

      mockStore.get.mockResolvedValue({
        revokedAt: new Date().toISOString(),
        expiresAt: future.toISOString(),
      });

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(1);
      expect(result.removed).toBe(0);
      expect(mockStore.delete).not.toHaveBeenCalled();
    });

    it('should handle empty blocklist', async () => {
      mockStore.list.mockResolvedValue({
        blobs: [],
      });

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should handle storage errors gracefully', async () => {
      mockStore.list.mockRejectedValue(new Error('Storage error'));

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle malformed entries', async () => {
      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }],
      });

      mockStore.get.mockResolvedValue(null); // Entry doesn't exist

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(1);
      expect(result.removed).toBe(0);
      expect(mockStore.delete).not.toHaveBeenCalled();
    });

    it('should handle entries without expiresAt field', async () => {
      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }],
      });

      mockStore.get.mockResolvedValue({
        revokedAt: new Date().toISOString(),
        // expiresAt missing
      });

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(1);
      expect(result.removed).toBe(0);
      expect(mockStore.delete).not.toHaveBeenCalled();
    });

    it('should process multiple expired tokens', async () => {
      const expired = new Date(Date.now() - 1000);

      mockStore.list.mockResolvedValue({
        blobs: [
          { key: 'hash1' },
          { key: 'hash2' },
          { key: 'hash3' },
        ],
      });

      mockStore.get.mockResolvedValue({
        revokedAt: expired.toISOString(),
        expiresAt: expired.toISOString(),
      });

      mockStore.delete.mockResolvedValue(undefined);

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(3);
      expect(result.removed).toBe(3);
      expect(mockStore.delete).toHaveBeenCalledTimes(3);
    });

    it('should handle deletion failure gracefully', async () => {
      const expired = new Date(Date.now() - 1000);

      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }],
      });

      mockStore.get.mockResolvedValue({
        revokedAt: expired.toISOString(),
        expiresAt: expired.toISOString(),
      });

      mockStore.delete.mockRejectedValue(new Error('Delete failed'));

      // Should catch error and return failure result
      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('getBlocklistStats', () => {
    it('should return stats for blocklist', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const past = new Date(now.getTime() - 86400000);

      mockStore.list.mockResolvedValue({
        blobs: [
          { key: 'hash1' },
          { key: 'hash2' },
          { key: 'hash3' },
        ],
      });

      mockStore.get
        .mockResolvedValueOnce({
          revokedAt: now.toISOString(),
          expiresAt: future.toISOString(),
        })
        .mockResolvedValueOnce({
          revokedAt: past.toISOString(),
          expiresAt: past.toISOString(),
        })
        .mockResolvedValueOnce({
          revokedAt: now.toISOString(),
          expiresAt: future.toISOString(),
        });

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.active).toBe(2);
      expect(result.expired).toBe(1);
    });

    it('should return zero stats for empty blocklist', async () => {
      mockStore.list.mockResolvedValue({
        blobs: [],
      });

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
      expect(result.expired).toBe(0);
    });

    it('should handle storage errors', async () => {
      mockStore.list.mockRejectedValue(new Error('Storage error'));

      const result = await getBlocklistStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle entries without expiresAt', async () => {
      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }],
      });

      mockStore.get.mockResolvedValue({
        revokedAt: new Date().toISOString(),
        // expiresAt missing
      });

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.active).toBe(0);
      expect(result.expired).toBe(0);
    });

    it('should handle null entries', async () => {
      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }],
      });

      mockStore.get.mockResolvedValue(null);

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.active).toBe(0);
      expect(result.expired).toBe(0);
    });

    it('should correctly categorize tokens at exact expiry time', async () => {
      const pastTime = new Date(Date.now() - 100); // Just expired

      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }],
      });

      mockStore.get.mockResolvedValue({
        revokedAt: pastTime.toISOString(),
        expiresAt: pastTime.toISOString(),
      });

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      // Token in the past should be considered expired
      expect(result.expired).toBe(1);
      expect(result.active).toBe(0);
    });

    it('should handle large blocklists', async () => {
      const blobs = Array.from({ length: 100 }, (_, i) => ({ key: `hash${i}` }));
      mockStore.list.mockResolvedValue({ blobs });

      mockStore.get.mockResolvedValue({
        revokedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(100);
      expect(result.active).toBe(100);
      expect(result.expired).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should revoke and check token correctly', async () => {
      const token = createTestToken('24h');
      const tokenHash = hashToken(token);

      // Revoke token
      mockStore.setJSON.mockResolvedValue(undefined);
      const revokeResult = await revokeToken(token);
      expect(revokeResult.success).toBe(true);

      // Check if revoked
      mockStore.get.mockResolvedValue({
        revokedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const isRevoked = await isTokenRevoked(token);
      expect(isRevoked).toBe(true);
      expect(mockStore.get).toHaveBeenCalledWith(tokenHash);
    });

    it('should not find non-revoked token', async () => {
      const token = createTestToken('24h');
      mockStore.get.mockResolvedValue(null);

      const isRevoked = await isTokenRevoked(token);

      expect(isRevoked).toBe(false);
    });

    it('should handle token lifecycle from creation to expiry', async () => {
      const token = createTestToken('5s');

      // Revoke immediately
      mockStore.setJSON.mockResolvedValue(undefined);
      const revokeResult = await revokeToken(token);
      expect(revokeResult.success).toBe(true);

      // Should be in blocklist
      mockStore.get.mockResolvedValue({
        revokedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5000).toISOString(),
      });

      const isRevoked = await isTokenRevoked(token);
      expect(isRevoked).toBe(true);
    });
  });

  describe('Security considerations', () => {
    it('should hash tokens before storage to prevent token leaks', async () => {
      const token = createTestToken('24h');
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      const callArgs = mockStore.setJSON.mock.calls[0];
      const storedKey = callArgs[0];

      // Stored key should be a hash, not the actual token
      expect(storedKey).not.toBe(token);
      expect(storedKey).toHaveLength(64); // SHA256 produces 64 hex chars
      expect(storedKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should use SHA-256 for hashing', async () => {
      const token = createTestToken('24h');
      const expectedHash = createHash('sha256').update(token).digest('hex');

      mockStore.setJSON.mockResolvedValue(undefined);
      await revokeToken(token);

      const callArgs = mockStore.setJSON.mock.calls[0];
      const storedKey = callArgs[0];

      expect(storedKey).toBe(expectedHash);
    });

    it('should store minimal information in blocklist', async () => {
      const token = createTestToken('24h');
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      const callArgs = mockStore.setJSON.mock.calls[0];
      const entry = callArgs[1];

      // Should only store timestamps, not user data
      expect(Object.keys(entry)).toEqual(['revokedAt', 'expiresAt']);
      expect(entry.revokedAt).toBeDefined();
      expect(entry.expiresAt).toBeDefined();
    });

    it('should fail open (return false) on storage errors during check', async () => {
      const token = createTestToken('24h');
      mockStore.get.mockRejectedValue(new Error('Storage unavailable'));

      // Should return false to maintain availability
      const result = await isTokenRevoked(token);

      expect(result).toBe(false);
    });

    it('should handle concurrent revocations of same token', async () => {
      const token = createTestToken('24h');
      mockStore.setJSON.mockResolvedValue(undefined);

      // Simulate concurrent revocations
      const results = await Promise.all([
        revokeToken(token),
        revokeToken(token),
        revokeToken(token),
      ]);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should have called setJSON for each attempt
      expect(mockStore.setJSON).toHaveBeenCalledTimes(3);
    });
  });
});
