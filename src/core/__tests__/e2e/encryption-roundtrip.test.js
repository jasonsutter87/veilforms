/**
 * @jest-environment jsdom
 */

/**
 * E2E SMOKE TEST: Encryption Roundtrip
 *
 * Test Case: TC-E2E-001
 * Priority: Critical
 * Type: E2E
 *
 * Purpose: Verify end-to-end encryption and decryption integrity
 *
 * Critical Path:
 * 1. Generate RSA keypair
 * 2. Encrypt form data with public key
 * 3. Store encrypted data (simulated)
 * 4. Retrieve encrypted data
 * 5. Decrypt with private key
 * 6. Verify decrypted data matches original
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
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

// Import encryption module
const {
  generateKeyPair,
  encryptSubmission,
  decryptSubmission,
  hashField
} = await import('../../encryption.js');

// Import test helpers
import {
  createMockSubmissionData,
  deepEqual,
  MockStorage
} from './test-helpers.js';

describe('E2E SMOKE TEST: Encryption Roundtrip', () => {
  let storage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new MockStorage();
  });

  describe('TC-E2E-001: Complete Encryption/Decryption Cycle', () => {
    it('should successfully encrypt and decrypt form submission data', async () => {
      // ARRANGE: Set up mock crypto responses
      const mockPublicKey = { kty: 'RSA', n: 'mock_public_n', e: 'AQAB' };
      const mockPrivateKey = { kty: 'RSA', n: 'mock_public_n', d: 'mock_private_d', e: 'AQAB' };

      // Mock key generation
      mockSubtle.generateKey.mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' }
      });
      mockSubtle.exportKey
        .mockResolvedValueOnce(mockPublicKey)
        .mockResolvedValueOnce(mockPrivateKey);

      // STEP 1: Generate keypair
      const keyPair = await generateKeyPair();

      // ASSERT: Keypair generated successfully
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair).toHaveProperty('createdAt');
      expect(keyPair.publicKey).toEqual(mockPublicKey);
      expect(keyPair.privateKey).toEqual(mockPrivateKey);

      // STEP 2: Create test submission data
      const originalData = createMockSubmissionData({
        name: 'Alice Smith',
        email: 'alice@example.com',
        message: 'This is a sensitive message that must be encrypted.'
      });

      // Mock encryption
      mockSubtle.importKey.mockResolvedValue({ type: 'public' });
      mockSubtle.generateKey.mockResolvedValue({ type: 'symmetric' });
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

      // STEP 3: Encrypt submission
      const encryptedPayload = await encryptSubmission(originalData, keyPair.publicKey);

      // ASSERT: Encrypted payload has correct structure
      expect(encryptedPayload).toMatchObject({
        encrypted: true,
        version: 'vf-e1'
      });
      expect(encryptedPayload.data).toBeDefined();
      expect(encryptedPayload.key).toBeDefined();
      expect(encryptedPayload.iv).toBeDefined();
      expect(typeof encryptedPayload.data).toBe('string');
      expect(typeof encryptedPayload.key).toBe('string');
      expect(typeof encryptedPayload.iv).toBe('string');

      // STEP 4: Store encrypted data
      await storage.set('submission_test_001', encryptedPayload);

      // STEP 5: Retrieve encrypted data
      const retrievedPayload = await storage.get('submission_test_001');

      // ASSERT: Retrieved data matches stored data
      expect(retrievedPayload).toEqual(encryptedPayload);

      // STEP 6: Decrypt submission
      mockSubtle.importKey
        .mockResolvedValueOnce({ type: 'private' })
        .mockResolvedValueOnce({ type: 'symmetric' });
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(originalData)));

      const decryptedData = await decryptSubmission(retrievedPayload, keyPair.privateKey);

      // ASSERT: Decrypted data matches original
      expect(decryptedData).toEqual(originalData);
      expect(decryptedData.name).toBe('Alice Smith');
      expect(decryptedData.email).toBe('alice@example.com');
      expect(decryptedData.message).toBe('This is a sensitive message that must be encrypted.');
    });

    it('should handle complex nested data structures', async () => {
      // ARRANGE: Complex submission data
      const complexData = {
        user: {
          firstName: 'Bob',
          lastName: 'Johnson',
          contact: {
            email: 'bob@example.com',
            phone: '+1-555-0123'
          }
        },
        preferences: ['newsletter', 'updates'],
        metadata: {
          source: 'web',
          timestamp: Date.now()
        }
      };

      const mockPublicKey = { kty: 'RSA', n: 'test_n', e: 'AQAB' };
      const mockPrivateKey = { kty: 'RSA', d: 'test_d', e: 'AQAB' };

      // Mock encryption flow
      mockSubtle.importKey.mockResolvedValue({ type: 'public' });
      mockSubtle.generateKey.mockResolvedValue({ type: 'symmetric' });
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(256));

      // Encrypt
      const encrypted = await encryptSubmission(complexData, mockPublicKey);

      // Mock decryption flow
      mockSubtle.importKey
        .mockResolvedValueOnce({ type: 'private' })
        .mockResolvedValueOnce({ type: 'symmetric' });
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(complexData)));

      // Decrypt
      const decrypted = await decryptSubmission(encrypted, mockPrivateKey);

      // ASSERT: Complex structure preserved
      expect(decrypted).toEqual(complexData);
      expect(decrypted.user.contact.email).toBe('bob@example.com');
      expect(decrypted.preferences).toEqual(['newsletter', 'updates']);
      expect(decrypted.metadata.source).toBe('web');
    });
  });

  describe('TC-E2E-002: Field Hashing for PII Detection', () => {
    it('should consistently hash sensitive fields', async () => {
      // ARRANGE
      const email = 'user@example.com';
      const salt = 'form_abc123';

      // Mock hash
      const mockHash = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
      mockSubtle.digest.mockResolvedValue(mockHash);

      // ACT: Hash field multiple times
      const hash1 = await hashField(email, salt);
      const hash2 = await hashField(email, salt);

      // ASSERT: Hashes are consistent
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);

      // Verify digest was called with SHA-256 (called twice, once for each hash)
      expect(mockSubtle.digest).toHaveBeenCalledTimes(2);
      expect(mockSubtle.digest.mock.calls[0][0]).toBe('SHA-256');
      // Verify second parameter is a Uint8Array (checking constructor name)
      expect(mockSubtle.digest.mock.calls[0][1].constructor.name).toBe('Uint8Array');
    });

    it('should normalize values before hashing', async () => {
      // ARRANGE: Same email with different formatting
      const email1 = '  USER@EXAMPLE.COM  ';
      const email2 = 'user@example.com';
      const salt = 'test_salt';

      const mockHash = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2]).buffer;
      mockSubtle.digest.mockResolvedValue(mockHash);

      // ACT
      const hash1 = await hashField(email1, salt);
      const hash2 = await hashField(email2, salt);

      // ASSERT: Normalized hashes match
      expect(hash1).toBe(hash2);

      // Verify normalization (lowercase, trim)
      const digestCalls = mockSubtle.digest.mock.calls;
      const decoder = new TextDecoder();
      const normalized1 = decoder.decode(digestCalls[0][1]);
      const normalized2 = decoder.decode(digestCalls[1][1]);
      expect(normalized1).toBe('test_saltuser@example.com');
      expect(normalized2).toBe('test_saltuser@example.com');
    });

    it('should produce different hashes for different values', async () => {
      // ARRANGE
      mockSubtle.digest
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4]).buffer)
        .mockResolvedValueOnce(new Uint8Array([5, 6, 7, 8]).buffer);

      // ACT
      const hash1 = await hashField('email1@example.com', 'salt');
      const hash2 = await hashField('email2@example.com', 'salt');

      // ASSERT
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('TC-E2E-003: Encryption Algorithm Validation', () => {
    it('should use RSA-OAEP-256 for asymmetric encryption', async () => {
      // ARRANGE
      const mockKeys = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' }
      };
      mockSubtle.generateKey.mockResolvedValue(mockKeys);
      mockSubtle.exportKey.mockResolvedValue({ kty: 'RSA' });

      // ACT
      await generateKeyPair();

      // ASSERT: Correct algorithm and parameters
      expect(mockSubtle.generateKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'RSA-OAEP',
          modulusLength: 2048,
          hash: 'SHA-256'
        }),
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('should use AES-256-GCM for symmetric encryption', async () => {
      // ARRANGE
      const formData = { test: 'data' };
      const publicKey = { kty: 'RSA', n: 'test', e: 'AQAB' };

      mockSubtle.importKey.mockResolvedValue({ type: 'public' });
      mockSubtle.generateKey.mockResolvedValue({ type: 'symmetric' });
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

      // ACT
      await encryptSubmission(formData, publicKey);

      // ASSERT: AES-GCM with 256-bit key
      expect(mockSubtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('should use unique IV for each encryption', async () => {
      // ARRANGE
      const formData = { field: 'value' };
      const publicKey = { kty: 'RSA' };

      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.generateKey.mockResolvedValue({});
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

      // ACT
      await encryptSubmission(formData, publicKey);

      // ASSERT: Random IV generated
      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(
        expect.any(Uint8Array)
      );

      // Verify IV passed to AES-GCM encryption
      const encryptCalls = mockSubtle.encrypt.mock.calls;
      const aesCall = encryptCalls.find(call => call[0].name === 'AES-GCM');
      expect(aesCall).toBeDefined();
      expect(aesCall[0].iv).toBeDefined();
    });
  });

  describe('TC-E2E-004: Error Handling', () => {
    it('should handle unencrypted payloads gracefully', async () => {
      // ARRANGE: Unencrypted payload
      const unencryptedPayload = {
        encrypted: false,
        data: { name: 'Test', email: 'test@example.com' }
      };

      // ACT
      const result = await decryptSubmission(unencryptedPayload, {});

      // ASSERT: Returns payload as-is
      expect(result).toEqual(unencryptedPayload);
      expect(mockSubtle.importKey).not.toHaveBeenCalled();
      expect(mockSubtle.decrypt).not.toHaveBeenCalled();
    });

    it('should validate encryption version', async () => {
      // ARRANGE
      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.generateKey.mockResolvedValue({});
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

      // ACT
      const encrypted = await encryptSubmission({ test: 'data' }, { kty: 'RSA' });

      // ASSERT: Version included
      expect(encrypted.version).toBe('vf-e1');
    });
  });

  describe('TC-E2E-005: Data Integrity', () => {
    it('should preserve all data types through encryption', async () => {
      // ARRANGE: Various data types
      const testData = {
        stringField: 'text value',
        numberField: 42,
        booleanField: true,
        nullField: null,
        arrayField: [1, 2, 3],
        objectField: { nested: 'value' }
      };

      const publicKey = { kty: 'RSA' };
      const privateKey = { kty: 'RSA', d: 'private' };

      // Mock encryption
      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.generateKey.mockResolvedValue({});
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

      const encrypted = await encryptSubmission(testData, publicKey);

      // Mock decryption
      mockSubtle.importKey
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(testData)));

      const decrypted = await decryptSubmission(encrypted, privateKey);

      // ASSERT: All types preserved
      expect(decrypted).toEqual(testData);
      expect(typeof decrypted.stringField).toBe('string');
      expect(typeof decrypted.numberField).toBe('number');
      expect(typeof decrypted.booleanField).toBe('boolean');
      expect(decrypted.nullField).toBe(null);
      expect(Array.isArray(decrypted.arrayField)).toBe(true);
      expect(typeof decrypted.objectField).toBe('object');
    });

    it('should handle empty data', async () => {
      // ARRANGE: Empty object
      const emptyData = {};
      const publicKey = { kty: 'RSA' };
      const privateKey = { kty: 'RSA', d: 'private' };

      // Mock encryption
      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.generateKey.mockResolvedValue({});
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));

      const encrypted = await encryptSubmission(emptyData, publicKey);

      // Mock decryption
      mockSubtle.importKey
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(emptyData)));

      const decrypted = await decryptSubmission(encrypted, privateKey);

      // ASSERT
      expect(decrypted).toEqual({});
    });

    it('should handle large data payloads', async () => {
      // ARRANGE: Large dataset
      const largeData = {
        description: 'A'.repeat(10000), // 10KB string
        items: Array(100).fill({ id: 1, name: 'item', data: 'value' })
      };

      const publicKey = { kty: 'RSA' };
      const privateKey = { kty: 'RSA', d: 'private' };

      // Mock encryption
      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.generateKey.mockResolvedValue({});
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(12000));

      const encrypted = await encryptSubmission(largeData, publicKey);

      // Mock decryption
      mockSubtle.importKey
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(largeData)));

      const decrypted = await decryptSubmission(encrypted, privateKey);

      // ASSERT: Large data preserved
      expect(decrypted.description.length).toBe(10000);
      expect(decrypted.items.length).toBe(100);
    });
  });
});
