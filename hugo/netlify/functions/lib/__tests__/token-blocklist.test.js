import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock @netlify/blobs before importing
const mockStore = {
  get: jest.fn(),
  getJSON: jest.fn(),
  setJSON: jest.fn(),
  delete: jest.fn(),
  list: jest.fn()
};

const mockGetStore = jest.fn(() => mockStore);

jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: mockGetStore
}));

// Import after mocking
const { revokeToken, isTokenRevoked, cleanupExpiredTokens, getBlocklistStats } =
  await import('../token-blocklist.js');

describe('Token Blocklist', () => {
  // Create a mock token for testing
  const JWT_SECRET = 'test-secret';
  const createMockToken = (expiresIn = '24h') => {
    return jwt.sign(
      { userId: 'user_123', email: 'test@example.com' },
      JWT_SECRET,
      { expiresIn, algorithm: 'HS256' }
    );
  };

  // Helper to compute expected hash
  const computeHash = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
  };

  beforeEach(() => {
    // Clear all mocks
    mockStore.get.mockClear();
    mockStore.getJSON.mockClear();
    mockStore.setJSON.mockClear();
    mockStore.delete.mockClear();
    mockStore.list.mockClear();
    mockGetStore.mockClear();
  });

  describe('revokeToken', () => {
    it('should successfully revoke a valid token', async () => {
      const token = createMockToken('24h');
      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await revokeToken(token);

      expect(result.success).toBe(true);
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          revokedAt: expect.any(String),
          expiresAt: expect.any(String)
        }),
        expect.objectContaining({
          metadata: { ttl: expect.any(Number) }
        })
      );
    });

    it('should not revoke an expired token', async () => {
      // Create a token that's already expired
      const token = jwt.sign(
        { userId: 'user_123' },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const result = await revokeToken(token);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('token_already_expired');
      expect(mockStore.setJSON).not.toHaveBeenCalled();
    });

    it('should handle missing token', async () => {
      const result = await revokeToken(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token is required');
      expect(mockStore.setJSON).not.toHaveBeenCalled();
    });

    it('should handle empty string token', async () => {
      const result = await revokeToken('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token is required');
    });

    it('should set appropriate TTL based on token expiry', async () => {
      const token = createMockToken('1h'); // 1 hour = 3600 seconds
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      expect(mockStore.setJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          metadata: {
            ttl: expect.any(Number)
          }
        })
      );

      // Verify TTL is approximately 1 hour (within 10 seconds tolerance)
      const call = mockStore.setJSON.mock.calls[0];
      const ttl = call[2].metadata.ttl;
      expect(ttl).toBeGreaterThan(3590);
      expect(ttl).toBeLessThan(3610);
    });

    it('should handle storage errors gracefully', async () => {
      const token = createMockToken('24h');
      mockStore.setJSON.mockRejectedValue(new Error('Storage failure'));

      const result = await revokeToken(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage failure');
    });

    it('should hash tokens before storing', async () => {
      const token = createMockToken('24h');
      mockStore.setJSON.mockResolvedValue(undefined);

      await revokeToken(token);

      // Verify the key is a hash, not the actual token
      const storedKey = mockStore.setJSON.mock.calls[0][0];
      expect(storedKey).not.toBe(token);
      expect(storedKey).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash in hex
    });
  });

  describe('isTokenRevoked', () => {
    it('should return true for revoked token', async () => {
      const token = createMockToken('24h');
      // Return a non-null value to indicate token is revoked
      mockStore.get.mockResolvedValue('revoked-entry-data');

      const result = await isTokenRevoked(token);

      // Note: mockGetStore may not be called if getBlocklistStore() is called once and cached
      expect(mockStore.get).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false for non-revoked token', async () => {
      const token = createMockToken('24h');
      mockStore.get.mockResolvedValue(null);

      const result = await isTokenRevoked(token);

      expect(result).toBe(false);
    });

    it('should return false for null token', async () => {
      const result = await isTokenRevoked(null);

      expect(result).toBe(false);
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should return false for empty token', async () => {
      const result = await isTokenRevoked('');

      expect(result).toBe(false);
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should fail open on storage errors', async () => {
      const token = createMockToken('24h');
      mockStore.get.mockRejectedValue(new Error('Storage error'));

      // Should return false (allow token) rather than blocking all requests
      const result = await isTokenRevoked(token);

      expect(result).toBe(false);
    });

    it('should use hashed token for lookup', async () => {
      const token = createMockToken('24h');
      mockStore.get.mockResolvedValue(null);

      await isTokenRevoked(token);

      const lookupKey = mockStore.get.mock.calls[0][0];
      expect(lookupKey).not.toBe(token);
      expect(lookupKey).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should remove expired tokens', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 3600000); // 1 hour ago

      mockStore.list.mockResolvedValue({
        blobs: [
          { key: 'hash1' },
          { key: 'hash2' },
          { key: 'hash3' }
        ]
      });

      mockStore.getJSON
        .mockResolvedValueOnce({ expiresAt: pastDate.toISOString() })
        .mockResolvedValueOnce({ expiresAt: new Date(now.getTime() + 3600000).toISOString() })
        .mockResolvedValueOnce({ expiresAt: pastDate.toISOString() });

      mockStore.delete.mockResolvedValue(undefined);

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(3);
      expect(result.removed).toBe(2);
      expect(mockStore.delete).toHaveBeenCalledTimes(2);
      expect(mockStore.delete).toHaveBeenCalledWith('hash1');
      expect(mockStore.delete).toHaveBeenCalledWith('hash3');
    });

    it('should not remove active tokens', async () => {
      const futureDate = new Date(Date.now() + 3600000);

      mockStore.list.mockResolvedValue({
        blobs: [{ key: 'hash1' }]
      });

      mockStore.getJSON.mockResolvedValue({
        expiresAt: futureDate.toISOString()
      });

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(1);
      expect(result.removed).toBe(0);
      expect(mockStore.delete).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockStore.list.mockRejectedValue(new Error('List failed'));

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(false);
      expect(result.error).toBe('List failed');
    });

    it('should handle empty blocklist', async () => {
      mockStore.list.mockResolvedValue({ blobs: [] });

      const result = await cleanupExpiredTokens();

      expect(result.success).toBe(true);
      expect(result.checked).toBe(0);
      expect(result.removed).toBe(0);
    });
  });

  describe('getBlocklistStats', () => {
    it('should return accurate statistics', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 3600000);
      const futureDate = new Date(now.getTime() + 3600000);

      mockStore.list.mockResolvedValue({
        blobs: [
          { key: 'hash1' },
          { key: 'hash2' },
          { key: 'hash3' },
          { key: 'hash4' }
        ]
      });

      mockStore.getJSON
        .mockResolvedValueOnce({ expiresAt: futureDate.toISOString() })
        .mockResolvedValueOnce({ expiresAt: pastDate.toISOString() })
        .mockResolvedValueOnce({ expiresAt: futureDate.toISOString() })
        .mockResolvedValueOnce({ expiresAt: pastDate.toISOString() });

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(4);
      expect(result.active).toBe(2);
      expect(result.expired).toBe(2);
    });

    it('should handle empty blocklist', async () => {
      mockStore.list.mockResolvedValue({ blobs: [] });

      const result = await getBlocklistStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
      expect(result.expired).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockStore.list.mockRejectedValue(new Error('Stats failed'));

      const result = await getBlocklistStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stats failed');
    });
  });

  describe('Token hash consistency', () => {
    it('should generate same hash for same token', async () => {
      const token = createMockToken('24h');

      mockStore.setJSON.mockResolvedValue(undefined);
      await revokeToken(token);
      const revokeHash = mockStore.setJSON.mock.calls[0][0];

      mockStore.get.mockResolvedValue(null);
      await isTokenRevoked(token);
      const checkHash = mockStore.get.mock.calls[0][0];

      expect(revokeHash).toBe(checkHash);
    });
  });
});
