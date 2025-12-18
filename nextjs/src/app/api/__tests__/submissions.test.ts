/**
 * API Integration Tests - Submissions Routes
 * Tests for /api/submit and /api/submissions/* endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as submitPOST } from '../submit/route';
import { createMockRequest, getResponseJson, createMockGetStore } from '../../../../__tests__/helpers/api.helper';
import { createTestUser } from '../../../../__tests__/factories/user.factory';
import { createTestForm } from '../../../../__tests__/factories/form.factory';
import * as storage from '@/lib/storage';
import * as rateLimit from '@/lib/rate-limit';
import * as webhookRetry from '@/lib/webhook-retry';
import * as idempotency from '@/lib/idempotency';

// Mock all external dependencies
vi.mock('@/lib/storage');
vi.mock('@/lib/rate-limit');
vi.mock('@/lib/webhook-retry');
vi.mock('@/lib/idempotency');

// Mock Netlify Blobs with inline factory
let mockStores: Map<string, any>;

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
      });
    }
    return mockStores.get(options.name)!;
  }),
}));

describe('Submissions API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear all stores
    if (mockStores) {
      mockStores.clear();
    }

    // Mock rate limiting to always allow
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60000,
    });

    vi.mocked(rateLimit.getRateLimitHeaders).mockReturnValue(new Headers());

    // Mock webhook retry
    vi.mocked(webhookRetry.fireWebhookWithRetry).mockResolvedValue(undefined);

    // Mock idempotency by default to not have a cached response
    vi.mocked(idempotency.getIdempotencyKeyFromRequest).mockReturnValue(null);
    vi.mocked(idempotency.checkIdempotencyKey).mockResolvedValue({
      exists: false,
      key: '',
    });
    vi.mocked(idempotency.storeIdempotencyKey).mockResolvedValue(undefined);
  });

  describe('POST /api/submit', () => {
    const validPayload = {
      formId: 'vf_test_12345',
      submissionId: 'vf-12345678-1234-1234-1234-123456789012',
      payload: {
        encrypted: 'encrypted-data-here',
        encryptedKey: 'encrypted-key-here',
        iv: 'initialization-vector',
        version: '1.0',
      },
      timestamp: Date.now(),
      meta: {
        sdkVersion: '1.0.0',
        formVersion: '1',
      },
      spamProtection: {
        honeypot: '',
      },
    };

    it('should accept valid encrypted submission', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        subscription: 'free',
      });
      const form = createTestForm({
        userId: testUser.id,
        submissionCount: 0,
      });
      // Override the form ID to match the payload
      form.id = validPayload.formId;

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.getUserById).mockResolvedValue(testUser);
      vi.mocked(storage.updateForm).mockResolvedValue({
        ...form,
        submissionCount: 1,
      });

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
        headers: {
          origin: 'https://example.com',
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        submissionId: validPayload.submissionId,
        timestamp: expect.any(Number),
      });

      // Verify storage was called
      const store = mockStores?.get(`veilforms-${validPayload.formId}`);
      expect(store?.setJSON).toHaveBeenCalledWith(
        validPayload.submissionId,
        expect.objectContaining({
          id: validPayload.submissionId,
          formId: validPayload.formId,
        })
      );

      // Verify form submission count was updated
      expect(storage.updateForm).toHaveBeenCalledWith(
        validPayload.formId,
        expect.objectContaining({
          submissionCount: 1,
        })
      );
    });

    it('should reject submission to non-existent form', async () => {
      vi.mocked(storage.getForm).mockResolvedValue(null);

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.error).toContain('Form not found');
    });

    it('should reject submission to deleted form', async () => {
      const form = createTestForm();
      (form as { status?: string }).status = 'deleted';

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.error).toContain('not accepting submissions');
    });

    it('should reject submission to paused form', async () => {
      const form = createTestForm();
      (form as { status?: string }).status = 'paused';

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.error).toContain('not accepting submissions');
    });

    it('should reject submission with missing required fields', async () => {
      const req = createMockRequest('POST', '/api/submit', {
        body: {
          formId: 'vf_test_12345',
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.details?.required).toContain('submissionId');
      expect(data.details?.required).toContain('payload');
    });

    it('should reject submission with invalid encrypted payload', async () => {
      const form = createTestForm();
      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.getUserById).mockResolvedValue(
        createTestUser({ subscription: 'free' })
      );

      const req = createMockRequest('POST', '/api/submit', {
        body: {
          ...validPayload,
          payload: {
            encrypted: 'data',
            // Missing required fields
          },
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid encrypted payload');
    });

    it('should reject submission when honeypot is triggered', async () => {
      const form = createTestForm();
      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createMockRequest('POST', '/api/submit', {
        body: {
          ...validPayload,
          spamProtection: {
            honeypot: 'bot-filled-this',
          },
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.error).toBe('Spam detected');
    });

    it('should reject submission when reCAPTCHA fails', async () => {
      const form = createTestForm({
        settings: {
          encryption: true,
          piiStrip: false,
          webhookUrl: null,
          allowedOrigins: ['*'],
          spamProtection: {
            honeypot: false,
            recaptcha: {
              enabled: true,
              siteKey: 'test-site-key',
              secretKey: 'test-secret-key',
              threshold: 0.5,
            },
          },
        },
      });

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.getUserById).mockResolvedValue(
        createTestUser({ subscription: 'free' })
      );

      // Mock failed reCAPTCHA verification
      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: false,
            'error-codes': ['invalid-input-response'],
          }),
      } as Response);

      const req = createMockRequest('POST', '/api/submit', {
        body: {
          ...validPayload,
          spamProtection: {
            honeypot: '',
            recaptchaToken: 'invalid-token',
          },
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.error).toContain('Spam protection verification failed');
    });

    it('should enforce submission limits based on subscription', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        subscription: 'free',
      });
      const form = createTestForm({
        userId: testUser.id,
        submissionCount: 100, // Free tier limit
      });

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.getUserById).mockResolvedValue(testUser);

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(429);
      expect(data.error).toContain('Submission limit reached');
      expect(data.details).toMatchObject({
        limit: 100,
        current: 100,
        subscription: 'free',
      });
    });

    it('should respect rate limiting', async () => {
      vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
        allowed: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      });

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
      expect(data.retryAfter).toBe(60);
    });

    it('should reject payload exceeding size limit', async () => {
      const largePayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          encrypted: 'x'.repeat(2 * 1024 * 1024), // 2MB
        },
      };

      const req = createMockRequest('POST', '/api/submit', {
        body: largePayload,
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(413);
      expect(data.error).toContain('Payload too large');
    });

    it('should enforce allowed origins', async () => {
      const form = createTestForm({
        settings: {
          encryption: true,
          piiStrip: false,
          webhookUrl: null,
          allowedOrigins: ['https://allowed.com'],
          spamProtection: {
            honeypot: true,
            recaptcha: {
              enabled: false,
              siteKey: '',
              secretKey: '',
              threshold: 0.5,
            },
          },
        },
      });

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
        headers: {
          origin: 'https://not-allowed.com',
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.error).toBe('Origin not allowed');
    });

    it('should fire webhook if configured', async () => {
      const testUser = createTestUser({ subscription: 'free' });
      const form = createTestForm({
        userId: testUser.id,
        settings: {
          ...createTestForm().settings,
          webhookUrl: 'https://webhook.example.com/receive',
        },
      });
      // Override the form ID to match the payload
      form.id = validPayload.formId;

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.getUserById).mockResolvedValue(testUser);
      vi.mocked(storage.updateForm).mockResolvedValue({
        ...form,
        submissionCount: 1,
      });

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
      });

      await submitPOST(req);

      expect(webhookRetry.fireWebhookWithRetry).toHaveBeenCalledWith(
        'https://webhook.example.com/receive',
        expect.objectContaining({
          id: validPayload.submissionId,
          formId: validPayload.formId,
        }),
        undefined
      );
    });

    it('should handle idempotency key correctly', async () => {
      const testUser = createTestUser({ subscription: 'free' });
      const form = createTestForm({ userId: testUser.id });
      // Override the form ID to match the payload
      form.id = validPayload.formId;

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.getUserById).mockResolvedValue(testUser);
      vi.mocked(storage.updateForm).mockResolvedValue({
        ...form,
        submissionCount: 1,
      });

      const idempotencyKey = 'idem-key-12345';
      vi.mocked(idempotency.getIdempotencyKeyFromRequest).mockReturnValue(
        idempotencyKey
      );
      vi.mocked(idempotency.checkIdempotencyKey).mockResolvedValue({
        exists: false,
        key: idempotencyKey,
      });

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
        headers: {
          'idempotency-key': idempotencyKey,
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(idempotency.storeIdempotencyKey).toHaveBeenCalledWith(
        idempotencyKey,
        validPayload.formId,
        expect.objectContaining({
          success: true,
          submissionId: validPayload.submissionId,
        })
      );
    });

    it('should return cached response for duplicate idempotency key', async () => {
      const cachedResponse = {
        success: true,
        submissionId: 'cached-submission',
        timestamp: Date.now(),
      };

      vi.mocked(idempotency.getIdempotencyKeyFromRequest).mockReturnValue(
        'idem-key-12345'
      );
      vi.mocked(idempotency.checkIdempotencyKey).mockResolvedValue({
        exists: true,
        key: 'idem-key-12345',
        response: cachedResponse,
      });

      const req = createMockRequest('POST', '/api/submit', {
        body: validPayload,
        headers: {
          'idempotency-key': 'idem-key-12345',
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toEqual(cachedResponse);

      // Verify no actual storage happened (store won't even be created for cached responses)
      const store = mockStores?.get(`veilforms-${validPayload.formId}`);
      // If store exists, setJSON should not have been called
      if (store) {
        expect(store.setJSON).not.toHaveBeenCalled();
      }
      // Verify form was not updated (since this is a cached response)
      expect(storage.updateForm).not.toHaveBeenCalled();
    });

    it('should validate formId format', async () => {
      const req = createMockRequest('POST', '/api/submit', {
        body: {
          ...validPayload,
          formId: 'invalid-format',
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid');
    });

    it('should validate submissionId format', async () => {
      const form = createTestForm();
      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createMockRequest('POST', '/api/submit', {
        body: {
          ...validPayload,
          submissionId: 'invalid-format',
        },
      });

      const response = await submitPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid');
    });
  });
});
