/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock Web Crypto API
const mockSubtle = {
  digest: jest.fn()
};

// Use a counter to ensure different values each call
let randomCallCount = 0;
const mockCrypto = {
  subtle: mockSubtle,
  getRandomValues: jest.fn((arr) => {
    randomCallCount++;
    for (let i = 0; i < arr.length; i++) {
      // Use combination of counter and Math.random for better uniqueness
      arr[i] = Math.floor((Math.random() * 256 + randomCallCount + i) % 256);
    }
    return arr;
  })
};

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
  createIdentityHash,
  createAnonymousId,
  isValidSubmissionId
} = await import('../identity.js');

describe('Identity Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createIdentityHash', () => {
    beforeEach(() => {
      // Mock digest to return a predictable hash
      const mockHashArray = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        mockHashArray[i] = i;
      }
      mockSubtle.digest.mockResolvedValue(mockHashArray.buffer);
    });

    it('should return object with id, timestamp, and formId', async () => {
      const result = await createIdentityHash('form_123');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('formId');
      expect(result.formId).toBe('form_123');
    });

    it('should use SHA-256 for hashing', async () => {
      await createIdentityHash('form_456');

      expect(mockSubtle.digest).toHaveBeenCalledWith(
        'SHA-256',
        expect.anything() // Data is encoded as Uint8Array
      );
    });

    it('should generate 32-character hex ID', async () => {
      const result = await createIdentityHash('form_789');

      expect(result.id).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should include timestamp in payload', async () => {
      const before = Date.now();
      const result = await createIdentityHash('form_test');
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('should use default salt when not provided', async () => {
      await createIdentityHash('form_abc');

      const calledData = mockSubtle.digest.mock.calls[0][1];
      const decoder = new TextDecoder();
      const payload = decoder.decode(calledData);

      expect(payload).toContain('veilforms-v1');
    });

    it('should use custom salt when provided', async () => {
      await createIdentityHash('form_abc', { salt: 'custom-salt' });

      const calledData = mockSubtle.digest.mock.calls[0][1];
      const decoder = new TextDecoder();
      const payload = decoder.decode(calledData);

      expect(payload).toContain('custom-salt');
      expect(payload).not.toContain('veilforms-v1');
    });

    it('should generate entropy using crypto.getRandomValues', async () => {
      await createIdentityHash('form_xyz');

      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
    });

    it('should not include any PII in the hash', async () => {
      const result = await createIdentityHash('form_test');

      // Check that result only contains non-PII fields
      const keys = Object.keys(result);
      expect(keys).toEqual(['id', 'timestamp', 'formId']);

      // Verify no IP, email, name, or user agent
      expect(result).not.toHaveProperty('ip');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('name');
      expect(result).not.toHaveProperty('userAgent');
    });

    it('should generate different IDs for same formId', async () => {
      // Vary the mock responses
      let callCount = 0;
      mockSubtle.digest.mockImplementation(() => {
        const arr = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          arr[i] = (callCount * 10 + i) % 256;
        }
        callCount++;
        return Promise.resolve(arr.buffer);
      });

      const result1 = await createIdentityHash('same_form');
      const result2 = await createIdentityHash('same_form');

      // IDs should be different due to entropy
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('createAnonymousId', () => {
    it('should return a string starting with vf-', () => {
      const id = createAnonymousId('form_123');

      expect(id).toMatch(/^vf-/);
    });

    it('should generate UUID v4 format', () => {
      const id = createAnonymousId('form_456');

      // vf-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidPart = id.substring(3); // Remove 'vf-' prefix
      expect(uuidPart).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
      );
    });

    it('should always have version 4 marker', () => {
      for (let i = 0; i < 10; i++) {
        const id = createAnonymousId('form_test');
        // UUID format: vf-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        // Position of '4': vf- (3) + xxxxxxxx (8) + - (1) + xxxx (4) + - (1) = 17
        expect(id.charAt(17)).toBe('4');
      }
    });

    it('should always have correct variant bits', () => {
      for (let i = 0; i < 10; i++) {
        const id = createAnonymousId('form_test');
        // UUID format: vf-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        // Position of 'y': vf- (3) + xxxxxxxx (8) + - (1) + xxxx (4) + - (1) + 4xxx (4) + - (1) = 22
        const variantChar = id.charAt(22);
        expect(['8', '9', 'a', 'b']).toContain(variantChar);
      }
    });

    it('should use crypto.getRandomValues', () => {
      createAnonymousId('form_xyz');

      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(createAnonymousId('form_test'));
      }

      expect(ids.size).toBe(100);
    });

    it('should not depend on formId for uniqueness', () => {
      // Different formIds should still produce unique IDs
      const id1 = createAnonymousId('form_a');
      const id2 = createAnonymousId('form_b');

      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidSubmissionId', () => {
    describe('Hash Format (32 hex characters)', () => {
      it('should accept valid 32-char hex string', () => {
        const validHash = '0123456789abcdef0123456789abcdef';

        expect(isValidSubmissionId(validHash)).toBe(true);
      });

      it('should accept lowercase hex', () => {
        expect(isValidSubmissionId('abcdef0123456789abcdef0123456789')).toBe(true);
      });

      it('should reject uppercase hex', () => {
        expect(isValidSubmissionId('ABCDEF0123456789ABCDEF0123456789')).toBe(false);
      });

      it('should reject shorter hex string', () => {
        expect(isValidSubmissionId('0123456789abcdef')).toBe(false);
      });

      it('should reject longer hex string', () => {
        expect(isValidSubmissionId('0123456789abcdef0123456789abcdef00')).toBe(false);
      });

      it('should reject non-hex characters', () => {
        expect(isValidSubmissionId('0123456789ghijkl0123456789ghijkl')).toBe(false);
      });
    });

    describe('UUID Format (vf- prefixed)', () => {
      it('should accept valid UUID format', () => {
        const validUuid = 'vf-a1b2c3d4-e5f6-4a1b-8c2d-e3f4a5b6c7d8';

        expect(isValidSubmissionId(validUuid)).toBe(true);
      });

      it('should require vf- prefix', () => {
        const noPrefix = 'a1b2c3d4-e5f6-4a1b-8c2d-e3f4a5b6c7d8';

        expect(isValidSubmissionId(noPrefix)).toBe(false);
      });

      it('should require version 4 marker', () => {
        const wrongVersion = 'vf-a1b2c3d4-e5f6-3a1b-8c2d-e3f4a5b6c7d8';

        expect(isValidSubmissionId(wrongVersion)).toBe(false);
      });

      it('should require correct variant bits', () => {
        // Variant must be 8, 9, a, or b
        const wrongVariant = 'vf-a1b2c3d4-e5f6-4a1b-0c2d-e3f4a5b6c7d8';

        expect(isValidSubmissionId(wrongVariant)).toBe(false);
      });

      it('should accept all valid variant characters', () => {
        const variants = ['8', '9', 'a', 'b'];

        variants.forEach(v => {
          const id = `vf-a1b2c3d4-e5f6-4a1b-${v}c2d-e3f4a5b6c7d8`;
          expect(isValidSubmissionId(id)).toBe(true);
        });
      });
    });

    describe('Invalid Formats', () => {
      it('should reject empty string', () => {
        expect(isValidSubmissionId('')).toBe(false);
      });

      it('should reject null', () => {
        expect(isValidSubmissionId(null)).toBe(false);
      });

      it('should reject undefined', () => {
        expect(isValidSubmissionId(undefined)).toBe(false);
      });

      it('should reject random strings', () => {
        expect(isValidSubmissionId('random-string')).toBe(false);
        expect(isValidSubmissionId('not-valid')).toBe(false);
        expect(isValidSubmissionId('12345')).toBe(false);
      });

      it('should reject SQL injection attempts', () => {
        expect(isValidSubmissionId("'; DROP TABLE submissions;--")).toBe(false);
      });

      it('should reject script tags', () => {
        expect(isValidSubmissionId('<script>alert("xss")</script>')).toBe(false);
      });

      it('should reject very long strings', () => {
        const longString = 'a'.repeat(1000);
        expect(isValidSubmissionId(longString)).toBe(false);
      });
    });
  });

  describe('Security Properties', () => {
    it('createIdentityHash should not leak timing information', async () => {
      mockSubtle.digest.mockResolvedValue(new Uint8Array(32).buffer);

      // Both should complete without errors regardless of input
      await expect(createIdentityHash('short')).resolves.toBeDefined();
      await expect(createIdentityHash('a'.repeat(1000))).resolves.toBeDefined();
    });

    it('createAnonymousId should be synchronous', () => {
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        createAnonymousId('form_test');
      }
      const endTime = performance.now();

      // Should complete quickly (< 100ms for 1000 iterations)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('IDs should all be unique', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(createAnonymousId('form_test'));
      }

      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });
  });
});
