import { jest } from '@jest/globals';

// Mock data stores
const mockStores = {};

// Mock the @netlify/blobs module
jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: jest.fn(({ name }) => {
    if (!mockStores[name]) {
      mockStores[name] = new Map();
    }
    const store = mockStores[name];

    return {
      setJSON: jest.fn(async (key, value) => {
        store.set(key, JSON.stringify(value));
      }),
      get: jest.fn(async (key, options) => {
        const value = store.get(key);
        if (!value) return null;
        if (options?.type === 'json') {
          return JSON.parse(value);
        }
        return value;
      }),
      delete: jest.fn(async (key) => {
        store.delete(key);
      })
    };
  })
}));

// Import after mocking
const {
  createUser,
  getUser,
  updateUser,
  createPasswordResetToken,
  getPasswordResetToken,
  deletePasswordResetToken,
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
  deleteAllSubmissions
} = await import('../lib/storage.js');

describe('Storage Module', () => {
  beforeEach(() => {
    // Clear all mock stores
    Object.keys(mockStores).forEach(key => {
      mockStores[key].clear();
    });
    jest.clearAllMocks();
  });

  describe('User Operations', () => {
    describe('createUser', () => {
      it('should create a new user with correct properties', async () => {
        const email = 'test@example.com';
        const passwordHash = 'hashed_password';

        const user = await createUser(email, passwordHash);

        expect(user).toMatchObject({
          email: 'test@example.com',
          passwordHash: 'hashed_password',
          subscription: 'free',
          forms: []
        });
        expect(user.id).toMatch(/^user_\d+_[a-z0-9]+$/);
        expect(user.createdAt).toBeDefined();
      });

      it('should normalize email to lowercase', async () => {
        const user = await createUser('Test@EXAMPLE.com', 'hash');

        expect(user.email).toBe('test@example.com');
      });
    });

    describe('getUser', () => {
      it('should retrieve an existing user', async () => {
        await createUser('existing@example.com', 'hash123');

        const user = await getUser('existing@example.com');

        expect(user).toBeDefined();
        expect(user.email).toBe('existing@example.com');
      });

      it('should return null for non-existent user', async () => {
        const user = await getUser('nonexistent@example.com');

        expect(user).toBeNull();
      });

      it('should be case-insensitive for email lookup', async () => {
        await createUser('user@test.com', 'hash');

        const user = await getUser('USER@TEST.COM');

        expect(user).toBeDefined();
        expect(user.email).toBe('user@test.com');
      });
    });

    describe('updateUser', () => {
      it('should update user properties', async () => {
        await createUser('update@example.com', 'hash');

        const updated = await updateUser('update@example.com', {
          subscription: 'pro'
        });

        expect(updated.subscription).toBe('pro');
        expect(updated.updatedAt).toBeDefined();
      });

      it('should return null for non-existent user', async () => {
        const result = await updateUser('nonexistent@example.com', { subscription: 'pro' });

        expect(result).toBeNull();
      });

      it('should preserve existing properties', async () => {
        await createUser('preserve@example.com', 'original_hash');

        const updated = await updateUser('preserve@example.com', {
          subscription: 'team'
        });

        expect(updated.email).toBe('preserve@example.com');
        expect(updated.passwordHash).toBe('original_hash');
      });
    });
  });

  describe('Password Reset Token Operations', () => {
    describe('createPasswordResetToken', () => {
      it('should create a token with expiry', async () => {
        const email = 'reset@example.com';
        const token = 'reset_token_123';

        const tokenData = await createPasswordResetToken(email, token);

        expect(tokenData.email).toBe('reset@example.com');
        expect(tokenData.createdAt).toBeDefined();
        expect(tokenData.expiresAt).toBeDefined();

        // Check expiry is ~1 hour in future
        const expiry = new Date(tokenData.expiresAt);
        const created = new Date(tokenData.createdAt);
        const diff = expiry - created;
        expect(diff).toBe(60 * 60 * 1000); // 1 hour in ms
      });
    });

    describe('getPasswordResetToken', () => {
      it('should retrieve a valid token', async () => {
        await createPasswordResetToken('user@example.com', 'valid_token');

        const tokenData = await getPasswordResetToken('valid_token');

        expect(tokenData).toBeDefined();
        expect(tokenData.email).toBe('user@example.com');
      });

      it('should return null for non-existent token', async () => {
        const result = await getPasswordResetToken('nonexistent_token');

        expect(result).toBeNull();
      });

      it('should return null and delete expired token', async () => {
        // Create token with past expiry by manipulating the store directly
        const token = 'expired_token';
        const expiredData = {
          email: 'expired@example.com',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        };

        if (!mockStores['vf-password-reset-tokens']) {
          mockStores['vf-password-reset-tokens'] = new Map();
        }
        mockStores['vf-password-reset-tokens'].set(token, JSON.stringify(expiredData));

        const result = await getPasswordResetToken(token);

        expect(result).toBeNull();
      });
    });

    describe('deletePasswordResetToken', () => {
      it('should delete an existing token', async () => {
        await createPasswordResetToken('delete@example.com', 'token_to_delete');

        await deletePasswordResetToken('token_to_delete');

        const result = await getPasswordResetToken('token_to_delete');
        expect(result).toBeNull();
      });
    });
  });

  describe('Form Operations', () => {
    const mockUserId = 'user_123';

    describe('createForm', () => {
      it('should create a form with correct properties', async () => {
        const formData = {
          name: 'Contact Form',
          publicKey: 'public_key_value'
        };

        const form = await createForm(mockUserId, formData);

        expect(form).toMatchObject({
          userId: mockUserId,
          name: 'Contact Form',
          publicKey: 'public_key_value',
          submissionCount: 0
        });
        expect(form.id).toMatch(/^vf_[a-z0-9]+_[a-z0-9]+$/);
        expect(form.settings.encryption).toBe(true);
      });

      it('should use default settings when not provided', async () => {
        const form = await createForm(mockUserId, {
          name: 'Test Form',
          publicKey: 'key'
        });

        expect(form.settings.piiStrip).toBe(false);
        expect(form.settings.webhookUrl).toBeNull();
        expect(form.settings.allowedOrigins).toEqual(['*']);
      });

      it('should merge custom settings', async () => {
        const form = await createForm(mockUserId, {
          name: 'Custom Form',
          publicKey: 'key',
          settings: {
            piiStrip: true,
            webhookUrl: 'https://webhook.example.com',
            customField: 'value'
          }
        });

        expect(form.settings.piiStrip).toBe(true);
        expect(form.settings.webhookUrl).toBe('https://webhook.example.com');
        expect(form.settings.customField).toBe('value');
      });
    });

    describe('getForm', () => {
      it('should retrieve an existing form', async () => {
        const created = await createForm(mockUserId, {
          name: 'Get Test',
          publicKey: 'key'
        });

        const form = await getForm(created.id);

        expect(form).toBeDefined();
        expect(form.name).toBe('Get Test');
      });

      it('should return null for non-existent form', async () => {
        const form = await getForm('vf_nonexistent');

        expect(form).toBeNull();
      });
    });

    describe('updateForm', () => {
      it('should update form properties', async () => {
        const created = await createForm(mockUserId, {
          name: 'Original Name',
          publicKey: 'key'
        });

        const updated = await updateForm(created.id, {
          name: 'Updated Name'
        });

        expect(updated.name).toBe('Updated Name');
        expect(updated.updatedAt).toBeDefined();
      });

      it('should merge settings updates', async () => {
        const created = await createForm(mockUserId, {
          name: 'Form',
          publicKey: 'key',
          settings: { piiStrip: false }
        });

        const updated = await updateForm(created.id, {
          settings: { piiStrip: true, newSetting: 'value' }
        });

        expect(updated.settings.piiStrip).toBe(true);
        expect(updated.settings.newSetting).toBe('value');
        expect(updated.settings.encryption).toBe(true); // Original preserved
      });

      it('should return null for non-existent form', async () => {
        const result = await updateForm('vf_nonexistent', { name: 'New' });

        expect(result).toBeNull();
      });
    });

    describe('deleteForm', () => {
      it('should delete a form', async () => {
        const created = await createForm(mockUserId, {
          name: 'To Delete',
          publicKey: 'key'
        });

        await deleteForm(created.id, mockUserId);

        const form = await getForm(created.id);
        expect(form).toBeNull();
      });
    });

    describe('getUserForms', () => {
      it('should return all forms for a user', async () => {
        await createForm(mockUserId, { name: 'Form 1', publicKey: 'key1' });
        await createForm(mockUserId, { name: 'Form 2', publicKey: 'key2' });

        const forms = await getUserForms(mockUserId);

        expect(forms).toHaveLength(2);
        expect(forms.map(f => f.name).sort()).toEqual(['Form 1', 'Form 2']);
      });

      it('should return empty array for user with no forms', async () => {
        const forms = await getUserForms('user_with_no_forms');

        expect(forms).toEqual([]);
      });
    });
  });

  describe('API Key Operations', () => {
    const mockUserId = 'user_456';

    describe('createApiKey', () => {
      it('should create an API key with default permissions', async () => {
        const keyHash = 'hashed_key_123';

        const keyData = await createApiKey(mockUserId, keyHash);

        expect(keyData).toMatchObject({
          userId: mockUserId,
          keyHash: keyHash,
          lastUsed: null
        });
        expect(keyData.permissions).toContain('forms:read');
        expect(keyData.permissions).toContain('forms:write');
        expect(keyData.permissions).toContain('submissions:read');
        expect(keyData.permissions).toContain('submissions:delete');
      });

      it('should accept custom permissions', async () => {
        const keyData = await createApiKey(mockUserId, 'key_hash', ['forms:read']);

        expect(keyData.permissions).toEqual(['forms:read']);
      });
    });

    describe('getApiKeyData', () => {
      it('should retrieve API key data', async () => {
        await createApiKey(mockUserId, 'lookup_key');

        const keyData = await getApiKeyData('lookup_key');

        expect(keyData).toBeDefined();
        expect(keyData.userId).toBe(mockUserId);
      });

      it('should return null for non-existent key', async () => {
        const result = await getApiKeyData('nonexistent_key');

        expect(result).toBeNull();
      });
    });

    describe('updateApiKeyLastUsed', () => {
      it('should update lastUsed timestamp', async () => {
        await createApiKey(mockUserId, 'used_key');

        const before = await getApiKeyData('used_key');
        expect(before.lastUsed).toBeNull();

        const updated = await updateApiKeyLastUsed('used_key');

        expect(updated.lastUsed).toBeDefined();
        expect(new Date(updated.lastUsed).getTime()).toBeCloseTo(Date.now(), -2);
      });

      it('should return null for non-existent key', async () => {
        const result = await updateApiKeyLastUsed('nonexistent_key');

        expect(result).toBeNull();
      });
    });

    describe('revokeApiKey', () => {
      it('should delete an API key', async () => {
        await createApiKey(mockUserId, 'revoke_key');

        await revokeApiKey('revoke_key', mockUserId);

        const result = await getApiKeyData('revoke_key');
        expect(result).toBeNull();
      });
    });
  });

  describe('Submission Operations', () => {
    const formId = 'vf_test_form';

    describe('getSubmissions', () => {
      it('should return empty result for form with no submissions', async () => {
        const result = await getSubmissions(formId);

        expect(result).toEqual({
          submissions: [],
          total: 0,
          limit: 50,
          offset: 0
        });
      });

      it('should respect limit parameter', async () => {
        const result = await getSubmissions(formId, 10);

        expect(result.limit).toBe(10);
      });

      it('should respect offset parameter', async () => {
        const result = await getSubmissions(formId, 50, 10);

        expect(result.offset).toBe(10);
      });
    });

    describe('getSubmission', () => {
      it('should return null for non-existent submission', async () => {
        const result = await getSubmission(formId, 'nonexistent_sub');

        expect(result).toBeNull();
      });
    });

    describe('deleteSubmission', () => {
      it('should return true after deletion', async () => {
        const result = await deleteSubmission(formId, 'sub_to_delete');

        expect(result).toBe(true);
      });
    });

    describe('deleteAllSubmissions', () => {
      it('should return 0 for form with no submissions', async () => {
        const count = await deleteAllSubmissions('vf_empty_form');

        expect(count).toBe(0);
      });
    });
  });
});
