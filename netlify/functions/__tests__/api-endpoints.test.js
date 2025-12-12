import { jest } from '@jest/globals';

// Mock the lib modules
const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();
const mockCreateToken = jest.fn();
const mockVerifyToken = jest.fn();
const mockAuthenticateRequest = jest.fn();

const mockCreateUser = jest.fn();
const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockCreatePasswordResetToken = jest.fn();
const mockGetPasswordResetToken = jest.fn();
const mockDeletePasswordResetToken = jest.fn();
const mockCreateForm = jest.fn();
const mockGetForm = jest.fn();
const mockGetUserForms = jest.fn();

const mockSendWelcomeEmail = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

// Mock the imports
jest.unstable_mockModule('../lib/auth.js', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
  createToken: mockCreateToken,
  verifyToken: mockVerifyToken,
  authenticateRequest: mockAuthenticateRequest
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  createUser: mockCreateUser,
  getUser: mockGetUser,
  updateUser: mockUpdateUser,
  createPasswordResetToken: mockCreatePasswordResetToken,
  getPasswordResetToken: mockGetPasswordResetToken,
  deletePasswordResetToken: mockDeletePasswordResetToken,
  createForm: mockCreateForm,
  getForm: mockGetForm,
  getUserForms: mockGetUserForms
}));

jest.unstable_mockModule('../lib/email.js', () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail
}));

// Helper to create mock Request
function createMockRequest(method, body = null, headers = {}) {
  return {
    method,
    headers: new Map(Object.entries(headers)),
    json: jest.fn().mockResolvedValue(body)
  };
}

