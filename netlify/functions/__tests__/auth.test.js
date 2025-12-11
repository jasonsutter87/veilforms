import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Mock modules before importing auth
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: jest.fn(),
    verify: jest.fn()
  }
}));

jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    hash: jest.fn(),
    compare: jest.fn()
  }
}));

// Import after mocking
const jwtMock = (await import('jsonwebtoken')).default;
const bcryptMock = (await import('bcryptjs')).default;

// Now import the auth module
const {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getTokenFromHeader,
  authenticateRequest,
  generateApiKey
} = await import('../lib/auth.js');

describe('Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password with salt rounds of 10', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashed_password_value';
      bcryptMock.hash.mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(bcryptMock.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should handle empty password', async () => {
      bcryptMock.hash.mockResolvedValue('hashed_empty');

      const result = await hashPassword('');

      expect(bcryptMock.hash).toHaveBeenCalledWith('', 10);
      expect(result).toBe('hashed_empty');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password', async () => {
      bcryptMock.compare.mockResolvedValue(true);

      const result = await verifyPassword('password123', 'hashedPassword');

      expect(bcryptMock.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      bcryptMock.compare.mockResolvedValue(false);

      const result = await verifyPassword('wrongPassword', 'hashedPassword');

      expect(bcryptMock.compare).toHaveBeenCalledWith('wrongPassword', 'hashedPassword');
      expect(result).toBe(false);
    });
  });

  describe('createToken', () => {
    it('should create a JWT token with payload and expiry', () => {
      const payload = { userId: 'user_123', email: 'test@example.com' };
      const expectedToken = 'jwt_token_value';
      jwtMock.sign.mockReturnValue(expectedToken);

      const result = createToken(payload);

      expect(jwtMock.sign).toHaveBeenCalledWith(
        payload,
        expect.any(String),
        { expiresIn: '7d' }
      );
      expect(result).toBe(expectedToken);
    });

    it('should include user data in token payload', () => {
      const payload = {
        userId: 'user_456',
        email: 'user@test.com',
        subscription: 'pro'
      };
      jwtMock.sign.mockReturnValue('token');

      createToken(payload);

      expect(jwtMock.sign).toHaveBeenCalledWith(
        payload,
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('verifyToken', () => {
    it('should return decoded payload for valid token', () => {
      const decodedPayload = { userId: 'user_123', email: 'test@example.com' };
      jwtMock.verify.mockReturnValue(decodedPayload);

      const result = verifyToken('valid_token');

      expect(jwtMock.verify).toHaveBeenCalledWith('valid_token', expect.any(String));
      expect(result).toEqual(decodedPayload);
    });

    it('should return null for invalid token', () => {
      jwtMock.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = verifyToken('invalid_token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      jwtMock.verify.mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = verifyToken('expired_token');

      expect(result).toBeNull();
    });
  });

  describe('getTokenFromHeader', () => {
    it('should extract token from Bearer authorization header', () => {
      const headers = new Map([['authorization', 'Bearer my_jwt_token']]);

      const result = getTokenFromHeader(headers);

      expect(result).toBe('my_jwt_token');
    });

    it('should handle Authorization header with capital A', () => {
      const headers = new Map([['Authorization', 'Bearer token_value']]);

      const result = getTokenFromHeader(headers);

      expect(result).toBe('token_value');
    });

    it('should return null if no authorization header', () => {
      const headers = new Map();

      const result = getTokenFromHeader(headers);

      expect(result).toBeNull();
    });

    it('should return null for non-Bearer auth type', () => {
      const headers = new Map([['authorization', 'Basic some_credentials']]);

      const result = getTokenFromHeader(headers);

      expect(result).toBeNull();
    });

    it('should return null for malformed header', () => {
      const headers = new Map([['authorization', 'Bearer']]);

      const result = getTokenFromHeader(headers);

      expect(result).toBeNull();
    });

    it('should return null for header with extra spaces', () => {
      const headers = new Map([['authorization', 'Bearer token extra']]);

      const result = getTokenFromHeader(headers);

      expect(result).toBeNull();
    });
  });

  describe('authenticateRequest', () => {
    it('should return user for valid token', () => {
      const decodedUser = { userId: 'user_123', email: 'test@example.com' };
      jwtMock.verify.mockReturnValue(decodedUser);

      const req = {
        headers: new Map([['authorization', 'Bearer valid_token']])
      };

      const result = authenticateRequest(req);

      expect(result).toEqual({ user: decodedUser });
    });

    it('should return error for missing token', () => {
      const req = {
        headers: new Map()
      };

      const result = authenticateRequest(req);

      expect(result).toEqual({ error: 'No token provided', status: 401 });
    });

    it('should return error for invalid token', () => {
      jwtMock.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const req = {
        headers: new Map([['authorization', 'Bearer invalid_token']])
      };

      const result = authenticateRequest(req);

      expect(result).toEqual({ error: 'Invalid token', status: 401 });
    });
  });

  describe('generateApiKey', () => {
    it('should generate a key with vf_test_ prefix in non-production', () => {
      // Mock crypto.getRandomValues
      const originalCrypto = global.crypto;
      global.crypto = {
        getRandomValues: jest.fn((arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        })
      };

      const key = generateApiKey();

      expect(key).toMatch(/^vf_test_[a-f0-9]{48}$/);

      global.crypto = originalCrypto;
    });

    it('should generate unique keys', () => {
      const originalCrypto = global.crypto;
      let callCount = 0;
      global.crypto = {
        getRandomValues: jest.fn((arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = (callCount * 10 + i) % 256;
          }
          callCount++;
          return arr;
        })
      };

      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);

      global.crypto = originalCrypto;
    });
  });
});
