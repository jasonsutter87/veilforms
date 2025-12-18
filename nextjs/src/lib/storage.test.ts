/**
 * VeilForms - Storage Library Tests
 * Tests for Netlify Blobs CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUser,
  getUser,
  getUserById,
  updateUser,
  createOAuthUser,
  createForm,
  getForm,
  updateForm,
  deleteForm,
  getUserForms,
  createApiKey,
  getApiKeyData,
  updateApiKeyLastUsed,
  revokeApiKey,
  getSubmissions,
  getSubmission,
  deleteSubmission,
  deleteAllSubmissions,
  createPasswordResetToken,
  getPasswordResetToken,
  deletePasswordResetToken,
  createEmailVerificationToken,
  getEmailVerificationToken,
  getEmailVerificationTokenByEmail,
  deleteEmailVerificationToken,
  type User,
  type Form,
  type Submission,
  type ApiKeyData,
  type TokenData,
} from './storage';
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
    list: vi.fn(async () => ({
      blobs: Array.from(storeData.keys()).map((key) => ({ key })),
    })),
  };
};

// Mock Netlify Blobs
vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(({ name }: { name: string }) => createMockStore(name)),
}));

function clearMockStorage() {
  mockStorage.clear();
}

// Helper to get mock store (mimics the actual getStore call)
function getMockStore(name: string) {
  return createMockStore(name);
}

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockStorage();
  });

  describe('User Operations', () => {
    describe('createUser', () => {
      it('should create a new user', async () => {
        const email = `${TEST_PREFIX}user@example.com`;
        const passwordHash = 'hashed-password';

        const user = await createUser(email, passwordHash);

        expect(user.id).toMatch(/^user_/);
        expect(user.email).toBe(email.toLowerCase());
        expect(user.passwordHash).toBe(passwordHash);
        expect(user.subscription).toBe('free');
        expect(user.forms).toEqual([]);
        expect(user.emailVerified).toBe(false);
        expect(user.emailVerifiedAt).toBeNull();
        expect(user.createdAt).toBeDefined();
      });

      it('should normalize email to lowercase', async () => {
        const user = await createUser('Test@Example.COM', 'hash');
        expect(user.email).toBe('test@example.com');
      });

      it('should create ID mapping for user lookup', async () => {
        const user = await createUser(`${TEST_PREFIX}lookup@example.com`, 'hash');
        const foundUser = await getUserById(user.id);

        expect(foundUser).not.toBeNull();
        expect(foundUser?.email).toBe(user.email);
      });
    });

    describe('getUser', () => {
      it('should retrieve existing user', async () => {
        const email = `${TEST_PREFIX}get@example.com`;
        const created = await createUser(email, 'hash');
        const retrieved = await getUser(email);

        expect(retrieved).toEqual(created);
      });

      it('should return null for non-existent user', async () => {
        const user = await getUser('nonexistent@example.com');
        expect(user).toBeNull();
      });

      it('should handle email case-insensitivity', async () => {
        await createUser('test@example.com', 'hash');
        const user = await getUser('Test@Example.COM');

        expect(user).not.toBeNull();
        expect(user?.email).toBe('test@example.com');
      });
    });

    describe('getUserById', () => {
      it('should retrieve user by ID', async () => {
        const email = `${TEST_PREFIX}byid@example.com`;
        const created = await createUser(email, 'hash');
        const retrieved = await getUserById(created.id);

        expect(retrieved).toEqual(created);
      });

      it('should return null for invalid ID', async () => {
        const user = await getUserById('invalid_user_id');
        expect(user).toBeNull();
      });

      it('should return null when mapping exists but user does not', async () => {
        const store = getMockStore('vf-users');

        // Create mapping without user
        await store.setJSON('id_test_user_123', { email: 'ghost@example.com' });

        const user = await getUserById('test_user_123');
        expect(user).toBeNull();
      });
    });

    describe('updateUser', () => {
      it('should update user fields', async () => {
        const email = `${TEST_PREFIX}update@example.com`;
        await createUser(email, 'hash');

        const updated = await updateUser(email, {
          subscription: 'pro',
          emailVerified: true,
        });

        expect(updated).not.toBeNull();
        expect(updated?.subscription).toBe('pro');
        expect(updated?.emailVerified).toBe(true);
        expect(updated?.updatedAt).toBeDefined();
      });

      it('should return null for non-existent user', async () => {
        const result = await updateUser('nonexistent@example.com', { subscription: 'pro' });
        expect(result).toBeNull();
      });

      it('should preserve unmodified fields', async () => {
        const email = `${TEST_PREFIX}preserve@example.com`;
        const original = await createUser(email, 'original-hash');

        const updated = await updateUser(email, { subscription: 'pro' });

        expect(updated?.passwordHash).toBe(original.passwordHash);
        expect(updated?.email).toBe(original.email);
      });
    });

    describe('createOAuthUser', () => {
      it('should create OAuth user with provider details', async () => {
        const email = `${TEST_PREFIX}oauth@example.com`;
        const user = await createOAuthUser(email, 'google', 'google-id-123', 'John Doe');

        expect(user.email).toBe(email.toLowerCase());
        expect(user.passwordHash).toBeNull();
        expect(user.oauthProvider).toBe('google');
        expect(user.oauthProviderId).toBe('google-id-123');
        expect(user.name).toBe('John Doe');
        expect(user.emailVerified).toBe(true);
        expect(user.emailVerifiedAt).toBeDefined();
      });

      it('should create OAuth user without name', async () => {
        const user = await createOAuthUser(`${TEST_PREFIX}oauth2@example.com`, 'github', 'gh-123');

        expect(user.name).toBeNull();
        expect(user.oauthProvider).toBe('github');
      });
    });
  });

  describe('Form Operations', () => {
    const testUserId = `${TEST_PREFIX}user_123`;

    describe('createForm', () => {
      it('should create a new form', async () => {
        const form = await createForm(testUserId, {
          name: 'Contact Form',
          publicKey: 'test-key',
        });

        expect(form.id).toMatch(/^vf_/);
        expect(form.userId).toBe(testUserId);
        expect(form.name).toBe('Contact Form');
        expect(form.publicKey).toBe('test-key');
        expect(form.submissionCount).toBe(0);
        expect(form.settings.encryption).toBe(true);
        expect(form.createdAt).toBeDefined();
      });

      it('should create form with custom settings', async () => {
        const form = await createForm(testUserId, {
          name: 'Test Form',
          publicKey: 'key',
          settings: {
            piiStrip: true,
            webhookUrl: 'https://example.com/webhook',
            allowedOrigins: ['https://example.com'],
            spamProtection: {
              honeypot: false,
              recaptcha: {
                enabled: true,
                siteKey: 'site-key',
                secretKey: 'secret-key',
                threshold: 0.7,
              },
            },
          },
        });

        expect(form.settings.piiStrip).toBe(true);
        expect(form.settings.webhookUrl).toBe('https://example.com/webhook');
        expect(form.settings.allowedOrigins).toEqual(['https://example.com']);
        expect(form.settings.spamProtection.honeypot).toBe(false);
        expect(form.settings.spamProtection.recaptcha.enabled).toBe(true);
      });

      it('should add form to user forms list', async () => {
        const form = await createForm(testUserId, {
          name: 'Form 1',
          publicKey: 'key',
        });

        const userForms = await getUserForms(testUserId);
        expect(userForms).toHaveLength(1);
        expect(userForms[0].id).toBe(form.id);
      });

      it('should use default settings when not provided', async () => {
        const form = await createForm(testUserId, {
          name: 'Default Form',
          publicKey: 'key',
        });

        expect(form.settings.encryption).toBe(true);
        expect(form.settings.piiStrip).toBe(false);
        expect(form.settings.webhookUrl).toBeNull();
        expect(form.settings.allowedOrigins).toEqual(['*']);
        expect(form.settings.spamProtection.honeypot).toBe(true);
        expect(form.settings.spamProtection.recaptcha.enabled).toBe(false);
      });
    });

    describe('getForm', () => {
      it('should retrieve existing form', async () => {
        const created = await createForm(testUserId, {
          name: 'Test Form',
          publicKey: 'key',
        });

        const retrieved = await getForm(created.id);
        expect(retrieved).toEqual(created);
      });

      it('should return null for non-existent form', async () => {
        const form = await getForm('vf_nonexistent');
        expect(form).toBeNull();
      });
    });

    describe('updateForm', () => {
      it('should update form fields', async () => {
        const form = await createForm(testUserId, {
          name: 'Original Name',
          publicKey: 'key',
        });

        const updated = await updateForm(form.id, {
          name: 'Updated Name',
          submissionCount: 5,
        });

        expect(updated).not.toBeNull();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.submissionCount).toBe(5);
        expect(updated?.updatedAt).toBeDefined();
      });

      it('should merge settings when updating', async () => {
        const form = await createForm(testUserId, {
          name: 'Form',
          publicKey: 'key',
          settings: { webhookUrl: 'https://original.com' },
        });

        const updated = await updateForm(form.id, {
          settings: { piiStrip: true },
        });

        expect(updated?.settings.webhookUrl).toBe('https://original.com');
        expect(updated?.settings.piiStrip).toBe(true);
      });

      it('should return null for non-existent form', async () => {
        const result = await updateForm('vf_nonexistent', { name: 'New Name' });
        expect(result).toBeNull();
      });
    });

    describe('deleteForm', () => {
      it('should delete form and remove from user list', async () => {
        const form = await createForm(testUserId, {
          name: 'To Delete',
          publicKey: 'key',
        });

        const deleted = await deleteForm(form.id, testUserId);
        expect(deleted).toBe(true);

        const retrieved = await getForm(form.id);
        expect(retrieved).toBeNull();

        const userForms = await getUserForms(testUserId);
        expect(userForms).toHaveLength(0);
      });

      it('should handle deleting non-existent form', async () => {
        await expect(deleteForm('vf_nonexistent', testUserId)).resolves.toBe(true);
      });
    });

    describe('getUserForms', () => {
      it('should return all forms for a user', async () => {
        await createForm(testUserId, { name: 'Form 1', publicKey: 'key1' });
        await createForm(testUserId, { name: 'Form 2', publicKey: 'key2' });
        await createForm(testUserId, { name: 'Form 3', publicKey: 'key3' });

        const forms = await getUserForms(testUserId);
        expect(forms).toHaveLength(3);
      });

      it('should return empty array for user with no forms', async () => {
        const forms = await getUserForms('user_no_forms');
        expect(forms).toEqual([]);
      });

      it('should filter out deleted forms', async () => {
        const form1 = await createForm(testUserId, { name: 'Form 1', publicKey: 'key1' });
        const form2 = await createForm(testUserId, { name: 'Form 2', publicKey: 'key2' });

        await deleteForm(form1.id, testUserId);

        const forms = await getUserForms(testUserId);
        expect(forms).toHaveLength(1);
        expect(forms[0].id).toBe(form2.id);
      });
    });
  });

  describe('API Key Operations', () => {
    const testUserId = `${TEST_PREFIX}user_api`;

    describe('createApiKey', () => {
      it('should create API key with default permissions', async () => {
        const keyHash = 'hash_123';
        const apiKey = await createApiKey(testUserId, keyHash);

        expect(apiKey.userId).toBe(testUserId);
        expect(apiKey.keyHash).toBe(keyHash);
        expect(apiKey.permissions).toEqual([
          'forms:read',
          'forms:write',
          'submissions:read',
          'submissions:delete',
        ]);
        expect(apiKey.lastUsed).toBeNull();
        expect(apiKey.createdAt).toBeDefined();
      });

      it('should create API key with custom permissions', async () => {
        const keyHash = 'hash_custom';
        const permissions = ['forms:read', 'submissions:read'];
        const apiKey = await createApiKey(testUserId, keyHash, permissions);

        expect(apiKey.permissions).toEqual(permissions);
      });

      it('should add key to user key list', async () => {
        const keyHash = 'hash_list';
        await createApiKey(testUserId, keyHash);

        const store = getMockStore('vf-api-keys');
        const userKeys = (await store.get(`user_keys_${testUserId}`, {
          type: 'json',
        })) as string[];

        expect(userKeys).toContain(keyHash);
      });
    });

    describe('getApiKeyData', () => {
      it('should retrieve API key data', async () => {
        const keyHash = 'hash_get';
        const created = await createApiKey(testUserId, keyHash);
        const retrieved = await getApiKeyData(keyHash);

        expect(retrieved).toEqual(created);
      });

      it('should return null for non-existent key', async () => {
        const data = await getApiKeyData('nonexistent_hash');
        expect(data).toBeNull();
      });
    });

    describe('updateApiKeyLastUsed', () => {
      it('should update last used timestamp', async () => {
        const keyHash = 'hash_update';
        await createApiKey(testUserId, keyHash);

        const updated = await updateApiKeyLastUsed(keyHash);

        expect(updated).not.toBeNull();
        expect(updated?.lastUsed).toBeDefined();
        expect(new Date(updated!.lastUsed!).getTime()).toBeCloseTo(Date.now(), -3);
      });

      it('should return null for non-existent key', async () => {
        const result = await updateApiKeyLastUsed('nonexistent_hash');
        expect(result).toBeNull();
      });
    });

    describe('revokeApiKey', () => {
      it('should revoke API key and remove from user list', async () => {
        const keyHash = 'hash_revoke';
        await createApiKey(testUserId, keyHash);

        const revoked = await revokeApiKey(keyHash, testUserId);
        expect(revoked).toBe(true);

        const data = await getApiKeyData(keyHash);
        expect(data).toBeNull();
      });

      it('should handle revoking non-existent key', async () => {
        await expect(revokeApiKey('nonexistent_hash', testUserId)).resolves.toBe(true);
      });
    });
  });

  describe('Submission Operations', () => {
    const testFormId = `${TEST_PREFIX}vf_form_123`;

    describe('getSubmissions', () => {
      it('should return empty result when no submissions exist', async () => {
        const result = await getSubmissions(testFormId);

        expect(result.submissions).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.limit).toBe(50);
        expect(result.offset).toBe(0);
      });

      it('should return submissions with pagination', async () => {
        const store = getMockStore(`veilforms-${testFormId}`);

        // Create mock submissions
        const submissions = Array.from({ length: 10 }, (_, i) => ({
          id: `sub_${i}`,
          formId: testFormId,
          encryptedData: 'encrypted',
          metadata: {},
          createdAt: new Date().toISOString(),
        }));

        // Set up index
        await store.setJSON('_index', {
          submissions: submissions.map((s) => ({ id: s.id, createdAt: s.createdAt })),
        });

        // Set up individual submissions
        for (const sub of submissions) {
          await store.setJSON(sub.id, sub);
        }

        const result = await getSubmissions(testFormId, 5, 0);

        expect(result.submissions).toHaveLength(5);
        expect(result.total).toBe(10);
        expect(result.limit).toBe(5);
      });

      it('should handle offset correctly', async () => {
        const store = getMockStore(`veilforms-${testFormId}`);

        const submissions = Array.from({ length: 10 }, (_, i) => ({
          id: `sub_${i}`,
          formId: testFormId,
          encryptedData: 'encrypted',
          metadata: {},
          createdAt: new Date().toISOString(),
        }));

        await store.setJSON('_index', {
          submissions: submissions.map((s) => ({ id: s.id, createdAt: s.createdAt })),
        });

        for (const sub of submissions) {
          await store.setJSON(sub.id, sub);
        }

        const result = await getSubmissions(testFormId, 5, 5);

        expect(result.submissions).toHaveLength(5);
        expect(result.offset).toBe(5);
      });
    });

    describe('getSubmission', () => {
      it('should retrieve individual submission', async () => {
        const store = getMockStore(`veilforms-${testFormId}`);

        const submission = {
          id: 'sub_123',
          formId: testFormId,
          encryptedData: 'encrypted-data',
          metadata: { test: true },
          createdAt: new Date().toISOString(),
        };

        await store.setJSON(submission.id, submission);

        const retrieved = await getSubmission(testFormId, submission.id);
        expect(retrieved).toEqual(submission);
      });

      it('should return null for non-existent submission', async () => {
        const submission = await getSubmission(testFormId, 'nonexistent');
        expect(submission).toBeNull();
      });
    });

    describe('deleteSubmission', () => {
      it('should delete submission and update index', async () => {
        const store = getMockStore(`veilforms-${testFormId}`);

        const submissions = [
          { id: 'sub_1', createdAt: new Date().toISOString() },
          { id: 'sub_2', createdAt: new Date().toISOString() },
        ];

        await store.setJSON('_index', { submissions });
        await store.setJSON('sub_1', {
          id: 'sub_1',
          formId: testFormId,
          encryptedData: 'data',
          metadata: {},
          createdAt: submissions[0].createdAt,
        });

        const deleted = await deleteSubmission(testFormId, 'sub_1');
        expect(deleted).toBe(true);

        const submission = await getSubmission(testFormId, 'sub_1');
        expect(submission).toBeNull();

        const index = (await store.get('_index', { type: 'json' })) as {
          submissions: Array<{ id: string }>;
        };
        expect(index.submissions).toHaveLength(1);
        expect(index.submissions[0].id).toBe('sub_2');
      });
    });

    describe('deleteAllSubmissions', () => {
      it('should delete all submissions for a form', async () => {
        const store = getMockStore(`veilforms-${testFormId}`);

        const submissions = Array.from({ length: 5 }, (_, i) => ({
          id: `sub_${i}`,
          createdAt: new Date().toISOString(),
        }));

        await store.setJSON('_index', { submissions });

        const count = await deleteAllSubmissions(testFormId);

        expect(count).toBe(5);

        const index = (await store.get('_index', { type: 'json' })) as {
          submissions: unknown[];
        };
        expect(index.submissions).toHaveLength(0);
      });

      it('should return 0 when no submissions exist', async () => {
        const count = await deleteAllSubmissions('vf_empty');
        expect(count).toBe(0);
      });
    });
  });

  describe('Password Reset Token Operations', () => {
    describe('createPasswordResetToken', () => {
      it('should create password reset token', async () => {
        const email = `${TEST_PREFIX}reset@example.com`;
        const token = 'reset-token-123';

        const tokenData = await createPasswordResetToken(email, token);

        expect(tokenData.email).toBe(email.toLowerCase());
        expect(tokenData.createdAt).toBeDefined();
        expect(tokenData.expiresAt).toBeDefined();

        // Token should expire in 1 hour
        const expiresAt = new Date(tokenData.expiresAt);
        const createdAt = new Date(tokenData.createdAt);
        const diffMs = expiresAt.getTime() - createdAt.getTime();
        expect(diffMs).toBeCloseTo(60 * 60 * 1000, -2);
      });
    });

    describe('getPasswordResetToken', () => {
      it('should retrieve valid token', async () => {
        const email = `${TEST_PREFIX}get-reset@example.com`;
        const token = 'get-reset-token';

        await createPasswordResetToken(email, token);
        const retrieved = await getPasswordResetToken(token);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.email).toBe(email.toLowerCase());
      });

      it('should return null for expired token', async () => {
        const email = `${TEST_PREFIX}expired-reset@example.com`;
        const token = 'expired-reset-token';

        const store = getMockStore('vf-password-reset-tokens');

        // Create expired token
        await store.setJSON(token, {
          email,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        });

        const retrieved = await getPasswordResetToken(token);
        expect(retrieved).toBeNull();
      });

      it('should return null for non-existent token', async () => {
        const token = await getPasswordResetToken('nonexistent');
        expect(token).toBeNull();
      });
    });

    describe('deletePasswordResetToken', () => {
      it('should delete token', async () => {
        const email = `${TEST_PREFIX}delete-reset@example.com`;
        const token = 'delete-reset-token';

        await createPasswordResetToken(email, token);
        const deleted = await deletePasswordResetToken(token);

        expect(deleted).toBe(true);

        const retrieved = await getPasswordResetToken(token);
        expect(retrieved).toBeNull();
      });
    });
  });

  describe('Email Verification Token Operations', () => {
    describe('createEmailVerificationToken', () => {
      it('should create email verification token', async () => {
        const email = `${TEST_PREFIX}verify@example.com`;
        const token = 'verify-token-123';

        const tokenData = await createEmailVerificationToken(email, token);

        expect(tokenData.email).toBe(email.toLowerCase());
        expect(tokenData.createdAt).toBeDefined();
        expect(tokenData.expiresAt).toBeDefined();

        // Token should expire in 24 hours
        const expiresAt = new Date(tokenData.expiresAt);
        const createdAt = new Date(tokenData.createdAt);
        const diffMs = expiresAt.getTime() - createdAt.getTime();
        expect(diffMs).toBeCloseTo(24 * 60 * 60 * 1000, -2);
      });

      it('should create email lookup mapping', async () => {
        const email = `${TEST_PREFIX}verify-lookup@example.com`;
        const token = 'verify-lookup-token';

        await createEmailVerificationToken(email, token);
        const byEmail = await getEmailVerificationTokenByEmail(email);

        expect(byEmail).not.toBeNull();
        expect(byEmail?.token).toBe(token);
      });
    });

    describe('getEmailVerificationToken', () => {
      it('should retrieve valid token', async () => {
        const email = `${TEST_PREFIX}get-verify@example.com`;
        const token = 'get-verify-token';

        await createEmailVerificationToken(email, token);
        const retrieved = await getEmailVerificationToken(token);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.email).toBe(email.toLowerCase());
      });

      it('should return null for expired token', async () => {
        const email = `${TEST_PREFIX}expired-verify@example.com`;
        const token = 'expired-verify-token';

        const store = getMockStore('vf-email-verification-tokens');

        await store.setJSON(token, {
          email,
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        });

        const retrieved = await getEmailVerificationToken(token);
        expect(retrieved).toBeNull();
      });
    });

    describe('getEmailVerificationTokenByEmail', () => {
      it('should retrieve token by email', async () => {
        const email = `${TEST_PREFIX}by-email@example.com`;
        const token = 'by-email-token';

        await createEmailVerificationToken(email, token);
        const retrieved = await getEmailVerificationTokenByEmail(email);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.token).toBe(token);
        expect(retrieved?.email).toBe(email.toLowerCase());
      });

      it('should return null for expired token', async () => {
        const email = `${TEST_PREFIX}expired-email@example.com`;
        const token = 'expired-email-token';

        const store = getMockStore('vf-email-verification-tokens');

        await store.setJSON(`email_${email.toLowerCase()}`, {
          token,
          email,
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        });

        const retrieved = await getEmailVerificationTokenByEmail(email);
        expect(retrieved).toBeNull();
      });

      it('should return null for non-existent email', async () => {
        const token = await getEmailVerificationTokenByEmail('nonexistent@example.com');
        expect(token).toBeNull();
      });
    });

    describe('deleteEmailVerificationToken', () => {
      it('should delete token and email mapping', async () => {
        const email = `${TEST_PREFIX}delete-verify@example.com`;
        const token = 'delete-verify-token';

        await createEmailVerificationToken(email, token);
        const deleted = await deleteEmailVerificationToken(token);

        expect(deleted).toBe(true);

        const byToken = await getEmailVerificationToken(token);
        expect(byToken).toBeNull();

        const byEmail = await getEmailVerificationTokenByEmail(email);
        expect(byEmail).toBeNull();
      });

      it('should handle deleting token without email mapping', async () => {
        const store = getMockStore('vf-email-verification-tokens');

        await store.setJSON('orphan-token', {
          email: 'orphan@example.com',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000).toISOString(),
        });

        await expect(deleteEmailVerificationToken('orphan-token')).resolves.toBe(true);
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle concurrent user creation', async () => {
      const email = `${TEST_PREFIX}concurrent@example.com`;

      const [user1, user2] = await Promise.all([
        createUser(email, 'hash1'),
        createUser(email, 'hash2'),
      ]);

      // Both should succeed (last write wins)
      expect(user1.email).toBe(email.toLowerCase());
      expect(user2.email).toBe(email.toLowerCase());
    });

    it('should handle storage errors gracefully', async () => {
      const mockStore = getMockStore('vf-users');

      vi.mocked(mockStore.get).mockRejectedValueOnce(new Error('Storage error'));

      const user = await getUser('error@example.com');
      expect(user).toBeNull();
    });

    it('should handle malformed data in storage', async () => {
      const store = getMockStore('vf-forms');

      await store.setJSON('vf_malformed', 'not-valid-form-data');

      const form = await getForm('vf_malformed');
      // Should return the malformed data (no validation in getForm)
      expect(form).toBe('not-valid-form-data');
    });

    it('should handle very long field values', async () => {
      const longString = 'a'.repeat(10000);
      const user = await createUser(`${TEST_PREFIX}long@example.com`, longString);

      expect(user.passwordHash).toBe(longString);
    });

    it('should handle special characters in emails', async () => {
      const specialEmail = `${TEST_PREFIX}user+tag@example.com`;
      const user = await createUser(specialEmail, 'hash');

      expect(user.email).toBe(specialEmail.toLowerCase());
    });

    it('should handle rapid form creation and deletion', async () => {
      const userId = `${TEST_PREFIX}rapid_user`;

      // Create multiple forms rapidly
      const forms = await Promise.all([
        createForm(userId, { name: 'Form 1', publicKey: 'key1' }),
        createForm(userId, { name: 'Form 2', publicKey: 'key2' }),
        createForm(userId, { name: 'Form 3', publicKey: 'key3' }),
      ]);

      // Delete them all
      await Promise.all(forms.map((f) => deleteForm(f.id, userId)));

      const userForms = await getUserForms(userId);
      expect(userForms).toHaveLength(0);
    });
  });
});
