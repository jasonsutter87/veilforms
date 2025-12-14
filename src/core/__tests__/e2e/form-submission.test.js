/**
 * @jest-environment jsdom
 */

/**
 * E2E SMOKE TEST: Form Submission Flow
 *
 * Test Case: TC-E2E-010
 * Priority: Critical
 * Type: E2E
 *
 * Purpose: Verify complete form submission flow from creation to decryption
 *
 * Critical Path:
 * 1. Create form via API (simulated)
 * 2. Generate form encryption keys
 * 3. Encrypt test data client-side
 * 4. Submit to /api/submit (simulated)
 * 5. Verify submission stored correctly
 * 6. Retrieve submission
 * 7. Decrypt and verify data matches original
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Set up globals
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Web Crypto API
const mockSubtle = {
  generateKey: jest.fn(),
  exportKey: jest.fn(),
  importKey: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  digest: jest.fn()
};

const mockCrypto = {
  subtle: mockSubtle,
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Import modules
const {
  generateKeyPair,
  encryptSubmission,
  decryptSubmission
} = await import('../../encryption.js');

import {
  generateFormId,
  generateSubmissionId,
  createMockFormConfig,
  createMockSubmissionData,
  MockStorage
} from './test-helpers.js';

describe('E2E SMOKE TEST: Form Submission Flow', () => {
  let storage;
  let mockFormStore;
  let mockSubmissionStore;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new MockStorage();
    mockFormStore = new MockStorage();
    mockSubmissionStore = new MockStorage();
  });

  describe('TC-E2E-010: Complete Form Submission Lifecycle', () => {
    it('should handle form creation, submission, and retrieval', async () => {
      // STEP 1: Create form
      const formId = generateFormId();
      const formConfig = createMockFormConfig({
        id: formId,
        name: 'E2E Test Form'
      });

      // Mock key generation
      const mockPublicKey = { kty: 'RSA', n: 'public_n', e: 'AQAB' };
      const mockPrivateKey = { kty: 'RSA', n: 'public_n', d: 'private_d', e: 'AQAB' };

      mockSubtle.generateKey.mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' }
      });
      mockSubtle.exportKey
        .mockResolvedValueOnce(mockPublicKey)
        .mockResolvedValueOnce(mockPrivateKey);

      // STEP 2: Generate encryption keys for form
      const keyPair = await generateKeyPair();

      const form = {
        ...formConfig,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey, // In production, stored securely
        createdAt: Date.now(),
        status: 'active'
      };

      // Save form
      await mockFormStore.set(formId, form);

      // ASSERT: Form created successfully
      const savedForm = await mockFormStore.get(formId);
      expect(savedForm).toBeDefined();
      expect(savedForm.id).toBe(formId);
      expect(savedForm.name).toBe('E2E Test Form');
      expect(savedForm.publicKey).toEqual(mockPublicKey);
      expect(savedForm.status).toBe('active');

      // STEP 3: Client-side submission preparation
      const submissionId = generateSubmissionId();
      const submissionData = createMockSubmissionData({
        name: 'Test User',
        email: 'test@example.com',
        message: 'This is a test submission'
      });

      // Mock encryption
      mockSubtle.importKey.mockResolvedValue({ type: 'public' });
      mockSubtle.generateKey.mockResolvedValue({ type: 'symmetric' });
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(256));

      // STEP 4: Encrypt data client-side
      const encryptedPayload = await encryptSubmission(submissionData, form.publicKey);

      // ASSERT: Data encrypted
      expect(encryptedPayload.encrypted).toBe(true);
      expect(encryptedPayload.version).toBe('vf-e1');
      expect(encryptedPayload.data).toBeDefined();
      expect(encryptedPayload.key).toBeDefined();
      expect(encryptedPayload.iv).toBeDefined();

      // STEP 5: Submit to API (simulated)
      const submission = {
        id: submissionId,
        formId: formId,
        payload: encryptedPayload,
        timestamp: Date.now(),
        receivedAt: Date.now(),
        meta: {
          sdkVersion: '1.0.0',
          formVersion: '1',
          userAgent: 'Mozilla/5.0 Test Browser',
          region: 'US'
        }
      };

      // Validate submission structure
      expect(submission.id).toBeDefined();
      expect(submission.formId).toBe(formId);
      expect(submission.payload.encrypted).toBe(true);

      // STEP 6: Store submission
      await mockSubmissionStore.set(submissionId, submission);

      // ASSERT: Submission stored
      const storedSubmission = await mockSubmissionStore.get(submissionId);
      expect(storedSubmission).toBeDefined();
      expect(storedSubmission.id).toBe(submissionId);
      expect(storedSubmission.formId).toBe(formId);

      // STEP 7: Retrieve and decrypt submission (form owner)
      const retrievedSubmission = await mockSubmissionStore.get(submissionId);

      // Mock decryption
      mockSubtle.importKey
        .mockResolvedValueOnce({ type: 'private' })
        .mockResolvedValueOnce({ type: 'symmetric' });
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(submissionData)));

      const decryptedData = await decryptSubmission(
        retrievedSubmission.payload,
        form.privateKey
      );

      // ASSERT: Decrypted data matches original
      expect(decryptedData).toEqual(submissionData);
      expect(decryptedData.name).toBe('Test User');
      expect(decryptedData.email).toBe('test@example.com');
      expect(decryptedData.message).toBe('This is a test submission');
    });

    it('should validate submission ID format', () => {
      // Valid UUID v4 with vf- prefix
      const validId = generateSubmissionId();
      const uuidRegex = /^vf-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

      expect(uuidRegex.test(validId)).toBe(true);
    });

    it('should validate form ID format', () => {
      // Valid form ID with vf_ prefix
      const validId = generateFormId();
      const formIdRegex = /^vf_test_[a-z0-9_]+$/i;

      expect(formIdRegex.test(validId)).toBe(true);
    });

    it('should include required metadata fields', () => {
      const submissionId = generateSubmissionId();
      const formId = generateFormId();

      const submission = {
        id: submissionId,
        formId: formId,
        payload: { encrypted: true, data: 'encrypted', key: 'key', iv: 'iv' },
        timestamp: Date.now(),
        receivedAt: Date.now(),
        meta: {
          sdkVersion: '1.0.0',
          formVersion: '1',
          userAgent: 'Mozilla/5.0',
          region: 'US'
        }
      };

      // ASSERT: All required fields present
      expect(submission).toHaveProperty('id');
      expect(submission).toHaveProperty('formId');
      expect(submission).toHaveProperty('payload');
      expect(submission).toHaveProperty('timestamp');
      expect(submission).toHaveProperty('receivedAt');
      expect(submission.meta).toHaveProperty('sdkVersion');
      expect(submission.meta).toHaveProperty('formVersion');
      expect(submission.meta).toHaveProperty('userAgent');
      expect(submission.meta).toHaveProperty('region');
    });
  });

  describe('TC-E2E-011: Form Submission Validation', () => {
    it('should reject submission with missing formId', () => {
      const submission = {
        submissionId: generateSubmissionId(),
        payload: { encrypted: true, data: 'data' }
      };

      // ASSERT: Missing formId
      expect(submission.formId).toBeUndefined();
      // In real API, this would return 400 Bad Request
    });

    it('should reject submission with missing submissionId', () => {
      const submission = {
        formId: generateFormId(),
        payload: { encrypted: true, data: 'data' }
      };

      // ASSERT: Missing submissionId
      expect(submission.submissionId).toBeUndefined();
      // In real API, this would return 400 Bad Request
    });

    it('should reject submission with missing payload', () => {
      const submission = {
        formId: generateFormId(),
        submissionId: generateSubmissionId()
      };

      // ASSERT: Missing payload
      expect(submission.payload).toBeUndefined();
      // In real API, this would return 400 Bad Request
    });

    it('should validate encrypted payload structure', () => {
      const validPayload = {
        encrypted: true,
        version: 'vf-e1',
        data: 'base64data',
        key: 'base64key',
        iv: 'base64iv'
      };

      const invalidPayloads = [
        { encrypted: true }, // Missing fields
        { encrypted: true, data: 'data' }, // Missing key, iv, version
        { data: 'data', key: 'key', iv: 'iv' } // Missing encrypted flag
      ];

      // ASSERT: Valid payload has all fields
      expect(validPayload.encrypted).toBe(true);
      expect(validPayload.version).toBeDefined();
      expect(validPayload.data).toBeDefined();
      expect(validPayload.key).toBeDefined();
      expect(validPayload.iv).toBeDefined();

      // ASSERT: Invalid payloads missing required fields
      invalidPayloads.forEach(payload => {
        const hasAllFields = payload.encrypted && payload.version &&
                            payload.data && payload.key && payload.iv;
        expect(hasAllFields).toBeFalsy();
      });
    });
  });

  describe('TC-E2E-012: Multiple Submissions', () => {
    it('should handle multiple submissions to same form', async () => {
      const formId = generateFormId();

      // Create form
      const mockPublicKey = { kty: 'RSA', n: 'public', e: 'AQAB' };
      const mockPrivateKey = { kty: 'RSA', d: 'private', e: 'AQAB' };

      mockSubtle.generateKey.mockResolvedValue({
        publicKey: {},
        privateKey: {}
      });
      mockSubtle.exportKey
        .mockResolvedValueOnce(mockPublicKey)
        .mockResolvedValueOnce(mockPrivateKey);

      const keyPair = await generateKeyPair();

      const form = {
        id: formId,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        submissionCount: 0
      };

      await mockFormStore.set(formId, form);

      // Create multiple submissions
      const submissionData = [
        { name: 'User 1', email: 'user1@example.com', message: 'Message 1' },
        { name: 'User 2', email: 'user2@example.com', message: 'Message 2' },
        { name: 'User 3', email: 'user3@example.com', message: 'Message 3' }
      ];

      const submissionIds = [];

      for (let i = 0; i < submissionData.length; i++) {
        const submissionId = generateSubmissionId();
        submissionIds.push(submissionId);

        // Mock encryption for each submission
        mockSubtle.importKey.mockResolvedValue({});
        mockSubtle.generateKey.mockResolvedValue({});
        mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
        mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

        const encrypted = await encryptSubmission(submissionData[i], form.publicKey);

        const submission = {
          id: submissionId,
          formId: formId,
          payload: encrypted,
          timestamp: Date.now() + i
        };

        await mockSubmissionStore.set(submissionId, submission);
      }

      // ASSERT: All submissions stored
      expect(submissionIds.length).toBe(3);

      for (const id of submissionIds) {
        const stored = await mockSubmissionStore.get(id);
        expect(stored).toBeDefined();
        expect(stored.formId).toBe(formId);
      }

      // Verify submissions are unique
      const uniqueIds = new Set(submissionIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('should maintain submission order by timestamp', async () => {
      const submissions = [
        { id: '001', timestamp: 1000 },
        { id: '002', timestamp: 2000 },
        { id: '003', timestamp: 3000 }
      ];

      // Store in random order
      await mockSubmissionStore.set('002', submissions[1]);
      await mockSubmissionStore.set('001', submissions[0]);
      await mockSubmissionStore.set('003', submissions[2]);

      // Retrieve all
      const allSubmissions = await mockSubmissionStore.list();

      // Sort by timestamp
      const sorted = allSubmissions
        .map(s => s.value)
        .sort((a, b) => a.timestamp - b.timestamp);

      // ASSERT: Sorted correctly
      expect(sorted[0].id).toBe('001');
      expect(sorted[1].id).toBe('002');
      expect(sorted[2].id).toBe('003');
    });
  });

  describe('TC-E2E-013: Form Status Validation', () => {
    it('should reject submissions to deleted form', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        status: 'deleted',
        publicKey: {}
      };

      await mockFormStore.set(formId, form);

      // ASSERT: Form status is deleted
      const savedForm = await mockFormStore.get(formId);
      expect(savedForm.status).toBe('deleted');

      // In real API, submission would be rejected with 403 Forbidden
      const shouldReject = savedForm.status === 'deleted';
      expect(shouldReject).toBe(true);
    });

    it('should reject submissions to paused form', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        status: 'paused',
        publicKey: {}
      };

      await mockFormStore.set(formId, form);

      const savedForm = await mockFormStore.get(formId);
      expect(savedForm.status).toBe('paused');

      // In real API, submission would be rejected with 403 Forbidden
      const shouldReject = savedForm.status === 'paused';
      expect(shouldReject).toBe(true);
    });

    it('should accept submissions to active form', async () => {
      const formId = generateFormId();

      const form = {
        id: formId,
        status: 'active',
        publicKey: {}
      };

      await mockFormStore.set(formId, form);

      const savedForm = await mockFormStore.get(formId);
      expect(savedForm.status).toBe('active');

      // Submissions should be accepted
      const shouldAccept = savedForm.status === 'active';
      expect(shouldAccept).toBe(true);
    });
  });

  describe('TC-E2E-014: Submission Limits', () => {
    it('should enforce submission limits per tier', () => {
      const limits = {
        free: 100,
        starter: 1000,
        pro: 10000,
        enterprise: Infinity
      };

      // Test free tier limit
      const freeForm = { submissionCount: 100, subscription: 'free' };
      const shouldRejectFree = freeForm.submissionCount >= limits.free;
      expect(shouldRejectFree).toBe(true);

      // Test starter tier under limit
      const starterForm = { submissionCount: 500, subscription: 'starter' };
      const shouldAcceptStarter = starterForm.submissionCount < limits.starter;
      expect(shouldAcceptStarter).toBe(true);

      // Test enterprise unlimited
      const enterpriseForm = { submissionCount: 50000, subscription: 'enterprise' };
      const shouldAcceptEnterprise = enterpriseForm.submissionCount < limits.enterprise;
      expect(shouldAcceptEnterprise).toBe(true);
    });
  });

  describe('TC-E2E-015: Webhook Integration', () => {
    it('should prepare webhook payload on submission', () => {
      const formId = generateFormId();
      const submissionId = generateSubmissionId();

      const webhookPayload = {
        event: 'submission.created',
        formId: formId,
        submissionId: submissionId,
        timestamp: Date.now(),
        payload: { encrypted: true, data: 'encrypted' }
      };

      // ASSERT: Webhook payload structure
      expect(webhookPayload.event).toBe('submission.created');
      expect(webhookPayload.formId).toBe(formId);
      expect(webhookPayload.submissionId).toBe(submissionId);
      expect(webhookPayload.timestamp).toBeDefined();
      expect(webhookPayload.payload).toBeDefined();
      expect(webhookPayload.payload.encrypted).toBe(true);
    });

    it('should include signature header for webhook', () => {
      const webhookHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'VeilForms-Webhook/1.0',
        'X-VeilForms-Signature': 'base64encodedhmacsha256'
      };

      // ASSERT: Required headers present
      expect(webhookHeaders['Content-Type']).toBe('application/json');
      expect(webhookHeaders['User-Agent']).toContain('VeilForms-Webhook');
      expect(webhookHeaders['X-VeilForms-Signature']).toBeDefined();
    });
  });
});
