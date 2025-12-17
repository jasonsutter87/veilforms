import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { TextEncoder } from 'util';

// Set required environment variable
process.env.JWT_SECRET = 'test-secret-key-for-testing';

// Polyfill TextEncoder
global.TextEncoder = TextEncoder;

// Mock @netlify/blobs before importing
const mockStore = {
  get: jest.fn(),
  getJSON: jest.fn(),
  setJSON: jest.fn(),
  delete: jest.fn(),
  list: jest.fn()
};

jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: jest.fn(() => mockStore)
}));

// Mock crypto.subtle for token hashing
const originalCrypto = global.crypto;
global.crypto = {
  ...originalCrypto,
  subtle: {
    ...originalCrypto?.subtle,
    digest: jest.fn(async (algorithm, data) => {
      // Return a consistent mock hash
      const mockHash = new Uint8Array(32).fill(42);
      return mockHash.buffer;
    })
  },
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

// Mock jsonwebtoken
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn()
  }
}));

// Import mocks
const jwtMock = (await import('jsonwebtoken')).default;

// Import auth module after mocks
const { verifyToken, authenticateRequest, revokeToken } = await import('../auth.js');

describe('Auth Module with Token Blocklist Integration', () => {
  const JWT_SECRET = 'test-secret';
  const mockPayload = { userId: 'user_123', email: 'test@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.get.mockResolvedValue(null); // Default: token not revoked
  });

  describe('verifyToken with blocklist', () => {
    it('should return decoded payload for valid non-revoked token', async () => {
      jwtMock.verify.mockReturnValue(mockPayload);
      mockStore.get.mockResolvedValue(null); // Not revoked

      const result = await verifyToken('valid_token');

      expect(jwtMock.verify).toHaveBeenCalledWith(
        'valid_token',
        expect.any(String),
        expect.objectContaining({
          algorithms: ['HS256'],
          issuer: 'veilforms',
          audience: 'veilforms-api'
        })
      );
      expect(mockStore.get).toHaveBeenCalled();
      expect(result).toEqual(mockPayload);
    });

    it('should return null for revoked token', async () => {
      jwtMock.verify.mockReturnValue(mockPayload);
      mockStore.get.mockResolvedValue(JSON.stringify({
        revokedAt: new Date().toISOString()
      }));

      const result = await verifyToken('revoked_token');

      expect(jwtMock.verify).toHaveBeenCalled();
      expect(mockStore.get).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for invalid token signature', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await verifyToken('invalid_token');

      expect(result).toBeNull();
      // Blocklist should not be checked if JWT verification fails
    });

    it('should return null for expired token', async () => {
      jwtMock.verify.mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = await verifyToken('expired_token');

      expect(result).toBeNull();
    });

    it('should handle blocklist check errors gracefully', async () => {
      jwtMock.verify.mockReturnValue(mockPayload);
      mockStore.get.mockRejectedValue(new Error('Blocklist error'));

      // Should fail open - allow the token if blocklist is unavailable
      const result = await verifyToken('valid_token');

      expect(result).toEqual(mockPayload);
    });
  });

  describe('authenticateRequest with blocklist', () => {
    it('should return user for valid non-revoked token', async () => {
      jwtMock.verify.mockReturnValue(mockPayload);
      mockStore.get.mockResolvedValue(null);

      const req = {
        headers: new Map([['authorization', 'Bearer valid_token']])
      };

      const result = await authenticateRequest(req);

      expect(result).toEqual({ user: mockPayload });
    });

    it('should return error for revoked token', async () => {
      jwtMock.verify.mockReturnValue(mockPayload);
      mockStore.get.mockResolvedValue(JSON.stringify({
        revokedAt: new Date().toISOString()
      }));

      const req = {
        headers: new Map([['authorization', 'Bearer revoked_token']])
      };

      const result = await authenticateRequest(req);

      expect(result).toEqual({ error: 'Invalid token', status: 401 });
    });

    it('should return error for missing token', async () => {
      const req = {
        headers: new Map()
      };

      const result = await authenticateRequest(req);

      expect(result).toEqual({ error: 'No token provided', status: 401 });
      expect(mockStore.get).not.toHaveBeenCalled();
    });

    it('should return error for invalid token format', async () => {
      const req = {
        headers: new Map([['authorization', 'InvalidFormat']])
      };

      const result = await authenticateRequest(req);

      expect(result).toEqual({ error: 'No token provided', status: 401 });
    });
  });

  describe('revokeToken', () => {
    it('should revoke a valid token', async () => {
      const mockToken = jwt.sign(mockPayload, JWT_SECRET, { expiresIn: '24h' });

      // Mock decode to return expiry
      const futureExp = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      jwtMock.decode.mockReturnValue({ ...mockPayload, exp: futureExp });

      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await revokeToken(mockToken);

      expect(result.success).toBe(true);
      expect(mockStore.setJSON).toHaveBeenCalled();
    });

    it('should handle revocation errors', async () => {
      const mockToken = jwt.sign(mockPayload, JWT_SECRET, { expiresIn: '24h' });

      const futureExp = Math.floor(Date.now() / 1000) + 86400;
      jwtMock.decode.mockReturnValue({ ...mockPayload, exp: futureExp });

      mockStore.setJSON.mockRejectedValue(new Error('Storage error'));

      const result = await revokeToken(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });
  });

  describe('Token lifecycle', () => {
    it('should reject token after revocation', async () => {
      const token = 'test_token_123';
      const futureExp = Math.floor(Date.now() / 1000) + 86400;

      // Setup: token is initially valid
      jwtMock.verify.mockReturnValue(mockPayload);
      jwtMock.decode.mockReturnValue({ ...mockPayload, exp: futureExp });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      // Step 1: Verify token works
      const result1 = await verifyToken(token);
      expect(result1).toEqual(mockPayload);

      // Step 2: Revoke token
      await revokeToken(token);

      // Step 3: Mock that token is now in blocklist
      mockStore.get.mockResolvedValue(JSON.stringify({
        revokedAt: new Date().toISOString()
      }));

      // Step 4: Verify token is now rejected
      const result2 = await verifyToken(token);
      expect(result2).toBeNull();
    });
  });
});