// Helper to parse Response
async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Auth Register Endpoint', () => {
    let handler;

    beforeEach(async () => {
      const module = await import('../auth-register.js');
      handler = module.default;
    });

    it('should return 204 for OPTIONS requests', async () => {
      const req = createMockRequest('OPTIONS');

      const response = await handler(req, {});

      expect(response.status).toBe(204);
    });

    it('should return 405 for non-POST requests', async () => {
      const req = createMockRequest('GET');

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(405);
      expect(body.error).toBe('Method not allowed');
    });

    it('should return 400 if email is missing', async () => {
      const req = createMockRequest('POST', { password: 'test1234' });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error).toBe('Email and password required');
    });

    it('should return 400 if password is missing', async () => {
      const req = createMockRequest('POST', { email: 'test@test.com' });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error).toBe('Email and password required');
    });

    it('should return 400 for invalid email format', async () => {
      const req = createMockRequest('POST', {
        email: 'invalid-email',
        password: 'password123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid email format');
    });

    it('should return 400 for short password', async () => {
      const req = createMockRequest('POST', {
        email: 'test@test.com',
        password: 'short'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error).toBe('Password must be at least 8 characters');
    });

    it('should return 409 if email already exists', async () => {
      mockGetUser.mockResolvedValue({ id: 'existing', email: 'test@test.com' });

      const req = createMockRequest('POST', {
        email: 'test@test.com',
        password: 'password123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(409);
      expect(body.error).toBe('Email already registered');
    });

    it('should create user and return token on success', async () => {
      mockGetUser.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('hashed_password');
      mockCreateUser.mockResolvedValue({
        id: 'user_123',
        email: 'new@test.com',
        subscription: 'free'
      });
      mockCreateToken.mockReturnValue('jwt_token_here');
      mockSendWelcomeEmail.mockResolvedValue();

      const req = createMockRequest('POST', {
        email: 'new@test.com',
        password: 'password123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.token).toBe('jwt_token_here');
      expect(body.user.email).toBe('new@test.com');
      expect(mockHashPassword).toHaveBeenCalledWith('password123');
      expect(mockCreateUser).toHaveBeenCalledWith('new@test.com', 'hashed_password');
    });

    it('should send welcome email asynchronously', async () => {
      mockGetUser.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('hash');
      mockCreateUser.mockResolvedValue({ id: '1', email: 'test@test.com', subscription: 'free' });
      mockCreateToken.mockReturnValue('token');
      mockSendWelcomeEmail.mockResolvedValue();

      const req = createMockRequest('POST', {
        email: 'test@test.com',
        password: 'password123'
      });

      await handler(req, {});

      expect(mockSendWelcomeEmail).toHaveBeenCalledWith('test@test.com');
    });

    it('should return 500 on internal error', async () => {
      mockGetUser.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest('POST', {
        email: 'test@test.com',
        password: 'password123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(500);
      expect(body.error).toBe('Registration failed');
    });
  });

  describe('Auth Login Endpoint', () => {
    let handler;

    beforeEach(async () => {
      const module = await import('../auth-login.js');
      handler = module.default;
    });

    it('should return 204 for OPTIONS requests', async () => {
      const req = createMockRequest('OPTIONS');

      const response = await handler(req, {});

      expect(response.status).toBe(204);
    });

    it('should return 405 for non-POST requests', async () => {
      const req = createMockRequest('GET');

      const response = await handler(req, {});

      expect(response.status).toBe(405);
    });

    it('should return 400 if credentials missing', async () => {
      const req = createMockRequest('POST', {});

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error).toBe('Email and password required');
    });

    it('should return 401 for non-existent user', async () => {
      mockGetUser.mockResolvedValue(null);

      const req = createMockRequest('POST', {
        email: 'notfound@test.com',
        password: 'password123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(401);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should return 401 for wrong password', async () => {
      mockGetUser.mockResolvedValue({
        id: 'user_1',
        email: 'test@test.com',
        passwordHash: 'correct_hash'
      });
      mockVerifyPassword.mockResolvedValue(false);

      const req = createMockRequest('POST', {
        email: 'test@test.com',
        password: 'wrongpassword'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(401);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should return token on successful login', async () => {
      mockGetUser.mockResolvedValue({
        id: 'user_123',
        email: 'valid@test.com',
        passwordHash: 'hash',
        subscription: 'pro'
      });
      mockVerifyPassword.mockResolvedValue(true);
      mockCreateToken.mockReturnValue('login_jwt_token');

      const req = createMockRequest('POST', {
        email: 'valid@test.com',
        password: 'correctpassword'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.token).toBe('login_jwt_token');
      expect(body.user.id).toBe('user_123');
      expect(body.user.subscription).toBe('pro');
    });

    it('should not expose password hash in response', async () => {
      mockGetUser.mockResolvedValue({
        id: 'user_1',
        email: 'test@test.com',
        passwordHash: 'secret_hash',
        subscription: 'free'
      });
      mockVerifyPassword.mockResolvedValue(true);
      mockCreateToken.mockReturnValue('token');

      const req = createMockRequest('POST', {
        email: 'test@test.com',
        password: 'password123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(body.user.passwordHash).toBeUndefined();
    });
  });

  describe('Auth Forgot Password Endpoint', () => {
    let handler;

    beforeEach(async () => {
      const module = await import('../auth-forgot.js');
      handler = module.default;
    });

    it('should return 204 for OPTIONS requests', async () => {
      const req = createMockRequest('OPTIONS');

      const response = await handler(req, {});

      expect(response.status).toBe(204);
    });

    it('should return 400 if email missing', async () => {
      const req = createMockRequest('POST', {});

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
    });

    it('should return success even for non-existent user (security)', async () => {
      mockGetUser.mockResolvedValue(null);

      const req = createMockRequest('POST', { email: 'nonexistent@test.com' });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      // Should not send email for non-existent user
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should create reset token for existing user', async () => {
      mockGetUser.mockResolvedValue({ id: 'user_1', email: 'exists@test.com' });
      mockCreatePasswordResetToken.mockResolvedValue({ expiresAt: new Date().toISOString() });
      mockSendPasswordResetEmail.mockResolvedValue();

      const req = createMockRequest('POST', { email: 'exists@test.com' });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(mockCreatePasswordResetToken).toHaveBeenCalled();
      expect(mockSendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('Auth Reset Password Endpoint', () => {
    let handler;

    beforeEach(async () => {
      const module = await import('../auth-reset.js');
      handler = module.default;
    });

    it('should return 400 if token or password missing', async () => {
      const req = createMockRequest('POST', { token: 'abc' });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid token', async () => {
      mockGetPasswordResetToken.mockResolvedValue(null);

      const req = createMockRequest('POST', {
        token: 'invalid_token',
        password: 'newpassword123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error).toContain('Invalid');
    });

    it('should reset password with valid token', async () => {
      mockGetPasswordResetToken.mockResolvedValue({
        email: 'user@test.com',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      });
      mockHashPassword.mockResolvedValue('new_hash');
      mockUpdateUser.mockResolvedValue({ id: 'user_1', email: 'user@test.com' });
      mockDeletePasswordResetToken.mockResolvedValue();

      const req = createMockRequest('POST', {
        token: 'valid_token',
        password: 'newpassword123'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith('user@test.com', {
        passwordHash: 'new_hash'
      });
      expect(mockDeletePasswordResetToken).toHaveBeenCalledWith('valid_token');
    });
  });

  describe('Forms Create Endpoint', () => {
    let handler;

    beforeEach(async () => {
      const module = await import('../forms-create.js');
      handler = module.default;
    });

    it('should return 401 without authentication', async () => {
      mockAuthenticateRequest.mockReturnValue({ error: 'No token', status: 401 });

      const req = createMockRequest('POST', { name: 'Test Form' });

      const response = await handler(req, {});

      expect(response.status).toBe(401);
    });

    it('should create form with authenticated user', async () => {
      mockAuthenticateRequest.mockReturnValue({
        user: { id: 'user_123', email: 'test@test.com' }
      });
      mockCreateForm.mockResolvedValue({
        id: 'form_abc',
        name: 'My Form',
        publicKey: { kty: 'RSA' }
      });

      const req = createMockRequest('POST', { name: 'My Form' }, {
        authorization: 'Bearer valid_token'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(201);
      expect(body.form.name).toBe('My Form');
      expect(mockCreateForm).toHaveBeenCalledWith('user_123', expect.objectContaining({
        name: 'My Form'
      }));
    });
  });

  describe('Forms List Endpoint', () => {
    let handler;

    beforeEach(async () => {
      const module = await import('../forms-list.js');
      handler = module.default;
    });

    it('should return 401 without authentication', async () => {
      mockAuthenticateRequest.mockReturnValue({ error: 'Invalid token', status: 401 });

      const req = createMockRequest('GET');

      const response = await handler(req, {});

      expect(response.status).toBe(401);
    });

    it('should return user forms when authenticated', async () => {
      mockAuthenticateRequest.mockReturnValue({
        user: { id: 'user_456', email: 'user@test.com' }
      });
      mockGetUserForms.mockResolvedValue([
        { id: 'form_1', name: 'Form 1' },
        { id: 'form_2', name: 'Form 2' }
      ]);

      const req = createMockRequest('GET', null, {
        authorization: 'Bearer token'
      });

      const response = await handler(req, {});
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.forms).toHaveLength(2);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in all responses', async () => {
      const module = await import('../auth-register.js');
      const handler = module.default;

      const req = createMockRequest('OPTIONS');
      const response = await handler(req, {});

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Security', () => {
    it('should use same error message for invalid email and wrong password', async () => {
      const module = await import('../auth-login.js');
      const handler = module.default;

      // Non-existent user
      mockGetUser.mockResolvedValue(null);
      let req = createMockRequest('POST', { email: 'a@b.com', password: 'test1234' });
      let response = await handler(req, {});
      let body1 = await parseResponse(response);

      // Existing user, wrong password
      mockGetUser.mockResolvedValue({ id: '1', email: 'a@b.com', passwordHash: 'hash' });
      mockVerifyPassword.mockResolvedValue(false);
      req = createMockRequest('POST', { email: 'a@b.com', password: 'wrong' });
      response = await handler(req, {});
      let body2 = await parseResponse(response);

      // Same error message for both (prevents user enumeration)
      expect(body1.error).toBe(body2.error);
    });
  });
});
