import { jest } from '@jest/globals';

// Mock dependencies
const mockAuthenticateRequest = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockGetRateLimitHeaders = jest.fn();
const mockCreateApiKey = jest.fn();
const mockGetApiKeyData = jest.fn();
const mockRevokeApiKey = jest.fn();
const mockGetStore = jest.fn();

// Mock store instance
const mockStore = {
  get: jest.fn(),
  setJSON: jest.fn(),
  delete: jest.fn()
};

jest.unstable_mockModule('../lib/auth.js', () => ({
  authenticateRequest: mockAuthenticateRequest
}));

jest.unstable_mockModule('../lib/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitHeaders: mockGetRateLimitHeaders
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  createApiKey: mockCreateApiKey,
  getApiKeyData: mockGetApiKeyData,
  revokeApiKey: mockRevokeApiKey
}));

jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: mockGetStore
}));

// Helper to create mock Request
function createMockRequest(method, url = 'https://example.com/api/api-keys', body = null, headers = {}) {
  return {
    method,
    url,
    headers: {
      get: (name) => headers[name.toLowerCase()] || null
    },
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

describe('API Keys Endpoint', () => {
  let handler;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetRateLimitHeaders.mockReturnValue({});
    mockGetStore.mockReturnValue(mockStore);
    mockStore.get.mockResolvedValue([]);
    const module = await import('../api-keys.js');
    handler = module.default;
  });

  describe('OPTIONS request', () => {
    it('should return 204 for preflight', async () => {
      const req = createMockRequest('OPTIONS');
      const response = await handler(req, {});
      expect(response.status).toBe(204);
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('GET');
      mockAuthenticateRequest.mockReturnValue({ error: 'Unauthorized', status: 401 });

      const response = await handler(req, {});
      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should reject rate limited requests', async () => {
      const req = createMockRequest('GET');
      mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 60 });
      mockGetRateLimitHeaders.mockReturnValue({ 'X-RateLimit-Remaining': '0' });

      const response = await handler(req, {});
      expect(response.status).toBe(429);

      const body = await parseResponse(response);
      expect(body.error).toContain('Too many requests');
    });
  });

  describe('GET /api/api-keys', () => {
    it('should return empty list for user with no keys', async () => {
      const req = createMockRequest('GET');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get.mockResolvedValue(null);

      const response = await handler(req, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.keys).toEqual([]);
    });

    it('should return list of API keys', async () => {
      const req = createMockRequest('GET');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get
        .mockResolvedValueOnce(['hash_1', 'hash_2']) // user_keys list
        .mockResolvedValueOnce({ // First key data
          keyHash: 'hash_1',
          permissions: ['forms:read'],
          createdAt: '2024-01-01T00:00:00Z',
          lastUsed: null
        })
        .mockResolvedValueOnce({ // Second key data
          keyHash: 'hash_2',
          permissions: ['forms:read', 'forms:write'],
          createdAt: '2024-01-02T00:00:00Z',
          lastUsed: '2024-01-03T00:00:00Z'
        });

      const response = await handler(req, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.keys).toHaveLength(2);
    });
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key', async () => {
      const req = createMockRequest('POST', 'https://example.com/api/api-keys', {
        name: 'Test Key',
        permissions: ['forms:read']
      });
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get.mockResolvedValue([]); // No existing keys
      mockCreateApiKey.mockResolvedValue({
        keyHash: 'test_hash',
        permissions: ['forms:read'],
        createdAt: new Date().toISOString()
      });

      const response = await handler(req, {});
      expect(response.status).toBe(201);

      const body = await parseResponse(response);
      expect(body.key).toBeDefined();
      expect(body.key.startsWith('vf_')).toBe(true);
      expect(body.warning).toContain('only time');
    });

    it('should enforce max 5 keys limit', async () => {
      const req = createMockRequest('POST', 'https://example.com/api/api-keys', {
        name: 'Test Key',
        permissions: ['forms:read']
      });
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get.mockResolvedValue(['k1', 'k2', 'k3', 'k4', 'k5']); // Already 5 keys

      const response = await handler(req, {});
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('maximum');
    });

    it('should validate permissions array', async () => {
      const req = createMockRequest('POST', 'https://example.com/api/api-keys', {
        name: 'Test Key',
        permissions: 'invalid' // Not an array
      });
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get.mockResolvedValue([]);

      const response = await handler(req, {});
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('permissions');
    });

    it('should validate permission values', async () => {
      const req = createMockRequest('POST', 'https://example.com/api/api-keys', {
        name: 'Test Key',
        permissions: ['forms:read', 'invalid:permission']
      });
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get.mockResolvedValue([]);

      const response = await handler(req, {});
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('Invalid permission');
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should revoke an API key', async () => {
      const req = createMockRequest('DELETE', 'https://example.com/api/api-keys/key_hash_123');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetApiKeyData.mockResolvedValue({
        userId: 'user_123',
        keyHash: 'key_hash_123'
      });
      mockRevokeApiKey.mockResolvedValue(true);

      const response = await handler(req, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.success).toBe(true);
    });

    it('should reject revoking keys owned by others', async () => {
      const req = createMockRequest('DELETE', 'https://example.com/api/api-keys/key_hash_123');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetApiKeyData.mockResolvedValue({
        userId: 'user_456', // Different user
        keyHash: 'key_hash_123'
      });

      const response = await handler(req, {});
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent key', async () => {
      const req = createMockRequest('DELETE', 'https://example.com/api/api-keys/nonexistent');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetApiKeyData.mockResolvedValue(null);

      const response = await handler(req, {});
      expect(response.status).toBe(404);
    });
  });

  describe('Valid Permissions', () => {
    it('should accept all valid permission types', async () => {
      const validPermissions = [
        'forms:read',
        'forms:write',
        'submissions:read',
        'submissions:delete'
      ];

      const req = createMockRequest('POST', 'https://example.com/api/api-keys', {
        name: 'Full Access Key',
        permissions: validPermissions
      });
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get.mockResolvedValue([]);
      mockCreateApiKey.mockResolvedValue({
        keyHash: 'test_hash',
        permissions: validPermissions,
        createdAt: new Date().toISOString()
      });

      const response = await handler(req, {});
      expect(response.status).toBe(201);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/api-keys', null, {
        origin: 'http://localhost:1313'
      });
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockStore.get.mockResolvedValue([]);

      const response = await handler(req, {});

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });
});
