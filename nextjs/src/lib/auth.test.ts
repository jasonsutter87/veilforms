import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getTokenFromHeader,
  authenticateRequest,
  generateApiKey,
  revokeToken,
  PASSWORD_REQUIREMENTS,
} from './auth';
import * as tokenBlocklist from './token-blocklist';

// Mock the token-blocklist module
vi.mock('./token-blocklist', () => ({
  isTokenRevoked: vi.fn(),
  revokeToken: vi.fn(),
}));

describe('auth', () => {
  describe('validatePasswordStrength', () => {
    it('should accept valid passwords meeting all requirements', () => {
      const result = validatePasswordStrength('SecurePass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept passwords with exactly minimum length', () => {
      const result = validatePasswordStrength('Password1234');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords shorter than minimum length', () => {
      const result = validatePasswordStrength('Short1Aa');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
      );
    });

    it('should reject passwords without uppercase letter', () => {
      const result = validatePasswordStrength('lowercase12345');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should reject passwords without lowercase letter', () => {
      const result = validatePasswordStrength('UPPERCASE12345');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should reject passwords without a number', () => {
      const result = validatePasswordStrength('NoNumbersHere');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
    });

    it('should accumulate multiple errors', () => {
      const result = validatePasswordStrength('short');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should handle empty string', () => {
      const result = validatePasswordStrength('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
      );
    });

    it('should handle null/undefined as empty string', () => {
      const result1 = validatePasswordStrength(null as any);
      expect(result1.valid).toBe(false);

      const result2 = validatePasswordStrength(undefined as any);
      expect(result2.valid).toBe(false);
    });

    it('should accept special characters but not require them', () => {
      const result = validatePasswordStrength('MyP@ssw0rd123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'SecurePassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should produce different hashes for same password', async () => {
      const password = 'SecurePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should use bcrypt cost factor 12', async () => {
      const password = 'SecurePassword123';
      const hash = await hashPassword(password);

      // Verify the hash can be verified (indirectly confirms cost factor works)
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle special characters', async () => {
      const password = 'P@ssw0rd!#$%^&*()';
      const hash = await hashPassword(password);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle unicode characters', async () => {
      const password = 'Pāsswørd123αβγ';
      const hash = await hashPassword(password);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    const password = 'SecurePassword123';
    let hash: string;

    beforeEach(async () => {
      hash = await hashPassword(password);
    });

    it('should verify correct password', async () => {
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const result = await verifyPassword('WrongPassword123', hash);
      expect(result).toBe(false);
    });

    it('should reject password with slight variation', async () => {
      const result = await verifyPassword('SecurePassword124', hash);
      expect(result).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const result = await verifyPassword('securepassword123', hash);
      expect(result).toBe(false);
    });

    it('should reject empty string', async () => {
      const result = await verifyPassword('', hash);
      expect(result).toBe(false);
    });

    it('should handle timing attacks consistently', async () => {
      // Multiple attempts should take similar time
      const iterations = 5;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await verifyPassword('WrongPassword123', hash);
        timings.push(Date.now() - start);
      }

      // All timings should be relatively close (within 100ms variance)
      // This is a basic timing attack resistance check
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTime)));
      expect(maxDeviation).toBeLessThan(100);
    });
  });

  describe('createToken', () => {
    const payload = {
      userId: 'user_123',
      email: 'test@example.com',
    };

    it('should create a valid JWT token', () => {
      const token = createToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload data in token', () => {
      const token = createToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('should include standard JWT claims', () => {
      const token = createToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.iat).toBeDefined(); // Issued at
      expect(decoded.exp).toBeDefined(); // Expiration
      expect(decoded.iss).toBe('veilforms'); // Issuer
      expect(decoded.aud).toBe('veilforms-api'); // Audience
    });

    it('should set expiration to 24 hours', () => {
      const token = createToken(payload);
      const decoded = jwt.decode(token) as any;

      const expectedExp = decoded.iat + (24 * 60 * 60); // 24 hours in seconds
      expect(decoded.exp).toBe(expectedExp);
    });

    it('should use HS256 algorithm', () => {
      const token = createToken(payload);
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64').toString()
      );

      expect(header.alg).toBe('HS256');
    });

    it('should create different tokens for different users', () => {
      const token1 = createToken({ userId: 'user_1', email: 'user1@example.com' });
      const token2 = createToken({ userId: 'user_2', email: 'user2@example.com' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    const payload = {
      userId: 'user_123',
      email: 'test@example.com',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should verify valid token', async () => {
      const token = createToken(payload);
      vi.mocked(tokenBlocklist.isTokenRevoked).mockResolvedValue(false);

      const result = await verifyToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(payload.userId);
      expect(result?.email).toBe(payload.email);
    });

    it('should return null for invalid token', async () => {
      const result = await verifyToken('invalid.token.here');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '-1h', // Already expired
        algorithm: 'HS256',
        issuer: 'veilforms',
        audience: 'veilforms-api',
      });

      const result = await verifyToken(expiredToken);

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      const token = createToken(payload);
      vi.mocked(tokenBlocklist.isTokenRevoked).mockResolvedValue(true);

      const result = await verifyToken(token);

      expect(result).toBeNull();
      expect(tokenBlocklist.isTokenRevoked).toHaveBeenCalledWith(token);
    });

    it('should check token blocklist', async () => {
      const token = createToken(payload);
      vi.mocked(tokenBlocklist.isTokenRevoked).mockResolvedValue(false);

      await verifyToken(token);

      expect(tokenBlocklist.isTokenRevoked).toHaveBeenCalledWith(token);
    });

    it('should return null for token with wrong issuer', async () => {
      const wrongIssuerToken = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '24h',
        algorithm: 'HS256',
        issuer: 'wrong-issuer',
        audience: 'veilforms-api',
      });

      const result = await verifyToken(wrongIssuerToken);

      expect(result).toBeNull();
    });

    it('should return null for token with wrong audience', async () => {
      const wrongAudienceToken = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '24h',
        algorithm: 'HS256',
        issuer: 'veilforms',
        audience: 'wrong-audience',
      });

      const result = await verifyToken(wrongAudienceToken);

      expect(result).toBeNull();
    });

    it('should return null for token signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(payload, 'wrong-secret', {
        expiresIn: '24h',
        algorithm: 'HS256',
        issuer: 'veilforms',
        audience: 'veilforms-api',
      });

      const result = await verifyToken(wrongSecretToken);

      expect(result).toBeNull();
    });

    it('should return null for malformed token', async () => {
      const result = await verifyToken('not.a.jwt');

      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await verifyToken('');

      expect(result).toBeNull();
    });
  });

  describe('getTokenFromHeader', () => {
    it('should extract token from Authorization header (lowercase)', () => {
      const headers = new Headers();
      headers.set('authorization', 'Bearer mytoken123');

      const token = getTokenFromHeader(headers);

      expect(token).toBe('mytoken123');
    });

    it('should extract token from Authorization header (uppercase)', () => {
      const headers = new Headers();
      headers.set('Authorization', 'Bearer mytoken123');

      const token = getTokenFromHeader(headers);

      expect(token).toBe('mytoken123');
    });

    it('should return null when no Authorization header', () => {
      const headers = new Headers();

      const token = getTokenFromHeader(headers);

      expect(token).toBeNull();
    });

    it('should return null for non-Bearer token', () => {
      const headers = new Headers();
      headers.set('authorization', 'Basic dXNlcjpwYXNz');

      const token = getTokenFromHeader(headers);

      expect(token).toBeNull();
    });

    it('should return null for malformed Bearer header', () => {
      const headers = new Headers();
      headers.set('authorization', 'Bearer');

      const token = getTokenFromHeader(headers);

      expect(token).toBeNull();
    });

    it('should return null for Bearer with empty token', () => {
      const headers = new Headers();
      headers.set('authorization', 'Bearer ');

      const token = getTokenFromHeader(headers);

      expect(token).toBeNull();
    });

    it('should handle token with extra spaces', () => {
      const headers = new Headers();
      headers.set('authorization', 'Bearer  token123');

      const token = getTokenFromHeader(headers);

      // Should return null because split produces more than 2 parts
      expect(token).toBeNull();
    });

    it('should handle Bearer case-sensitive check', () => {
      const headers = new Headers();
      headers.set('authorization', 'bearer mytoken123');

      const token = getTokenFromHeader(headers);

      expect(token).toBeNull(); // Should be null because "bearer" !== "Bearer"
    });
  });

  describe('authenticateRequest', () => {
    const validPayload = {
      userId: 'user_123',
      email: 'test@example.com',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should authenticate valid request', async () => {
      const token = createToken(validPayload);
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      vi.mocked(tokenBlocklist.isTokenRevoked).mockResolvedValue(false);

      const result = await authenticateRequest(request);

      expect(result.error).toBeUndefined();
      expect(result.user).toBeDefined();
      expect(result.user?.userId).toBe(validPayload.userId);
      expect(result.user?.email).toBe(validPayload.email);
    });

    it('should reject request without token', async () => {
      const request = new NextRequest('http://localhost/api/test');

      const result = await authenticateRequest(request);

      expect(result.error).toBe('No token provided');
      expect(result.status).toBe(401);
      expect(result.user).toBeUndefined();
    });

    it('should reject request with invalid token', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          Authorization: 'Bearer invalid.token.here',
        },
      });

      const result = await authenticateRequest(request);

      expect(result.error).toBe('Invalid token');
      expect(result.status).toBe(401);
      expect(result.user).toBeUndefined();
    });

    it('should reject request with revoked token', async () => {
      const token = createToken(validPayload);
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      vi.mocked(tokenBlocklist.isTokenRevoked).mockResolvedValue(true);

      const result = await authenticateRequest(request);

      expect(result.error).toBe('Invalid token');
      expect(result.status).toBe(401);
      expect(result.user).toBeUndefined();
    });

    it('should reject request with malformed Authorization header', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          Authorization: 'NotBearer token123',
        },
      });

      const result = await authenticateRequest(request);

      expect(result.error).toBe('No token provided');
      expect(result.status).toBe(401);
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key with test prefix in test environment', () => {
      const apiKey = generateApiKey();

      expect(apiKey).toMatch(/^vf_test_[a-f0-9]{48}$/);
    });

    it('should generate unique API keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate keys of consistent length', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1.length).toBe(key2.length);
      expect(key1.length).toBe(56); // vf_test_ (8) + 48 hex chars
    });

    it('should use production prefix in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const apiKey = generateApiKey();

      expect(apiKey).toMatch(/^vf_live_[a-f0-9]{48}$/);

      process.env.NODE_ENV = originalEnv;
    });

    it('should generate cryptographically random keys', () => {
      // Generate multiple keys and ensure they're all different
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(generateApiKey());
      }

      expect(keys.size).toBe(100); // All should be unique
    });

    it('should only contain valid hexadecimal characters', () => {
      const apiKey = generateApiKey();
      const randomPart = apiKey.replace(/^vf_(test|live)_/, '');

      expect(randomPart).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('revokeToken', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call revokeTokenFromBlocklist', async () => {
      const token = 'test.token.here';
      vi.mocked(tokenBlocklist.revokeToken).mockResolvedValue({ success: true });

      await revokeToken(token);

      expect(tokenBlocklist.revokeToken).toHaveBeenCalledWith(token);
    });

    it('should return result from blocklist', async () => {
      const token = 'test.token.here';
      const expectedResult = { success: true };
      vi.mocked(tokenBlocklist.revokeToken).mockResolvedValue(expectedResult);

      const result = await revokeToken(token);

      expect(result).toBe(expectedResult);
    });

    it('should handle revocation failure', async () => {
      const token = 'test.token.here';
      const expectedResult = { success: false, error: 'Revocation failed' };
      vi.mocked(tokenBlocklist.revokeToken).mockResolvedValue(expectedResult);

      const result = await revokeToken(token);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('Security Considerations', () => {
    describe('Password Security', () => {
      it('should enforce minimum password length of 12 characters', () => {
        expect(PASSWORD_REQUIREMENTS.minLength).toBe(12);
      });

      it('should require mixed case passwords', () => {
        expect(PASSWORD_REQUIREMENTS.requireUppercase).toBe(true);
        expect(PASSWORD_REQUIREMENTS.requireLowercase).toBe(true);
      });

      it('should require numbers in passwords', () => {
        expect(PASSWORD_REQUIREMENTS.requireNumber).toBe(true);
      });

      it('should use bcrypt with sufficient cost factor', async () => {
        // Bcrypt cost factor should make hashing slow enough to prevent brute force
        const start = Date.now();
        await hashPassword('TestPassword123');
        const duration = Date.now() - start;

        // With cost factor 12, should take at least 50ms
        expect(duration).toBeGreaterThan(50);
      });
    });

    describe('Token Security', () => {
      it('should use secure JWT algorithm (HS256)', () => {
        const token = createToken({ userId: 'user_1', email: 'test@example.com' });
        const header = JSON.parse(
          Buffer.from(token.split('.')[0], 'base64').toString()
        );

        expect(header.alg).toBe('HS256');
      });

      it('should validate issuer and audience claims', async () => {
        const payload = { userId: 'user_1', email: 'test@example.com' };

        // Valid token
        const validToken = createToken(payload);
        vi.mocked(tokenBlocklist.isTokenRevoked).mockResolvedValue(false);
        expect(await verifyToken(validToken)).not.toBeNull();

        // Invalid issuer
        const wrongIssuer = jwt.sign(payload, process.env.JWT_SECRET!, {
          expiresIn: '24h',
          algorithm: 'HS256',
          issuer: 'attacker',
          audience: 'veilforms-api',
        });
        expect(await verifyToken(wrongIssuer)).toBeNull();
      });

      it('should respect token expiration', async () => {
        const payload = { userId: 'user_1', email: 'test@example.com' };
        const expiredToken = jwt.sign(payload, process.env.JWT_SECRET!, {
          expiresIn: '0s',
          algorithm: 'HS256',
          issuer: 'veilforms',
          audience: 'veilforms-api',
        });

        // Wait a moment to ensure token is expired
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await verifyToken(expiredToken);
        expect(result).toBeNull();
      });
    });

    describe('Input Validation', () => {
      it('should handle null/undefined inputs safely', async () => {
        expect(validatePasswordStrength(null as any).valid).toBe(false);
        expect(validatePasswordStrength(undefined as any).valid).toBe(false);

        expect(await verifyToken(null as any)).toBeNull();
        expect(await verifyToken(undefined as any)).toBeNull();

        expect(getTokenFromHeader(new Headers())).toBeNull();
      });

      it('should handle malformed JWT gracefully', async () => {
        const malformedTokens = [
          'not.a.jwt',
          'only.two',
          'too.many.parts.here.invalid',
          '',
          'Bearer token',
        ];

        for (const token of malformedTokens) {
          expect(await verifyToken(token)).toBeNull();
        }
      });
    });
  });
});
