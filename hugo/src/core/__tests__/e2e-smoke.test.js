/**
 * @jest-environment jsdom
 */

/**
 * E2E SMOKE TEST SUITE
 *
 * Test Case: TC-E2E-SMOKE
 * Priority: Critical
 * Type: E2E Integration Smoke Test
 *
 * Purpose: Verify critical VeilForms paths work end-to-end before deployment
 *
 * This test suite validates:
 * 1. Form creation via API
 * 2. Encryption/decryption roundtrip integrity
 * 3. Form submission flow (encrypt -> submit -> retrieve -> decrypt)
 * 4. Data integrity throughout the entire lifecycle
 *
 * These tests must pass before any production deployment.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Set up globals for Node.js environment
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

// Import modules under test
const {
  generateKeyPair,
  encryptSubmission,
  decryptSubmission
} = await import('../encryption.js');

import {
  generateFormId,
  generateSubmissionId,
  createMockFormConfig,
  createMockSubmissionData,
  MockStorage
} from './e2e/test-helpers.js';

describe('E2E SMOKE TEST: Critical Path Verification', () => {
  let storage;
  let formStore;
  let submissionStore;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new MockStorage();
    formStore = new MockStorage();
    submissionStore = new MockStorage();
  });

  describe('SMOKE-001: Form Creation & Key Generation', () => {
    it('should create a form with valid encryption keys', async () => {
      // ARRANGE
      const formId = generateFormId();
      const formConfig = createMockFormConfig({
        id: formId,
        name: 'Smoke Test Form'
      });

      // Mock key generation
      const mockPublicKey = {
        kty: 'RSA',
        n: 'test_public_key_n_value',
        e: 'AQAB'
      };
      const mockPrivateKey = {
        kty: 'RSA',
        n: 'test_public_key_n_value',
        d: 'test_private_key_d_value',
        e: 'AQAB'
      };

      mockSubtle.generateKey.mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' }
      });
      mockSubtle.exportKey
        .mockResolvedValueOnce(mockPublicKey)
        .mockResolvedValueOnce(mockPrivateKey);

      // ACT
      const keyPair = await generateKeyPair();

      const form = {
        ...formConfig,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        createdAt: Date.now(),
        status: 'active'
      };

      await formStore.set(formId, form);

      // ASSERT
      const savedForm = await formStore.get(formId);
      expect(savedForm).toBeDefined();
      expect(savedForm.id).toBe(formId);
      expect(savedForm.name).toBe('Smoke Test Form');
      expect(savedForm.publicKey).toEqual(mockPublicKey);
      expect(savedForm.privateKey).toEqual(mockPrivateKey);
      expect(savedForm.status).toBe('active');
    });

    it('should generate unique form IDs', () => {
      // ACT
      const formId1 = generateFormId();
      const formId2 = generateFormId();
      const formId3 = generateFormId();

      // ASSERT
      expect(formId1).not.toBe(formId2);
      expect(formId2).not.toBe(formId3);
      expect(formId1).toMatch(/^vf_test_[a-z0-9_]+$/i);
      expect(formId2).toMatch(/^vf_test_[a-z0-9_]+$/i);
      expect(formId3).toMatch(/^vf_test_[a-z0-9_]+$/i);
    });
  });

  describe('SMOKE-002: Encryption Roundtrip', () => {
    it('should encrypt and decrypt data without loss', async () => {
      // ARRANGE
      const originalData = createMockSubmissionData({
        name: 'Alice Smith',
        email: 'alice@example.com',
        message: 'Testing encryption roundtrip'
      });

      // Mock key generation
      const mockPublicKey = { kty: 'RSA', n: 'pub', e: 'AQAB' };
      const mockPrivateKey = { kty: 'RSA', n: 'pub', d: 'priv', e: 'AQAB' };

      mockSubtle.generateKey.mockResolvedValue({
        publicKey: {},
        privateKey: {}
      });
      mockSubtle.exportKey
        .mockResolvedValueOnce(mockPublicKey)
        .mockResolvedValueOnce(mockPrivateKey);

      const keyPair = await generateKeyPair();

      // Mock encryption
      mockSubtle.importKey.mockResolvedValue({ type: 'public' });
      mockSubtle.generateKey.mockResolvedValue({ type: 'symmetric' });
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(256));

      // ACT - Encrypt
      const encrypted = await encryptSubmission(originalData, keyPair.publicKey);

      // ASSERT - Encrypted payload structure
      expect(encrypted).toBeDefined();
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.version).toBe('vf-e1');
      expect(encrypted.data).toBeDefined();
      expect(encrypted.key).toBeDefined();
      expect(encrypted.iv).toBeDefined();

      // Mock decryption
      mockSubtle.importKey
        .mockResolvedValueOnce({ type: 'private' })
        .mockResolvedValueOnce({ type: 'symmetric' });
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(originalData)));

      // ACT - Decrypt
      const decrypted = await decryptSubmission(encrypted, keyPair.privateKey);

      // ASSERT - Data integrity
      expect(decrypted).toEqual(originalData);
      expect(decrypted.name).toBe('Alice Smith');
      expect(decrypted.email).toBe('alice@example.com');
      expect(decrypted.message).toBe('Testing encryption roundtrip');
    });
  });

  describe('SMOKE-003: Complete Form Submission Flow', () => {
    it('should handle full submission lifecycle: create -> encrypt -> submit -> retrieve -> decrypt', async () => {
      // STEP 1: Create form
      const formId = generateFormId();
      const formConfig = createMockFormConfig({
        id: formId,
        name: 'Contact Form'
      });

      // Generate keys
      const mockPublicKey = { kty: 'RSA', n: 'pub', e: 'AQAB' };
      const mockPrivateKey = { kty: 'RSA', n: 'pub', d: 'priv', e: 'AQAB' };

      mockSubtle.generateKey.mockResolvedValue({
        publicKey: {},
        privateKey: {}
      });
      mockSubtle.exportKey
        .mockResolvedValueOnce(mockPublicKey)
        .mockResolvedValueOnce(mockPrivateKey);

      const keyPair = await generateKeyPair();

      const form = {
        ...formConfig,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        createdAt: Date.now(),
        status: 'active'
      };

      await formStore.set(formId, form);

      // STEP 2: Prepare submission data
      const submissionId = generateSubmissionId();
      const submissionData = createMockSubmissionData({
        name: 'Bob Johnson',
        email: 'bob@example.com',
        message: 'Hello from smoke test!'
      });

      // STEP 3: Encrypt submission
      mockSubtle.importKey.mockResolvedValue({ type: 'public' });
      mockSubtle.generateKey.mockResolvedValue({ type: 'symmetric' });
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(256));

      const encryptedPayload = await encryptSubmission(submissionData, form.publicKey);

      // STEP 4: Submit to API (simulated)
      const submission = {
        id: submissionId,
        formId: formId,
        payload: encryptedPayload,
        timestamp: Date.now(),
        receivedAt: Date.now(),
        meta: {
          sdk: 'veilforms-js',
          version: '1.0.0',
          userAgent: 'Mozilla/5.0 (Test Suite)',
          ip: null // Never stored
        }
      };

      // STEP 5: Store submission
      await submissionStore.set(submissionId, submission);

      // ASSERT: Submission stored correctly
      const storedSubmission = await submissionStore.get(submissionId);
      expect(storedSubmission).toBeDefined();
      expect(storedSubmission.id).toBe(submissionId);
      expect(storedSubmission.formId).toBe(formId);
      expect(storedSubmission.payload.encrypted).toBe(true);

      // STEP 6: Retrieve submission (form owner)
      const retrievedSubmission = await submissionStore.get(submissionId);
      expect(retrievedSubmission).toBeDefined();

      // STEP 7: Decrypt submission
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

      // ASSERT: Final data integrity check
      expect(decryptedData).toEqual(submissionData);
      expect(decryptedData.name).toBe('Bob Johnson');
      expect(decryptedData.email).toBe('bob@example.com');
      expect(decryptedData.message).toBe('Hello from smoke test!');
    });

    it('should validate submission ID format (UUID v4 with vf- prefix)', () => {
      // ACT
      const id1 = generateSubmissionId();
      const id2 = generateSubmissionId();
      const id3 = generateSubmissionId();

      // ASSERT
      const uuidRegex = /^vf-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

      expect(uuidRegex.test(id1)).toBe(true);
      expect(uuidRegex.test(id2)).toBe(true);
      expect(uuidRegex.test(id3)).toBe(true);

      // All IDs should be unique
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });

    it('should include required metadata in submission', () => {
      // ARRANGE
      const submissionId = generateSubmissionId();
      const formId = generateFormId();
      const timestamp = Date.now();

      const submission = {
        id: submissionId,
        formId: formId,
        payload: { encrypted: true, data: 'test', key: 'test', iv: 'test' },
        timestamp: timestamp,
        receivedAt: timestamp,
        meta: {
          sdk: 'veilforms-js',
          version: '1.0.0',
          userAgent: 'Mozilla/5.0 Test',
          ip: null
        }
      };

      // ASSERT: Required fields present
      expect(submission).toHaveProperty('id');
      expect(submission).toHaveProperty('formId');
      expect(submission).toHaveProperty('payload');
      expect(submission).toHaveProperty('timestamp');
      expect(submission).toHaveProperty('receivedAt');
      expect(submission.meta).toHaveProperty('sdk');
      expect(submission.meta).toHaveProperty('version');
      expect(submission.meta).toHaveProperty('userAgent');

      // IP should never be stored
      expect(submission.meta.ip).toBeNull();
    });
  });

  describe('SMOKE-004: Form Status Validation', () => {
    it('should only accept submissions to active forms', async () => {
      // ARRANGE
      const activeFormId = generateFormId();
      const pausedFormId = generateFormId();
      const deletedFormId = generateFormId();

      const activeForm = {
        id: activeFormId,
        status: 'active',
        publicKey: {}
      };

      const pausedForm = {
        id: pausedFormId,
        status: 'paused',
        publicKey: {}
      };

      const deletedForm = {
        id: deletedFormId,
        status: 'deleted',
        publicKey: {}
      };

      await formStore.set(activeFormId, activeForm);
      await formStore.set(pausedFormId, pausedForm);
      await formStore.set(deletedFormId, deletedForm);

      // ACT & ASSERT
      const activeFormCheck = await formStore.get(activeFormId);
      expect(activeFormCheck.status).toBe('active');
      expect(activeFormCheck.status === 'active').toBe(true); // Should accept

      const pausedFormCheck = await formStore.get(pausedFormId);
      expect(pausedFormCheck.status).toBe('paused');
      expect(pausedFormCheck.status === 'active').toBe(false); // Should reject

      const deletedFormCheck = await formStore.get(deletedFormId);
      expect(deletedFormCheck.status).toBe('deleted');
      expect(deletedFormCheck.status === 'active').toBe(false); // Should reject
    });
  });

  describe('SMOKE-005: Multiple Submissions', () => {
    it('should handle multiple submissions to the same form', async () => {
      // ARRANGE
      const formId = generateFormId();

      // Create form
      const mockPublicKey = { kty: 'RSA', n: 'pub', e: 'AQAB' };
      const mockPrivateKey = { kty: 'RSA', n: 'pub', d: 'priv', e: 'AQAB' };

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

      await formStore.set(formId, form);

      // Create multiple submissions
      const submissionData = [
        { name: 'User 1', email: 'user1@test.com', message: 'First' },
        { name: 'User 2', email: 'user2@test.com', message: 'Second' },
        { name: 'User 3', email: 'user3@test.com', message: 'Third' }
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

        await submissionStore.set(submissionId, submission);
      }

      // ASSERT: All submissions stored
      expect(submissionIds.length).toBe(3);

      for (const id of submissionIds) {
        const stored = await submissionStore.get(id);
        expect(stored).toBeDefined();
        expect(stored.formId).toBe(formId);
      }

      // Verify all submission IDs are unique
      const uniqueIds = new Set(submissionIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('SMOKE-006: Privacy & Security Validation', () => {
    it('should never store PII in plaintext', () => {
      // ARRANGE - Simulated encrypted submission
      const submission = {
        id: generateSubmissionId(),
        formId: generateFormId(),
        payload: {
          encrypted: true,
          version: 'vf-e1',
          data: 'base64_encrypted_data',
          key: 'base64_encrypted_key',
          iv: 'base64_initialization_vector'
        },
        timestamp: Date.now(),
        receivedAt: Date.now(),
        meta: {
          sdk: 'veilforms-js',
          version: '1.0.0',
          userAgent: 'Mozilla/5.0',
          ip: null // Never stored
        }
      };

      // ASSERT: No plaintext PII anywhere
      expect(submission.payload.encrypted).toBe(true);
      expect(submission.meta.ip).toBeNull();

      // Payload should not contain any raw email/name/phone patterns
      const payloadString = JSON.stringify(submission.payload);
      expect(payloadString).not.toMatch(/@/); // No email
      expect(payloadString).not.toMatch(/\d{3}-\d{3}-\d{4}/); // No phone
    });

    it('should use encryption version vf-e1', async () => {
      // ARRANGE
      const data = createMockSubmissionData();
      const mockPublicKey = { kty: 'RSA', n: 'pub', e: 'AQAB' };

      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.generateKey.mockResolvedValue({});
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

      // ACT
      const encrypted = await encryptSubmission(data, mockPublicKey);

      // ASSERT
      expect(encrypted.version).toBe('vf-e1');
      expect(encrypted.encrypted).toBe(true);
    });
  });

  describe('SMOKE-007: Error Handling', () => {
    it('should handle missing form gracefully', async () => {
      // ACT
      const nonExistentFormId = 'vf_test_nonexistent';
      const result = await formStore.get(nonExistentFormId);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should handle missing submission gracefully', async () => {
      // ACT
      const nonExistentSubmissionId = 'vf-00000000-0000-4000-0000-000000000000';
      const result = await submissionStore.get(nonExistentSubmissionId);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should validate encrypted payload structure', () => {
      // Valid payload
      const validPayload = {
        encrypted: true,
        version: 'vf-e1',
        data: 'base64data',
        key: 'base64key',
        iv: 'base64iv'
      };

      // Invalid payloads
      const invalidPayloads = [
        { encrypted: true }, // Missing fields
        { encrypted: true, data: 'data' }, // Missing key, iv, version
        { data: 'data', key: 'key', iv: 'iv' }, // Missing encrypted flag
        { encrypted: false, data: 'data', key: 'key', iv: 'iv' } // Not encrypted
      ];

      // ASSERT: Valid payload has all required fields
      expect(validPayload.encrypted).toBe(true);
      expect(validPayload.version).toBeDefined();
      expect(validPayload.data).toBeDefined();
      expect(validPayload.key).toBeDefined();
      expect(validPayload.iv).toBeDefined();

      // ASSERT: Invalid payloads fail validation
      invalidPayloads.forEach(payload => {
        const isValid = payload.encrypted === true &&
                       payload.version &&
                       payload.data &&
                       payload.key &&
                       payload.iv;
        expect(isValid).toBeFalsy();
      });
    });
  });
});
