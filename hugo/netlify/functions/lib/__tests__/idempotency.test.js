/**
 * Idempotency Key Tests
 * Tests for /netlify/functions/lib/idempotency.js
 *
 * Test Coverage:
 * - First request with idempotency key succeeds
 * - Duplicate request returns cached response
 * - Different keys are handled independently
 * - TTL expiry (24 hours)
 * - Key format validation
 * - Index management
 * - Cleanup of expired keys
 * - Statistics tracking
 * - Header extraction and generation
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

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
  checkIdempotencyKey,
  storeIdempotencyKey,
  getIdempotencyKeyFromRequest,
  getIdempotencyHeaders,
  cleanupExpiredIdempotencyKeys,
  getIdempotencyStats
} = await import('../idempotency.js');

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

describe('Idempotency Key Management', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockStore.get.mockReset();
    mockStore.setJSON.mockReset();
    mockStore.delete.mockReset();
    mockGetStore.mockClear();
  });

  describe('checkIdempotencyKey()', () => {
    test('should return not exists for new key', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      expect(result.exists).toBe(false);
      expect(mockStore.get).toHaveBeenCalledWith('form-123_valid-key-1234567890', { type: 'json' });
    });

    test('should return not exists when key is not provided', async () => {
      const result = await checkIdempotencyKey(null, 'form-123');

      expect(result.exists).toBe(false);
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    test('should return cached response for duplicate request', async () => {
      const cachedResponse = {
        statusCode: 200,
        body: { message: 'Success' }
      };

      mockStore.get.mockResolvedValue({
        key: 'valid-key-1234567890',
        formId: 'form-123',
        response: cachedResponse,
        createdAt: Date.now() - 60000 // 1 minute ago
      });

      const result = await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      expect(result.exists).toBe(true);
      expect(result.response).toEqual(cachedResponse);
      expect(result.createdAt).toBeDefined();
      expect(result.age).toBeGreaterThan(0);
    });

    test('should delete and return not exists when TTL expired (24 hours)', async () => {
      const expiredTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

      mockStore.get.mockResolvedValue({
        key: 'valid-key-1234567890',
        formId: 'form-123',
        response: { statusCode: 200 },
        createdAt: expiredTime
      });

      const result = await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      expect(result.exists).toBe(false);
      expect(mockStore.delete).toHaveBeenCalledWith('form-123_valid-key-1234567890');
    });

    test('should handle keys that are exactly at 24 hour TTL boundary', async () => {
      const exactlyAtBoundary = Date.now() - (24 * 60 * 60 * 1000) - 1; // Just over 24 hours

      mockStore.get.mockResolvedValue({
        key: 'valid-key-1234567890',
        formId: 'form-123',
        response: { statusCode: 200 },
        createdAt: exactlyAtBoundary
      });

      const result = await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      // Should be expired (> 24 hours)
      expect(result.exists).toBe(false);
      expect(mockStore.delete).toHaveBeenCalled();
    });

    test('should reject invalid key format - too short', async () => {
      await expect(
        checkIdempotencyKey('short', 'form-123')
      ).rejects.toThrow('Invalid idempotency key format');
    });

    test('should reject invalid key format - too long', async () => {
      const tooLong = 'a'.repeat(129);

      await expect(
        checkIdempotencyKey(tooLong, 'form-123')
      ).rejects.toThrow('Invalid idempotency key format');
    });

    test('should reject invalid key format - special characters', async () => {
      await expect(
        checkIdempotencyKey('invalid!key@1234567890', 'form-123')
      ).rejects.toThrow('Invalid idempotency key format');
    });

    test('should accept valid key formats', async () => {
      mockStore.get.mockResolvedValue(null);

      const validKeys = [
        'valid-key-1234567890',
        'VALID_KEY_1234567890',
        'valid_key_1234567890',
        'a'.repeat(16), // Minimum length
        'a'.repeat(128), // Maximum length
        '1234567890123456', // Numbers only
        'abcdefghijklmnop', // Letters only
      ];

      for (const key of validKeys) {
        await expect(
          checkIdempotencyKey(key, 'form-123')
        ).resolves.not.toThrow();
      }
    });

    test('should fail open on blob store errors', async () => {
      mockStore.get.mockRejectedValue(new Error('Blob store error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      expect(result.exists).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Idempotency key check error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test('should handle different form IDs independently', async () => {
      mockStore.get.mockResolvedValue(null);

      await checkIdempotencyKey('same-key-1234567890', 'form-123');
      await checkIdempotencyKey('same-key-1234567890', 'form-456');

      expect(mockStore.get).toHaveBeenNthCalledWith(
        1,
        'form-123_same-key-1234567890',
        { type: 'json' }
      );
      expect(mockStore.get).toHaveBeenNthCalledWith(
        2,
        'form-456_same-key-1234567890',
        { type: 'json' }
      );
    });

    test('should calculate age correctly', async () => {
      const createdAt = Date.now() - 120000; // 2 minutes ago

      mockStore.get.mockResolvedValue({
        key: 'valid-key-1234567890',
        formId: 'form-123',
        response: { statusCode: 200 },
        createdAt
      });

      const result = await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      expect(result.age).toBeGreaterThan(115000); // About 2 minutes in ms
      expect(result.age).toBeLessThan(125000);
    });
  });

  describe('storeIdempotencyKey()', () => {
    test('should store key with response and timestamp', async () => {
      const response = {
        statusCode: 200,
        body: { message: 'Success' }
      };

      mockStore.get.mockResolvedValue({ keys: [] }); // For index update

      await storeIdempotencyKey('valid-key-1234567890', 'form-123', response);

      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'form-123_valid-key-1234567890',
        expect.objectContaining({
          key: 'valid-key-1234567890',
          formId: 'form-123',
          response,
          createdAt: expect.any(Number)
        })
      );
    });

    test('should not store when key is not provided', async () => {
      const response = { statusCode: 200 };

      await storeIdempotencyKey(null, 'form-123', response);

      expect(mockStore.setJSON).not.toHaveBeenCalled();
    });

    test('should add key to index', async () => {
      const response = { statusCode: 200 };
      mockStore.get.mockResolvedValue({ keys: [] });

      await storeIdempotencyKey('valid-key-1234567890', 'form-123', response);

      expect(mockStore.get).toHaveBeenCalledWith('index_form-123', { type: 'json' });
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'index_form-123',
        expect.objectContaining({
          keys: expect.arrayContaining([
            expect.objectContaining({
              key: 'form-123_valid-key-1234567890',
              ts: expect.any(Number)
            })
          ])
        })
      );
    });

    test('should limit index to 1000 entries', async () => {
      const existingKeys = Array.from({ length: 1000 }, (_, i) => ({
        key: `form-123_key-${i}`,
        ts: Date.now() - i * 1000
      }));

      mockStore.get.mockResolvedValue({ keys: existingKeys });

      await storeIdempotencyKey('valid-key-1234567890', 'form-123', { statusCode: 200 });

      const indexCall = mockStore.setJSON.mock.calls.find(call => call[0] === 'index_form-123');
      expect(indexCall[1].keys.length).toBe(1000);
    });

    test('should handle index creation for new form', async () => {
      const response = { statusCode: 200 };
      mockStore.get.mockResolvedValue(null); // No existing index

      await storeIdempotencyKey('valid-key-1234567890', 'form-123', response);

      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'index_form-123',
        expect.objectContaining({
          keys: expect.arrayContaining([
            expect.objectContaining({
              key: 'form-123_valid-key-1234567890'
            })
          ])
        })
      );
    });

    test('should not throw on storage errors', async () => {
      mockStore.setJSON.mockRejectedValue(new Error('Storage error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        storeIdempotencyKey('valid-key-1234567890', 'form-123', { statusCode: 200 })
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to store idempotency key:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test('should not throw on index update errors', async () => {
      mockStore.get.mockRejectedValue(new Error('Index error'));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await expect(
        storeIdempotencyKey('valid-key-1234567890', 'form-123', { statusCode: 200 })
      ).resolves.not.toThrow();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getIdempotencyKeyFromRequest()', () => {
    test('should extract key from x-idempotency-key header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-idempotency-key': 'valid-key-1234567890' }
      });

      const key = getIdempotencyKeyFromRequest(request);

      expect(key).toBe('valid-key-1234567890');
    });

    test('should extract key from idempotency-key header (fallback)', () => {
      const request = new Request('https://example.com', {
        headers: { 'idempotency-key': 'valid-key-1234567890' }
      });

      const key = getIdempotencyKeyFromRequest(request);

      expect(key).toBe('valid-key-1234567890');
    });

    test('should prefer x-idempotency-key over idempotency-key', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-idempotency-key': 'preferred-key-1234567890',
          'idempotency-key': 'fallback-key-1234567890'
        }
      });

      const key = getIdempotencyKeyFromRequest(request);

      expect(key).toBe('preferred-key-1234567890');
    });

    test('should return null when no header present', () => {
      const request = new Request('https://example.com', {
        headers: {}
      });

      const key = getIdempotencyKeyFromRequest(request);

      expect(key).toBeNull();
    });
  });

  describe('getIdempotencyHeaders()', () => {
    test('should return empty object when result does not exist', () => {
      const result = { exists: false };
      const headers = getIdempotencyHeaders(result);

      expect(headers).toEqual({});
    });

    test('should return replay headers when result exists', () => {
      const result = {
        exists: true,
        age: 120000, // 120 seconds
        createdAt: Date.now() - 120000
      };

      const headers = getIdempotencyHeaders(result);

      expect(headers['X-Idempotent-Replay']).toBe('true');
      expect(headers['X-Idempotency-Age']).toBe('120');
      expect(headers['X-Idempotency-Created']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('should convert age from milliseconds to seconds', () => {
      const result = {
        exists: true,
        age: 5500, // 5.5 seconds
        createdAt: Date.now() - 5500
      };

      const headers = getIdempotencyHeaders(result);

      expect(headers['X-Idempotency-Age']).toBe('5');
    });

    test('should format createdAt as ISO string', () => {
      const createdAt = new Date('2024-01-15T12:00:00.000Z').getTime();
      const result = {
        exists: true,
        age: 60000,
        createdAt
      };

      const headers = getIdempotencyHeaders(result);

      expect(headers['X-Idempotency-Created']).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('cleanupExpiredIdempotencyKeys()', () => {
    test('should cleanup expired keys for specific form', async () => {
      const now = Date.now();
      const expired1 = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const expired2 = now - (26 * 60 * 60 * 1000); // 26 hours ago
      const active = now - (12 * 60 * 60 * 1000); // 12 hours ago

      mockStore.get.mockResolvedValue({
        keys: [
          { key: 'form-123_expired-1', ts: expired1 },
          { key: 'form-123_expired-2', ts: expired2 },
          { key: 'form-123_active-1', ts: active }
        ]
      });

      const result = await cleanupExpiredIdempotencyKeys('form-123');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(mockStore.delete).toHaveBeenCalledWith('form-123_expired-1');
      expect(mockStore.delete).toHaveBeenCalledWith('form-123_expired-2');
      expect(mockStore.delete).not.toHaveBeenCalledWith('form-123_active-1');
    });

    test('should update index after cleanup', async () => {
      const now = Date.now();
      const expired = now - (25 * 60 * 60 * 1000);
      const active = now - (12 * 60 * 60 * 1000);

      mockStore.get.mockResolvedValue({
        keys: [
          { key: 'form-123_expired-1', ts: expired },
          { key: 'form-123_active-1', ts: active }
        ]
      });

      await cleanupExpiredIdempotencyKeys('form-123');

      const indexUpdate = mockStore.setJSON.mock.calls.find(call => call[0] === 'index_form-123');
      expect(indexUpdate[1].keys).toHaveLength(1);
      expect(indexUpdate[1].keys[0].key).toBe('form-123_active-1');
    });

    test('should handle empty index', async () => {
      mockStore.get.mockResolvedValue({ keys: [] });

      const result = await cleanupExpiredIdempotencyKeys('form-123');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    test('should handle missing index', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await cleanupExpiredIdempotencyKeys('form-123');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    test('should handle cleanup errors gracefully', async () => {
      mockStore.get.mockRejectedValue(new Error('Cleanup error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await cleanupExpiredIdempotencyKeys('form-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cleanup error');

      consoleErrorSpy.mockRestore();
    });

    test('should return success when no formId provided', async () => {
      const result = await cleanupExpiredIdempotencyKeys();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('getIdempotencyStats()', () => {
    test('should return statistics for form', async () => {
      const now = Date.now();
      const active1 = now - (12 * 60 * 60 * 1000); // 12 hours ago
      const active2 = now - (18 * 60 * 60 * 1000); // 18 hours ago
      const expired = now - (25 * 60 * 60 * 1000); // 25 hours ago

      mockStore.get.mockResolvedValue({
        keys: [
          { key: 'form-123_key-1', ts: active1 },
          { key: 'form-123_key-2', ts: active2 },
          { key: 'form-123_key-3', ts: expired }
        ]
      });

      const stats = await getIdempotencyStats('form-123');

      expect(stats.formId).toBe('form-123');
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.expired).toBe(1);
      expect(stats.oldestActive).toBe(active2);
    });

    test('should handle empty index', async () => {
      mockStore.get.mockResolvedValue({ keys: [] });

      const stats = await getIdempotencyStats('form-123');

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.oldestActive).toBeNull();
    });

    test('should handle missing index', async () => {
      mockStore.get.mockResolvedValue(null);

      const stats = await getIdempotencyStats('form-123');

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.expired).toBe(0);
    });

    test('should handle errors gracefully', async () => {
      mockStore.get.mockRejectedValue(new Error('Stats error'));

      const stats = await getIdempotencyStats('form-123');

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.error).toBe('Stats error');
    });
  });

  describe('Blob Store Integration', () => {
    test('should use correct store name and consistency', async () => {
      mockStore.get.mockResolvedValue(null);

      await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      expect(mockGetStore).toHaveBeenCalledWith({
        name: 'vf-idempotency',
        consistency: 'strong'
      });
    });

    test('should create scoped storage keys', async () => {
      mockStore.get.mockResolvedValue(null);

      await checkIdempotencyKey('valid-key-1234567890', 'form-123');

      expect(mockStore.get).toHaveBeenCalledWith(
        'form-123_valid-key-1234567890',
        { type: 'json' }
      );
    });
  });

  describe('Integration - Complete Flow', () => {
    test('should handle first request and duplicate correctly', async () => {
      const key = 'integration-key-1234567890';
      const formId = 'form-123';
      const response = { statusCode: 200, body: { id: 1 } };

      // First request - key doesn't exist
      mockStore.get.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ keys: [] }); // For index

      const firstCheck = await checkIdempotencyKey(key, formId);
      expect(firstCheck.exists).toBe(false);

      await storeIdempotencyKey(key, formId, response);

      // Second request - key exists
      const storedData = mockStore.setJSON.mock.calls[0][1];
      mockStore.get.mockResolvedValueOnce(storedData);

      const secondCheck = await checkIdempotencyKey(key, formId);
      expect(secondCheck.exists).toBe(true);
      expect(secondCheck.response).toEqual(response);
    });

    test('should handle different keys independently', async () => {
      const formId = 'form-123';
      mockStore.get.mockResolvedValue(null).mockResolvedValue({ keys: [] });

      const key1 = 'key-1234567890abcdef';
      const key2 = 'key-fedcba0987654321';

      await storeIdempotencyKey(key1, formId, { id: 1 });
      await storeIdempotencyKey(key2, formId, { id: 2 });

      expect(mockStore.setJSON).toHaveBeenCalledWith(
        `${formId}_${key1}`,
        expect.any(Object)
      );
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        `${formId}_${key2}`,
        expect.any(Object)
      );
    });
  });
});
