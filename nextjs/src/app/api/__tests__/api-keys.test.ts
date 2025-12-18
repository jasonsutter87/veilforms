/**
 * API Integration Tests - API Keys Routes
 * Tests for /api/api-keys/* endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as apiKeysGET, POST as apiKeysPOST } from '../api-keys/route';
import {
  createMockRequest,
  createAuthenticatedRequest,
  getResponseJson,
  createMockGetStore,
} from '../../../../__tests__/helpers/api.helper';
import { createTestUser } from '../../../../__tests__/factories/user.factory';
import * as rateLimit from '@/lib/rate-limit';

// Mock all external dependencies
vi.mock('@/lib/rate-limit');

// Mock Netlify Blobs with inline factory
let mockStores: Map<string, ReturnType<typeof createMockGetStore>['stores'] extends Map<string, infer U> ? U : never>;
let mockGetStore: ReturnType<typeof createMockGetStore>['getStore'];

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn((options: { name: string }) => {
    if (!mockStores) {
      mockStores = new Map();
    }
    if (!mockStores.has(options.name)) {
      const storage = new Map<string, string>();
      mockStores.set(options.name, {
        storage,
        get: vi.fn(async (key: string, opts?: { type?: string }) => {
          const value = storage.get(key);
          if (!value) return null;
          if (opts?.type === 'json') {
            return JSON.parse(value);
          }
          return value;
        }),
        set: vi.fn(async (key: string, value: string) => {
          storage.set(key, value);
        }),
        setJSON: vi.fn(async (key: string, value: unknown) => {
          storage.set(key, JSON.stringify(value));
        }),
        delete: vi.fn(async (key: string) => {
          storage.delete(key);
        }),
        list: vi.fn(async () => ({
          blobs: Array.from(storage.keys()).map(key => ({ key })),
        })),
      } as ReturnType<typeof createMockGetStore>['stores'] extends Map<string, infer U> ? U : never);
    }
    return mockStores.get(options.name)!;
  }),
}));

// Mock crypto for key hashing
vi.stubGlobal('crypto', {
  ...global.crypto,
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
});

describe('API Keys API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear all stores
    if (mockStores) {
      mockStores.clear();
    }

    // Mock rate limiting to always allow
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 60000,
    });

    vi.mocked(rateLimit.getRateLimitHeaders).mockReturnValue(new Headers());
  });

  describe('GET /api/api-keys', () => {
    it('should return user API keys successfully', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const { getStore } = await import('@netlify/blobs');
      const store = getStore({ name: 'vf-api-keys' });

      // Setup test data
      const keyIds = ['key-hash-1', 'key-hash-2'];
      await store.setJSON(`user_keys_${testUser.id}`, keyIds);

      await store.setJSON('key-hash-1', {
        userId: testUser.id,
        name: 'Production Key',
        prefix: 'vf_prod...',
        keyHash: 'key-hash-1',
        permissions: ['forms:read', 'forms:write'],
        createdAt: new Date().toISOString(),
        lastUsed: null,
      });

      await store.setJSON('key-hash-2', {
        userId: testUser.id,
        name: 'Development Key',
        prefix: 'vf_dev...',
        keyHash: 'key-hash-2',
        permissions: ['forms:read'],
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      });

      const req = createAuthenticatedRequest(
        'GET',
        '/api/api-keys',
        testUser.id,
        testUser.email
      );

      const response = await apiKeysGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        keys: expect.arrayContaining([
          expect.objectContaining({
            id: 'key-hash-1',
            name: 'Production Key',
            prefix: 'vf_prod...',
          }),
          expect.objectContaining({
            id: 'key-hash-2',
            name: 'Development Key',
            prefix: 'vf_dev...',
          }),
        ]),
        total: 2,
      });
    });

    it('should return empty list for user with no keys', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'GET',
        '/api/api-keys',
        testUser.id,
        testUser.email
      );

      const response = await apiKeysGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        keys: [],
        total: 0,
      });
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('GET', '/api/api-keys');

      const response = await apiKeysGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('should respect rate limiting', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
        allowed: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      });

      const req = createAuthenticatedRequest(
        'GET',
        '/api/api-keys',
        testUser.id,
        testUser.email
      );

      const response = await apiKeysGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key successfully', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'My Production Key',
            permissions: ['forms:read', 'forms:write'],
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        key: {
          id: expect.any(String),
          name: 'My Production Key',
          key: expect.stringMatching(/^vf_/),
          permissions: ['forms:read', 'forms:write'],
          createdAt: expect.any(String),
        },
        warning: expect.stringContaining('Save this API key'),
      });

      // Verify key was stored
      const { getStore } = await import('@netlify/blobs');
      const store = getStore({ name: 'vf-api-keys' });
      expect(store.setJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: testUser.id,
          name: 'My Production Key',
          permissions: ['forms:read', 'forms:write'],
        })
      );
    });

    it('should create key with default permissions if not specified', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Default Permissions Key',
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(201);
      expect(data.key.permissions).toEqual([
        'forms:read',
        'forms:write',
        'submissions:read',
        'submissions:delete',
      ]);
    });

    it('should reject creation with missing name', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {},
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Key name is required');
    });

    it('should reject creation with empty name', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: '   ',
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Key name is required');
    });

    it('should reject creation with name too long', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'x'.repeat(51),
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('50 characters or less');
    });

    it('should reject creation with invalid permissions', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Invalid Key',
            permissions: ['forms:read', 'invalid:permission'],
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid permission');
    });

    it('should enforce maximum key limit (5 keys)', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      // Setup existing 5 keys
      const { getStore } = await import('@netlify/blobs');
      const store = getStore({ name: 'vf-api-keys' });
      const existingKeys = Array.from({ length: 5 }, (_, i) => `key-hash-${i}`);
      await store.setJSON(`user_keys_${testUser.id}`, existingKeys);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Sixth Key',
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Maximum number of API keys reached');
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('POST', '/api/api-keys', {
        body: {
          name: 'Test Key',
        },
      });

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('should respect rate limiting', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
        allowed: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Test Key',
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });

    it('should validate permission types', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const validPermissions = [
        ['forms:read'],
        ['forms:write'],
        ['submissions:read'],
        ['submissions:delete'],
        ['forms:read', 'submissions:read'],
      ];

      for (const permissions of validPermissions) {
        const req = createAuthenticatedRequest(
          'POST',
          '/api/api-keys',
          testUser.id,
          testUser.email,
          {
            body: {
              name: `Key ${permissions.join('_')}`,
              permissions,
            },
          }
        );

        const response = await apiKeysPOST(req);
        expect(response.status).toBe(201);
      }
    });

    it('should generate unique key prefixes', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req1 = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Key 1',
          },
        }
      );

      const req2 = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Key 2',
          },
        }
      );

      const response1 = await apiKeysPOST(req1);
      const data1 = await getResponseJson(response1);

      const response2 = await apiKeysPOST(req2);
      const data2 = await getResponseJson(response2);

      expect(data1.key.key).not.toBe(data2.key.key);
      expect(data1.key.key).toMatch(/^vf_/);
      expect(data2.key.key).toMatch(/^vf_/);
    });

    it('should trim whitespace from key name', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/api-keys',
        testUser.id,
        testUser.email,
        {
          body: {
            name: '  Trimmed Name  ',
          },
        }
      );

      const response = await apiKeysPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(201);
      expect(data.key.name).toBe('Trimmed Name');
    });
  });
});
