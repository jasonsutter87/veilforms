/**
 * API Integration Tests - Auth Routes
 * Tests for /api/auth/* endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as loginPOST } from '../auth/login/route';
import { POST as registerPOST } from '../auth/register/route';
import { POST as logoutPOST } from '../auth/logout/route';
import { createMockRequest, createAuthenticatedRequest, getResponseJson } from '../../../../__tests__/helpers/api.helper';
import { createTestUser } from '../../../../__tests__/factories/user.factory';
import * as storage from '@/lib/storage';
import * as auth from '@/lib/auth';
import * as rateLimit from '@/lib/rate-limit';
import * as emailRateLimit from '@/lib/email-rate-limit';
import * as email from '@/lib/email';

// Mock all external dependencies
vi.mock('@/lib/storage');
vi.mock('@/lib/rate-limit');
vi.mock('@/lib/email-rate-limit');
vi.mock('@/lib/email');
vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: () => true,
}));

describe('Auth API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock rate limiting to always allow by default
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    });

    vi.mocked(rateLimit.getRateLimitHeaders).mockReturnValue(new Headers());
    vi.mocked(rateLimit.isAccountLocked).mockResolvedValue({
      locked: false,
      remainingMinutes: 0,
    });
    vi.mocked(rateLimit.recordFailedAttempt).mockResolvedValue({
      count: 1,
      firstAttempt: Date.now(),
    });
    vi.mocked(rateLimit.clearFailedAttempts).mockResolvedValue(true);

    // Mock email rate limiting
    vi.mocked(emailRateLimit.checkEmailRateLimit).mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 3600000,
    });

    vi.mocked(emailRateLimit.getEmailRateLimitHeaders).mockReturnValue(new Headers());

    // Mock email sending
    vi.mocked(email.sendEmailVerification).mockResolvedValue(undefined);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const testUser = createTestUser({ email: 'newuser@example.com' });

      vi.mocked(storage.getUser).mockResolvedValue(null);
      vi.mocked(storage.createUser).mockResolvedValue(testUser);
      vi.mocked(storage.createEmailVerificationToken).mockResolvedValue({
        email: testUser.email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const req = createMockRequest('POST', '/api/auth/register', {
        body: {
          email: 'newuser@example.com',
          password: 'SecurePassword123',
        },
      });

      const response = await registerPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        success: true,
        token: expect.any(String),
        user: {
          id: testUser.id,
          email: testUser.email,
          emailVerified: false,
        },
      });
      expect(storage.createUser).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.any(String)
      );
    });

    it('should reject registration with duplicate email', async () => {
      const existingUser = createTestUser({ email: 'existing@example.com' });
      vi.mocked(storage.getUser).mockResolvedValue(existingUser);

      const req = createMockRequest('POST', '/api/auth/register', {
        body: {
          email: 'existing@example.com',
          password: 'SecurePassword123',
        },
      });

      const response = await registerPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(409);
      expect(data).toMatchObject({
        error: 'Email already registered',
      });
      expect(storage.createUser).not.toHaveBeenCalled();
    });

    it('should reject registration with weak password', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const req = createMockRequest('POST', '/api/auth/register', {
        body: {
          email: 'newuser@example.com',
          password: 'weak',
        },
      });

      const response = await registerPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: 'Password does not meet requirements',
        details: expect.arrayContaining([
          expect.stringContaining('at least 12 characters'),
        ]),
      });
      expect(storage.createUser).not.toHaveBeenCalled();
    });

    it('should reject registration with invalid email format', async () => {
      const req = createMockRequest('POST', '/api/auth/register', {
        body: {
          email: 'not-an-email',
          password: 'SecurePassword123',
        },
      });

      const response = await registerPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: 'Invalid email format',
      });
    });

    it('should reject registration with missing fields', async () => {
      const req = createMockRequest('POST', '/api/auth/register', {
        body: {
          email: 'test@example.com',
        },
      });

      const response = await registerPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: 'Email and password required',
      });
    });

    it('should respect email rate limiting', async () => {
      vi.mocked(emailRateLimit.checkEmailRateLimit).mockResolvedValue({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: Date.now() + 3600000,
        message: 'Too many verification emails sent',
        retryAfter: 3600,
      });

      const req = createMockRequest('POST', '/api/auth/register', {
        body: {
          email: 'test@example.com',
          password: 'SecurePassword123',
        },
      });

      const response = await registerPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(429);
      expect(data).toMatchObject({
        error: expect.stringContaining('Too many'),
        retryAfter: expect.any(Number),
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        emailVerified: true,
      });

      vi.mocked(storage.getUser).mockResolvedValue(testUser);
      vi.spyOn(auth, 'verifyPassword').mockResolvedValue(true);

      const req = createMockRequest('POST', '/api/auth/login', {
        body: {
          email: 'test@example.com',
          password: 'TestPassword123',
        },
      });

      const response = await loginPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        token: expect.any(String),
        user: {
          id: testUser.id,
          email: testUser.email,
        },
      });
      expect(rateLimit.clearFailedAttempts).toHaveBeenCalledWith(testUser.email);
    });

    it('should reject login with wrong password', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });
      vi.mocked(storage.getUser).mockResolvedValue(testUser);
      vi.spyOn(auth, 'verifyPassword').mockResolvedValue(false);

      const req = createMockRequest('POST', '/api/auth/login', {
        body: {
          email: 'test@example.com',
          password: 'WrongPassword',
        },
      });

      const response = await loginPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data).toMatchObject({
        error: 'Invalid email or password',
      });
      expect(rateLimit.recordFailedAttempt).toHaveBeenCalledWith('test@example.com');
    });

    it('should reject login with non-existent user', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const req = createMockRequest('POST', '/api/auth/login', {
        body: {
          email: 'nonexistent@example.com',
          password: 'TestPassword123',
        },
      });

      const response = await loginPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid');
      expect(rateLimit.recordFailedAttempt).toHaveBeenCalled();
    });

    it('should reject login when account is locked', async () => {
      vi.mocked(rateLimit.isAccountLocked).mockResolvedValue({
        locked: true,
        remainingMinutes: 15,
      });

      const req = createMockRequest('POST', '/api/auth/login', {
        body: {
          email: 'test@example.com',
          password: 'TestPassword123',
        },
      });

      const response = await loginPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(423);
      expect(data).toMatchObject({
        error: expect.stringContaining('locked'),
        lockedMinutes: 15,
      });
    });

    it('should reject login for OAuth users', async () => {
      const oauthUser = createTestUser({
        email: 'oauth@example.com',
        oauthProvider: 'google',
      });
      oauthUser.passwordHash = null;

      vi.mocked(storage.getUser).mockResolvedValue(oauthUser);

      const req = createMockRequest('POST', '/api/auth/login', {
        body: {
          email: 'oauth@example.com',
          password: 'TestPassword123',
        },
      });

      const response = await loginPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data).toMatchObject({
        error: 'Please sign in with your OAuth provider',
      });
    });

    it('should reject login with missing fields', async () => {
      const req = createMockRequest('POST', '/api/auth/login', {
        body: {
          email: 'test@example.com',
        },
      });

      const response = await loginPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: 'Email and password are required',
      });
    });

    it('should respect rate limiting', async () => {
      vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
        allowed: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      });

      const req = createMockRequest('POST', '/api/auth/login', {
        body: {
          email: 'test@example.com',
          password: 'TestPassword123',
        },
      });

      const response = await loginPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(429);
      expect(data).toMatchObject({
        error: expect.stringContaining('Too many requests'),
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      vi.spyOn(auth, 'verifyToken').mockResolvedValue({
        userId: testUser.id,
        email: testUser.email,
      });

      vi.spyOn(auth, 'revokeToken').mockResolvedValue({
        success: true,
        message: 'Token revoked',
      });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/auth/logout',
        testUser.id,
        testUser.email
      );

      const response = await logoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        message: 'Logged out successfully',
      });
      expect(auth.revokeToken).toHaveBeenCalled();
    });

    it('should reject logout without token', async () => {
      const req = createMockRequest('POST', '/api/auth/logout');

      const response = await logoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data).toMatchObject({
        error: 'No token provided',
      });
    });

    it('should reject logout with invalid token', async () => {
      vi.spyOn(auth, 'verifyToken').mockResolvedValue(null);

      const req = createMockRequest('POST', '/api/auth/logout', {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const response = await logoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data).toMatchObject({
        error: 'Invalid token',
      });
    });

    it('should handle revocation errors gracefully', async () => {
      const testUser = createTestUser({ email: 'test@example.com' });

      vi.spyOn(auth, 'verifyToken').mockResolvedValue({
        userId: testUser.id,
        email: testUser.email,
      });

      vi.spyOn(auth, 'revokeToken').mockResolvedValue({
        success: false,
        error: 'Revocation failed',
      });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/auth/logout',
        testUser.id,
        testUser.email
      );

      const response = await logoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
