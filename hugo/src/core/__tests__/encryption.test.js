/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock Web Crypto API for Node.js test environment
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

// Set up crypto mock
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Add TextEncoder/TextDecoder for Node.js
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Import after setting up mocks
const {
  generateKeyPair,
  encryptSubmission,
  decryptSubmission,
  hashField
} = await import('../encryption.js');

describe('Encryption Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateKeyPair', () => {
    it('should generate RSA-OAEP key pair with correct parameters', async () => {
      const mockPublicKey = { type: 'public' };
      const mockPrivateKey = { type: 'private' };
      const mockExportedPublic = { kty: 'RSA', n: 'public_n' };
      const mockExportedPrivate = { kty: 'RSA', d: 'private_d' };

      mockSubtle.generateKey.mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey
      });
      mockSubtle.exportKey
        .mockResolvedValueOnce(mockExportedPublic)
        .mockResolvedValueOnce(mockExportedPrivate);

      const result = await generateKeyPair();

      expect(mockSubtle.generateKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'RSA-OAEP',
          modulusLength: 2048,
          hash: 'SHA-256'
        }),
        true,
        ['encrypt', 'decrypt']
      );
      expect(result.publicKey).toEqual(mockExportedPublic);
      expect(result.privateKey).toEqual(mockExportedPrivate);
      expect(result.createdAt).toBeDefined();
    });

    it('should create extractable keys', async () => {
      mockSubtle.generateKey.mockResolvedValue({
        publicKey: {},
        privateKey: {}
      });
      mockSubtle.exportKey.mockResolvedValue({});

      await generateKeyPair();

      expect(mockSubtle.generateKey).toHaveBeenCalledWith(
        expect.anything(),
        true, // extractable = true
        expect.anything()
      );
    });
  });

  describe('encryptSubmission', () => {
    const mockPublicKeyJwk = {
      kty: 'RSA',
      n: 'test_n',
      e: 'AQAB',
      alg: 'RSA-OAEP-256'
    };

    beforeEach(() => {
      mockSubtle.importKey.mockResolvedValue({ type: 'public' });
      mockSubtle.generateKey.mockResolvedValue({ type: 'symmetric' });
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(128));
    });

    it('should return encrypted payload with correct structure', async () => {
      const formData = { name: 'Test', email: 'test@test.com' };

      const result = await encryptSubmission(formData, mockPublicKeyJwk);

      expect(result).toMatchObject({
        encrypted: true,
        version: 'vf-e1'
      });
      expect(result.data).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.iv).toBeDefined();
    });

    it('should import public key with RSA-OAEP algorithm', async () => {
      const formData = { message: 'Hello' };

      await encryptSubmission(formData, mockPublicKeyJwk);

      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'jwk',
        mockPublicKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
      );
    });

    it('should generate AES-256-GCM symmetric key', async () => {
      const formData = { field: 'value' };

      await encryptSubmission(formData, mockPublicKeyJwk);

      expect(mockSubtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('should encrypt data with AES-GCM', async () => {
      const formData = { test: 'data' };

      await encryptSubmission(formData, mockPublicKeyJwk);

      // First encrypt call should be AES-GCM
      const firstCall = mockSubtle.encrypt.mock.calls[0];
      expect(firstCall[0].name).toBe('AES-GCM');
      expect(firstCall[0].iv).toBeDefined();
    });

    it('should encrypt symmetric key with RSA-OAEP', async () => {
      const formData = { test: 'data' };

      await encryptSubmission(formData, mockPublicKeyJwk);

      // Second encrypt call should be RSA-OAEP
      expect(mockSubtle.encrypt).toHaveBeenCalledWith(
        { name: 'RSA-OAEP' },
        expect.anything(),
        expect.any(ArrayBuffer)
      );
    });

    it('should use random IV for each encryption', async () => {
      const formData = { field: 'value' };

      await encryptSubmission(formData, mockPublicKeyJwk);

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(
        expect.any(Uint8Array)
      );
    });

    it('should handle complex nested form data', async () => {
      const formData = {
        user: { name: 'John', age: 30 },
        items: ['a', 'b', 'c'],
        metadata: { source: 'web' }
      };

      const result = await encryptSubmission(formData, mockPublicKeyJwk);

      expect(result.encrypted).toBe(true);
    });
  });

  describe('decryptSubmission', () => {
    const mockPrivateKeyJwk = {
      kty: 'RSA',
      n: 'test_n',
      d: 'test_d',
      e: 'AQAB'
    };

    it('should return unencrypted payload as-is', async () => {
      const payload = {
        encrypted: false,
        data: { name: 'Test' }
      };

      const result = await decryptSubmission(payload, mockPrivateKeyJwk);

      expect(result).toEqual(payload);
      expect(mockSubtle.importKey).not.toHaveBeenCalled();
    });

    it('should import private key for decryption', async () => {
      // Use valid base64 strings
      const payload = {
        encrypted: true,
        version: 'vf-e1',
        data: btoa('encryptedDataHere'),
        key: btoa('encryptedKeyHere'),
        iv: btoa('initialization')
      };

      mockSubtle.importKey.mockResolvedValue({ type: 'private' });
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32)) // symmetric key
        .mockResolvedValueOnce(new TextEncoder().encode('{"test":"data"}')); // data

      await decryptSubmission(payload, mockPrivateKeyJwk);

      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'jwk',
        mockPrivateKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['decrypt']
      );
    });

    it('should decrypt symmetric key with RSA', async () => {
      const payload = {
        encrypted: true,
        version: 'vf-e1',
        data: btoa('encryptedData'),
        key: btoa('encryptedKey'),
        iv: btoa('iv12bytes123')
      };

      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockResolvedValueOnce(new TextEncoder().encode('{}'));

      await decryptSubmission(payload, mockPrivateKeyJwk);

      expect(mockSubtle.decrypt).toHaveBeenCalledWith(
        { name: 'RSA-OAEP' },
        expect.anything(),
        expect.any(ArrayBuffer)
      );
    });

    it('should return parsed JSON data', async () => {
      const payload = {
        encrypted: true,
        version: 'vf-e1',
        data: btoa('encryptedDataContent'),
        key: btoa('encryptedKeyContent'),
        iv: btoa('initvector12')
      };

      const expectedData = { name: 'John', email: 'john@test.com' };

      mockSubtle.importKey
        .mockResolvedValueOnce({ type: 'private' }) // private key import
        .mockResolvedValueOnce({ type: 'symmetric' }); // symmetric key import
      mockSubtle.decrypt
        .mockResolvedValueOnce(new ArrayBuffer(32)) // RSA decrypt symmetric key
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(expectedData))); // AES decrypt data

      const result = await decryptSubmission(payload, mockPrivateKeyJwk);

      expect(result).toEqual(expectedData);
    });
  });

  describe('hashField', () => {
    it('should hash a value using SHA-256', async () => {
      const mockHashBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
      mockSubtle.digest.mockResolvedValue(mockHashBuffer);

      const result = await hashField('test@example.com');

      expect(mockSubtle.digest).toHaveBeenCalledWith(
        'SHA-256',
        expect.anything() // Data is encoded as Uint8Array
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should normalize value before hashing (lowercase, trim)', async () => {
      mockSubtle.digest.mockResolvedValue(new ArrayBuffer(8));

      await hashField('  TEST@EXAMPLE.COM  ');

      const calledData = mockSubtle.digest.mock.calls[0][1];
      const decoder = new TextDecoder();
      const decodedValue = decoder.decode(calledData);

      expect(decodedValue).toBe('test@example.com');
    });

    it('should include salt in hash computation', async () => {
      mockSubtle.digest.mockResolvedValue(new ArrayBuffer(8));

      await hashField('value', 'my-salt');

      const calledData = mockSubtle.digest.mock.calls[0][1];
      const decoder = new TextDecoder();
      const decodedValue = decoder.decode(calledData);

      expect(decodedValue).toBe('my-saltvalue');
    });

    it('should return base64 encoded hash', async () => {
      const mockHash = new Uint8Array([0, 1, 2, 3]).buffer;
      mockSubtle.digest.mockResolvedValue(mockHash);

      const result = await hashField('test');

      // Should be valid base64
      expect(() => atob(result)).not.toThrow();
    });

    it('should produce different hashes for different inputs', async () => {
      mockSubtle.digest
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4]).buffer)
        .mockResolvedValueOnce(new Uint8Array([5, 6, 7, 8]).buffer);

      const hash1 = await hashField('value1');
      const hash2 = await hashField('value2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash for same input', async () => {
      const consistentHash = new Uint8Array([9, 9, 9, 9]).buffer;
      mockSubtle.digest.mockResolvedValue(consistentHash);

      const hash1 = await hashField('same-value', 'salt');
      const hash2 = await hashField('same-value', 'salt');

      expect(hash1).toBe(hash2);
    });
  });

  describe('Encryption Version', () => {
    it('should use vf-e1 version for compatibility tracking', async () => {
      mockSubtle.importKey.mockResolvedValue({});
      mockSubtle.generateKey.mockResolvedValue({});
      mockSubtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(16));

      const result = await encryptSubmission({ test: 'data' }, {});

      expect(result.version).toBe('vf-e1');
    });
  });
});
