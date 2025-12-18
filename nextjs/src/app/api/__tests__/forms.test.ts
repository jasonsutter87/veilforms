/**
 * API Integration Tests - Forms Routes
 * Tests for /api/forms/* endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as formsGET, POST as formsPOST } from '../forms/route';
import { GET as formGET, DELETE as formDELETE, PUT as formPUT } from '../forms/[id]/route';
import { GET as statsGET } from '../forms/[id]/stats/route';
import {
  createMockRequest,
  createAuthenticatedRequest,
  createAuthenticatedRequestWithCsrf,
  getResponseJson,
} from '../../../../__tests__/helpers/api.helper';
import { createTestUser } from '../../../../__tests__/factories/user.factory';
import { createTestForm } from '../../../../__tests__/factories/form.factory';
import * as storage from '@/lib/storage';
import * as rateLimit from '@/lib/rate-limit';
import * as audit from '@/lib/audit';
import * as csrf from '@/lib/csrf';

// Mock all external dependencies
vi.mock('@/lib/storage');
vi.mock('@/lib/rate-limit');
vi.mock('@/lib/audit');
vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn(() => true),
}));

// Mock Netlify Blobs
vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    setJSON: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock crypto.subtle for key generation
const mockGenerateKey = vi.fn().mockResolvedValue({
  publicKey: {},
  privateKey: {},
});

const mockExportKey = vi.fn().mockResolvedValue({
  kty: 'RSA',
  n: 'test',
  e: 'AQAB',
});

vi.stubGlobal('crypto', {
  ...global.crypto,
  subtle: {
    generateKey: mockGenerateKey,
    exportKey: mockExportKey,
  },
});

describe('Forms API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock rate limiting to always allow
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    });

    vi.mocked(rateLimit.getRateLimitHeaders).mockReturnValue(new Headers());

    // Mock audit logging
    vi.mocked(audit.logAudit).mockResolvedValue(undefined);
    vi.mocked(audit.getAuditContext).mockReturnValue({
      ip: '127.0.0.1',
      userAgent: 'test',
    });
  });

  describe('GET /api/forms', () => {
    it('should return user forms successfully', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      const form1 = createTestForm({ userId: testUser.id, name: 'Form 1' });
      const form2 = createTestForm({ userId: testUser.id, name: 'Form 2' });

      vi.mocked(storage.getUserForms).mockResolvedValue([form1, form2]);

      const req = createAuthenticatedRequest(
        'GET',
        '/api/forms',
        testUser.id,
        testUser.email
      );

      const response = await formsGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        forms: expect.arrayContaining([
          expect.objectContaining({
            id: form1.id,
            name: form1.name,
          }),
          expect.objectContaining({
            id: form2.id,
            name: form2.name,
          }),
        ]),
        total: 2,
      });
    });

    it('should filter out deleted forms', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      const activeForm = createTestForm({ userId: testUser.id, name: 'Active' });
      const deletedForm = createTestForm({ userId: testUser.id, name: 'Deleted' });
      (deletedForm as { status?: string }).status = 'deleted';

      vi.mocked(storage.getUserForms).mockResolvedValue([activeForm, deletedForm]);

      const req = createAuthenticatedRequest(
        'GET',
        '/api/forms',
        testUser.id,
        testUser.email
      );

      const response = await formsGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.forms).toHaveLength(1);
      expect(data.forms[0].id).toBe(activeForm.id);
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('GET', '/api/forms');

      const response = await formsGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('should respect rate limiting', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
        allowed: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      });

      const req = createAuthenticatedRequest(
        'GET',
        '/api/forms',
        testUser.id,
        testUser.email
      );

      const response = await formsGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });
  });

  describe('POST /api/forms', () => {
    it('should create a new form successfully', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      const newForm = createTestForm({
        userId: testUser.id,
        name: 'My New Form',
      });

      vi.mocked(storage.getUserById).mockResolvedValue(testUser);
      vi.mocked(storage.getUserForms).mockResolvedValue([]);
      vi.mocked(storage.createForm).mockResolvedValue(newForm);

      const req = createAuthenticatedRequestWithCsrf(
        'POST',
        '/api/forms',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'My New Form',
            settings: {
              piiStrip: true,
              allowedOrigins: ['https://example.com'],
            },
          },
        }
      );

      const response = await formsPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        form: {
          id: newForm.id,
          name: newForm.name,
          publicKey: expect.any(String),
          privateKey: expect.any(String),
        },
        warning: expect.stringContaining('private key'),
      });
      expect(storage.createForm).toHaveBeenCalled();
      expect(audit.logAudit).toHaveBeenCalledWith(
        testUser.id,
        audit.AuditEvents.FORM_CREATED,
        expect.objectContaining({ formId: newForm.id }),
        expect.any(Object)
      );
    });

    it('should enforce form creation limits for free tier', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        subscription: 'free',
      });

      // Create 5 existing forms (free tier limit)
      const existingForms = Array.from({ length: 5 }, (_, i) =>
        createTestForm({ userId: testUser.id, name: `Form ${i}` })
      );

      vi.mocked(storage.getUserById).mockResolvedValue(testUser);
      vi.mocked(storage.getUserForms).mockResolvedValue(existingForms);

      const req = createAuthenticatedRequestWithCsrf(
        'POST',
        '/api/forms',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'One Too Many',
          },
        }
      );

      const response = await formsPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(402);
      expect(data).toMatchObject({
        error: 'Form creation limit reached',
        limit: 5,
        current: 5,
        subscription: 'free',
      });
      expect(storage.createForm).not.toHaveBeenCalled();
    });

    it('should allow unlimited forms for enterprise tier', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        subscription: 'enterprise',
      });

      const existingForms = Array.from({ length: 100 }, (_, i) =>
        createTestForm({ userId: testUser.id, name: `Form ${i}` })
      );

      const newForm = createTestForm({ userId: testUser.id, name: 'Form 101' });

      vi.mocked(storage.getUserById).mockResolvedValue(testUser);
      vi.mocked(storage.getUserForms).mockResolvedValue(existingForms);
      vi.mocked(storage.createForm).mockResolvedValue(newForm);

      const req = createAuthenticatedRequestWithCsrf(
        'POST',
        '/api/forms',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Form 101',
          },
        }
      );

      const response = await formsPOST(req);

      expect(response.status).toBe(201);
      expect(storage.createForm).toHaveBeenCalled();
    });

    it('should reject invalid form names', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      const req = createAuthenticatedRequestWithCsrf(
        'POST',
        '/api/forms',
        testUser.id,
        testUser.email,
        {
          body: {
            name: '',
          },
        }
      );

      const response = await formsPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject requests without CSRF token', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      // Mock CSRF validation to fail
      vi.mocked(csrf.validateCsrfToken).mockReturnValueOnce(false);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/forms',
        testUser.id,
        testUser.email,
        {
          body: {
            name: 'Test Form',
          },
        }
      );

      const response = await formsPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.error).toContain('CSRF');
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('POST', '/api/forms', {
        body: {
          name: 'Test Form',
        },
      });

      const response = await formsPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/forms/[id]', () => {
    it('should return form details for owner', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      const form = createTestForm({ userId: testUser.id });

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createAuthenticatedRequest(
        'GET',
        `/api/forms/${form.id}`,
        testUser.id,
        testUser.email
      );

      const response = await formGET(req, { params: { id: form.id } });
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.form).toMatchObject({
        id: form.id,
        name: form.name,
        publicKey: expect.any(String),
        settings: expect.any(Object),
        status: expect.any(String),
        submissionCount: expect.any(Number),
      });
    });

    it('should reject access for non-owner', async () => {
      const owner = createTestUser({ email: 'owner@example.com' });
      const otherUser = createTestUser({ email: 'other@example.com' });
      const form = createTestForm({ userId: owner.id });

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createAuthenticatedRequest(
        'GET',
        `/api/forms/${form.id}`,
        otherUser.id,
        otherUser.email
      );

      const response = await formGET(req, { params: { id: form.id } });
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.error).toContain('Access denied');
    });

    it('should return 404 for non-existent form', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      vi.mocked(storage.getForm).mockResolvedValue(null);

      const validFormId = 'vf_nonexistent_form';
      const req = createAuthenticatedRequest(
        'GET',
        `/api/forms/${validFormId}`,
        testUser.id,
        testUser.email
      );

      const response = await formGET(req, { params: { id: validFormId } });
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/forms/[id]', () => {
    it('should update form settings successfully', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      const form = createTestForm({ userId: testUser.id });
      const updatedForm = {
        ...form,
        settings: {
          ...form.settings,
          piiStrip: true,
        },
      };

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.updateForm).mockResolvedValue(updatedForm);

      const req = createAuthenticatedRequestWithCsrf(
        'PUT',
        `/api/forms/${form.id}`,
        testUser.id,
        testUser.email,
        {
          body: {
            settings: {
              piiStrip: true,
            },
          },
        }
      );

      const response = await formPUT(req, { params: { id: form.id } });
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.form.settings.piiStrip).toBe(true);
      expect(storage.updateForm).toHaveBeenCalledWith(
        form.id,
        expect.objectContaining({
          settings: expect.objectContaining({
            piiStrip: true,
          }),
        })
      );
    });

    it('should reject updates from non-owner', async () => {
      const owner = createTestUser({ email: 'owner@example.com' });
      const otherUser = createTestUser({ email: 'other@example.com' });
      const form = createTestForm({ userId: owner.id });

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createAuthenticatedRequestWithCsrf(
        'PUT',
        `/api/forms/${form.id}`,
        otherUser.id,
        otherUser.email,
        {
          body: {
            settings: { piiStrip: true },
          },
        }
      );

      const response = await formPUT(req, { params: { id: form.id } });
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(storage.updateForm).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/forms/[id]', () => {
    it('should delete form successfully', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      const form = createTestForm({ userId: testUser.id });

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.updateForm).mockResolvedValue({
        ...form,
        status: 'deleted',
      });

      const req = createAuthenticatedRequestWithCsrf(
        'DELETE',
        `/api/forms/${form.id}`,
        testUser.id,
        testUser.email
      );

      const response = await formDELETE(req, { params: { id: form.id } });
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(storage.updateForm).toHaveBeenCalledWith(
        form.id,
        expect.objectContaining({
          status: 'deleted',
        })
      );
    });

    it('should reject deletion from non-owner', async () => {
      const owner = createTestUser({ email: 'owner@example.com' });
      const otherUser = createTestUser({ email: 'other@example.com' });
      const form = createTestForm({ userId: owner.id });

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createAuthenticatedRequestWithCsrf(
        'DELETE',
        `/api/forms/${form.id}`,
        otherUser.id,
        otherUser.email
      );

      const response = await formDELETE(req, { params: { id: form.id } });

      expect(response.status).toBe(403);
      expect(storage.updateForm).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/forms/[id]/stats', () => {
    it('should return form statistics', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      const form = createTestForm({
        userId: testUser.id,
        submissionCount: 42,
      });

      vi.mocked(storage.getForm).mockResolvedValue(form);
      vi.mocked(storage.getSubmissions).mockResolvedValue({
        submissions: [],
        total: 0,
        hasMore: false,
      });

      const req = createAuthenticatedRequest(
        'GET',
        `/api/forms/${form.id}/stats`,
        testUser.id,
        testUser.email
      );

      const response = await statsGET(req, { params: { id: form.id } });
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        formId: form.id,
        stats: expect.objectContaining({
          total: 42,
        }),
      });
    });

    it('should reject stats access from non-owner', async () => {
      const owner = createTestUser({ email: 'owner@example.com' });
      const otherUser = createTestUser({ email: 'other@example.com' });
      const form = createTestForm({ userId: owner.id });

      vi.mocked(storage.getForm).mockResolvedValue(form);

      const req = createAuthenticatedRequest(
        'GET',
        `/api/forms/${form.id}/stats`,
        otherUser.id,
        otherUser.email
      );

      const response = await statsGET(req, { params: { id: form.id } });

      expect(response.status).toBe(403);
    });
  });
});
