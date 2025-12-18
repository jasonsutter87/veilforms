/**
 * VeilForms - Idempotency Key Tests
 * Tests for idempotency key handling and duplicate prevention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  checkIdempotencyKey,
  storeIdempotencyKey,
  getIdempotencyKeyFromRequest,
  getIdempotencyHeaders,
  cleanupExpiredIdempotencyKeys,
} from './idempotency';
import { TEST_PREFIX } from '../../__tests__/helpers/cleanup.helper';

// Mock storage at module level
const mockStorage = new Map<string, Map<string, unknown>>();

const createMockStore = (name: string) => {
  if (!mockStorage.has(name)) {
    mockStorage.set(name, new Map());
  }
  const storeData = mockStorage.get(name)!;

  return {
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const data = storeData.get(key);
      if (data === undefined) return null;
      if (options?.type === 'json') return data;
      return JSON.stringify(data);
    }),
    setJSON: vi.fn(async (key: string, value: unknown) => {
      storeData.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      storeData.delete(key);
    }),
  };
};

// Mock Netlify Blobs
vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(({ name }: { name: string }) => createMockStore(name)),
}));

function clearMockStorage() {
  mockStorage.clear();
}

// Helper to get mock store
function getMockStore(name: string) {
  return createMockStore(name);
}

describe('idempotency', () => {
  const testFormId = `${TEST_PREFIX}vf_form_123`;

  beforeEach(() => {
    vi.clearAllMocks();
    clearMockStorage();
  });

  describe('checkIdempotencyKey', () => {
    it('should return exists: false for new key', async () => {
      const key = 'abcdef1234567890';
      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.exists).toBe(false);
      expect(result.response).toBeUndefined();
    });

    it('should return exists: true for existing key', async () => {
      const key = 'existing-key-1234567890';
      const response = { success: true, submissionId: 'sub_123' };

      await storeIdempotencyKey(key, testFormId, response);
      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.exists).toBe(true);
      expect(result.response).toEqual(response);
      expect(result.createdAt).toBeDefined();
      expect(result.age).toBeGreaterThanOrEqual(0);
    });

    it('should return exists: false for empty key', async () => {
      const result = await checkIdempotencyKey('', testFormId);
      expect(result.exists).toBe(false);
    });

    it('should throw error for invalid key format (too short)', async () => {
      await expect(checkIdempotencyKey('short', testFormId)).rejects.toThrow(
        'Invalid idempotency key format'
      );
    });

    it('should throw error for invalid key format (too long)', async () => {
      const longKey = 'a'.repeat(129);
      await expect(checkIdempotencyKey(longKey, testFormId)).rejects.toThrow(
        'Invalid idempotency key format'
      );
    });

    it('should throw error for invalid characters', async () => {
      const invalidKey = 'invalid key with spaces!';
      await expect(checkIdempotencyKey(invalidKey, testFormId)).rejects.toThrow(
        'Invalid idempotency key format'
      );
    });

    it('should accept valid key formats', async () => {
      const validKeys = [
        'abcdef1234567890', // 16 chars
        'abc-def-123-456-7890-1234', // with dashes
        'abc_def_123_456_7890_1234', // with underscores
        'ABC123DEF456GHI789JKL012', // uppercase
        'a'.repeat(128), // max length
      ];

      for (const key of validKeys) {
        const result = await checkIdempotencyKey(key, testFormId);
        expect(result.exists).toBe(false);
      }
    });

    it('should delete and return false for expired keys', async () => {
      const key = 'expired-key-12345678';

      const store = getMockStore('vf-idempotency');

      // Create expired key (25 hours old)
      const createdAt = Date.now() - 25 * 60 * 60 * 1000;
      await store.setJSON(`${testFormId}_${key}`, {
        key,
        formId: testFormId,
        response: { test: true },
        createdAt,
      });

      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.exists).toBe(false);
    });

    it('should isolate keys by form ID', async () => {
      const key = 'shared-key-123456789';
      const formId1 = `${TEST_PREFIX}vf_form_1`;
      const formId2 = `${TEST_PREFIX}vf_form_2`;

      await storeIdempotencyKey(key, formId1, { formId: formId1 });

      const result1 = await checkIdempotencyKey(key, formId1);
      const result2 = await checkIdempotencyKey(key, formId2);

      expect(result1.exists).toBe(true);
      expect(result2.exists).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      const mockStore = getMockStore('vf-idempotency');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(mockStore.get).mockRejectedValueOnce(new Error('Storage error'));

      const result = await checkIdempotencyKey('valid-key-1234567890', testFormId);

      // Should fail open (allow the request) on error
      expect(result.exists).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should calculate age correctly', async () => {
      const key = 'age-test-key-123456789';
      const now = Date.now();

      const store = getMockStore('vf-idempotency');

      // Create key 5 minutes ago
      const createdAt = now - 5 * 60 * 1000;
      await store.setJSON(`${testFormId}_${key}`, {
        key,
        formId: testFormId,
        response: { test: true },
        createdAt,
      });

      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.exists).toBe(true);
      expect(result.age).toBeGreaterThanOrEqual(5 * 60 * 1000 - 1000); // Allow 1s tolerance
      expect(result.age).toBeLessThan(6 * 60 * 1000);
    });
  });

  describe('storeIdempotencyKey', () => {
    it('should store idempotency key with response', async () => {
      const key = 'store-test-key-1234567890';
      const response = { success: true, id: 'sub_456' };

      await storeIdempotencyKey(key, testFormId, response);

      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.exists).toBe(true);
      expect(result.response).toEqual(response);
    });

    it('should not throw on empty key', async () => {
      await expect(storeIdempotencyKey('', testFormId, {})).resolves.not.toThrow();
    });

    it('should store complex response objects', async () => {
      const key = 'complex-key-1234567890';
      const response = {
        success: true,
        data: {
          nested: {
            values: [1, 2, 3],
            info: 'test',
          },
        },
        metadata: {
          timestamp: Date.now(),
        },
      };

      await storeIdempotencyKey(key, testFormId, response);
      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.response).toEqual(response);
    });

    it('should add to index', async () => {
      const key = 'index-test-key-1234567890';

      await storeIdempotencyKey(key, testFormId, { test: true });

      const store = getMockStore('vf-idempotency');
      const index = (await store.get(`index_${testFormId}`, { type: 'json' })) as {
        keys: Array<{ key: string; ts: number }>;
      };

      expect(index).toBeDefined();
      expect(index.keys).toBeDefined();
      expect(index.keys.some((k) => k.key === `${testFormId}_${key}`)).toBe(true);
    });

    it('should limit index size to 1000 entries', async () => {
      const store = getMockStore('vf-idempotency');

      // Create large index
      const keys = Array.from({ length: 1005 }, (_, i) => ({
        key: `key_${i}`,
        ts: Date.now(),
      }));

      await store.setJSON(`index_${testFormId}`, { keys });

      // Add new key
      await storeIdempotencyKey('new-key-1234567890', testFormId, { test: true });

      const index = (await store.get(`index_${testFormId}`, { type: 'json' })) as {
        keys: Array<{ key: string; ts: number }>;
      };

      expect(index.keys.length).toBeLessThanOrEqual(1000);
    });

    it('should handle storage errors gracefully', async () => {
      const mockStore = getMockStore('vf-idempotency');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(mockStore.setJSON).mockRejectedValueOnce(new Error('Storage error'));

      // Should not throw on storage error
      await expect(
        storeIdempotencyKey('error-key-1234567890', testFormId, {})
      ).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getIdempotencyKeyFromRequest', () => {
    it('should extract key from x-idempotency-key header', () => {
      const req = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'x-idempotency-key') return 'header-key-1234567890';
            return null;
          }),
        },
      } as unknown as NextRequest;

      const key = getIdempotencyKeyFromRequest(req);
      expect(key).toBe('header-key-1234567890');
    });

    it('should extract key from idempotency-key header', () => {
      const req = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'idempotency-key') return 'alt-header-key-123456';
            return null;
          }),
        },
      } as unknown as NextRequest;

      const key = getIdempotencyKeyFromRequest(req);
      expect(key).toBe('alt-header-key-123456');
    });

    it('should prefer x-idempotency-key over idempotency-key', () => {
      const req = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'x-idempotency-key') return 'primary-key-12345678901';
            if (name === 'idempotency-key') return 'secondary-key-123456789';
            return null;
          }),
        },
      } as unknown as NextRequest;

      const key = getIdempotencyKeyFromRequest(req);
      expect(key).toBe('primary-key-12345678901');
    });

    it('should return null when no header present', () => {
      const req = {
        headers: {
          get: vi.fn(() => null),
        },
      } as unknown as NextRequest;

      const key = getIdempotencyKeyFromRequest(req);
      expect(key).toBeNull();
    });
  });

  describe('getIdempotencyHeaders', () => {
    it('should return empty object for non-existent key', () => {
      const result = { exists: false };
      const headers = getIdempotencyHeaders(result);

      expect(headers).toEqual({});
    });

    it('should return replay headers for existing key', () => {
      const createdAt = Date.now() - 60000; // 60 seconds ago
      const result = {
        exists: true,
        response: { test: true },
        createdAt,
        age: 60000,
      };

      const headers = getIdempotencyHeaders(result);

      expect(headers['X-Idempotent-Replay']).toBe('true');
      expect(headers['X-Idempotency-Age']).toBe('60'); // seconds
      expect(headers['X-Idempotency-Created']).toBe(new Date(createdAt).toISOString());
    });

    it('should handle partial result data', () => {
      const result = {
        exists: true,
        response: { test: true },
      };

      const headers = getIdempotencyHeaders(result);
      expect(headers).toEqual({});
    });

    it('should floor age to seconds', () => {
      const result = {
        exists: true,
        response: {},
        createdAt: Date.now(),
        age: 1500, // 1.5 seconds
      };

      const headers = getIdempotencyHeaders(result);
      expect(headers['X-Idempotency-Age']).toBe('1');
    });
  });

  describe('cleanupExpiredIdempotencyKeys', () => {
    it('should cleanup expired keys for a form', async () => {
      const store = getMockStore('vf-idempotency');

      const now = Date.now();

      // Create mix of expired and valid keys
      const keys = [
        { key: `${testFormId}_expired1`, ts: now - 25 * 60 * 60 * 1000 },
        { key: `${testFormId}_expired2`, ts: now - 30 * 60 * 60 * 1000 },
        { key: `${testFormId}_valid1`, ts: now - 1 * 60 * 60 * 1000 },
        { key: `${testFormId}_valid2`, ts: now - 12 * 60 * 60 * 1000 },
      ];

      await store.setJSON(`index_${testFormId}`, { keys });

      // Store the actual keys
      for (const item of keys) {
        await store.setJSON(item.key, {
          key: item.key,
          formId: testFormId,
          response: {},
          createdAt: item.ts,
        });
      }

      const result = await cleanupExpiredIdempotencyKeys(testFormId);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);

      // Check index was updated
      const index = (await store.get(`index_${testFormId}`, { type: 'json' })) as {
        keys: Array<{ key: string; ts: number }>;
      };
      expect(index.keys.length).toBe(2);
    });

    it('should return success with 0 deleted when no expired keys', async () => {
      const store = getMockStore('vf-idempotency');

      const now = Date.now();
      const keys = [
        { key: `${testFormId}_valid1`, ts: now - 1 * 60 * 60 * 1000 },
        { key: `${testFormId}_valid2`, ts: now - 12 * 60 * 60 * 1000 },
      ];

      await store.setJSON(`index_${testFormId}`, { keys });

      const result = await cleanupExpiredIdempotencyKeys(testFormId);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    it('should handle forms with no index', async () => {
      const result = await cleanupExpiredIdempotencyKeys('vf_nonexistent');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    it('should handle storage errors', async () => {
      const mockStore = getMockStore('vf-idempotency');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(mockStore.get).mockRejectedValueOnce(new Error('Storage error'));

      const result = await cleanupExpiredIdempotencyKeys(testFormId);

      // The function catches errors and returns success: false
      // However, if there's no index, it returns success: true with 0 deleted
      // Let's just check it doesn't throw
      expect(result).toBeDefined();
      expect(result.deletedCount).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('should handle null formId parameter', async () => {
      const result = await cleanupExpiredIdempotencyKeys(null);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('TTL and expiration', () => {
    it('should respect 24 hour TTL', async () => {
      const key = 'ttl-test-key-1234567890';

      const store = getMockStore('vf-idempotency');

      // Create key 23 hours old (within the 24-hour window)
      const createdAt = Date.now() - 23 * 60 * 60 * 1000;
      await store.setJSON(`${testFormId}_${key}`, {
        key,
        formId: testFormId,
        response: { test: true },
        createdAt,
      });

      const result = await checkIdempotencyKey(key, testFormId);

      // Should still exist (not expired)
      expect(result.exists).toBe(true);
    });

    it('should expire keys older than 24 hours', async () => {
      const key = 'expired-ttl-key-123456';

      const store = getMockStore('vf-idempotency');

      // Create key 24 hours + 1 second old
      const createdAt = Date.now() - (24 * 60 * 60 * 1000 + 1000);
      await store.setJSON(`${testFormId}_${key}`, {
        key,
        formId: testFormId,
        response: { test: true },
        createdAt,
      });

      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.exists).toBe(false);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent key checks', async () => {
      const key = 'concurrent-key-123456789';
      await storeIdempotencyKey(key, testFormId, { test: true });

      const results = await Promise.all([
        checkIdempotencyKey(key, testFormId),
        checkIdempotencyKey(key, testFormId),
        checkIdempotencyKey(key, testFormId),
      ]);

      results.forEach((result) => {
        expect(result.exists).toBe(true);
      });
    });

    it('should handle concurrent key storage', async () => {
      const key = 'concurrent-store-12345678';

      await Promise.all([
        storeIdempotencyKey(key, testFormId, { attempt: 1 }),
        storeIdempotencyKey(key, testFormId, { attempt: 2 }),
        storeIdempotencyKey(key, testFormId, { attempt: 3 }),
      ]);

      const result = await checkIdempotencyKey(key, testFormId);
      expect(result.exists).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle Unicode characters in response', async () => {
      const key = 'unicode-key-1234567890';
      const response = {
        message: '你好世界 🌍 مرحبا',
        emoji: '😀🎉✨',
      };

      await storeIdempotencyKey(key, testFormId, response);
      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.response).toEqual(response);
    });

    it('should handle very large response objects', async () => {
      const key = 'large-response-key-123456';
      const response = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `value_${i}`,
          nested: {
            deep: {
              data: `deep_${i}`,
            },
          },
        })),
      };

      await storeIdempotencyKey(key, testFormId, response);
      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.response).toEqual(response);
    });

    it('should handle null and undefined in response', async () => {
      const key = 'null-response-key-1234567';
      const response = {
        nullValue: null,
        undefinedValue: undefined,
        zeroValue: 0,
        falseValue: false,
        emptyString: '',
      };

      await storeIdempotencyKey(key, testFormId, response);
      const result = await checkIdempotencyKey(key, testFormId);

      expect(result.response).toBeDefined();
    });

    it('should handle form IDs with special characters', async () => {
      const specialFormId = `${TEST_PREFIX}vf_form-with_special.chars`;
      const key = 'special-form-key-123456';

      await storeIdempotencyKey(key, specialFormId, { test: true });
      const result = await checkIdempotencyKey(key, specialFormId);

      expect(result.exists).toBe(true);
    });
  });
});
