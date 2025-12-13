import { jest } from '@jest/globals';

// Mock dependencies
const mockAuthenticateRequest = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockGetRateLimitHeaders = jest.fn();
const mockGetAuditLogs = jest.fn();
const mockGetFormAuditLogs = jest.fn();
const mockGetForm = jest.fn();

jest.unstable_mockModule('../lib/auth.js', () => ({
  authenticateRequest: mockAuthenticateRequest
}));

jest.unstable_mockModule('../lib/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitHeaders: mockGetRateLimitHeaders
}));

jest.unstable_mockModule('../lib/audit.js', () => ({
  getAuditLogs: mockGetAuditLogs,
  getFormAuditLogs: mockGetFormAuditLogs,
  AuditEvents: {
    FORM_CREATED: 'form.created',
    FORM_UPDATED: 'form.updated',
    FORM_DELETED: 'form.deleted'
  }
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  getForm: mockGetForm
}));

// Helper to create mock Request
function createMockRequest(method, url = 'https://example.com/api/audit-logs', headers = {}) {
  return {
    method,
    url,
    headers: {
      get: (name) => headers[name.toLowerCase()] || null
    }
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

describe('Audit Logs Endpoint', () => {
  let handler;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetRateLimitHeaders.mockReturnValue({});
    const module = await import('../audit-logs.js');
    handler = module.default;
  });

  describe('OPTIONS request', () => {
    it('should return 204 for preflight', async () => {
      const req = createMockRequest('OPTIONS');
      const response = await handler(req, {});
      expect(response.status).toBe(204);
    });
  });

  describe('Method validation', () => {
    it('should reject non-GET methods', async () => {
      const req = createMockRequest('POST');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });

      const response = await handler(req, {});
      expect(response.status).toBe(405);

      const body = await parseResponse(response);
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('GET');
      mockAuthenticateRequest.mockReturnValue({ error: 'Unauthorized', status: 401 });

      const response = await handler(req, {});
      expect(response.status).toBe(401);
    });

    it('should accept authenticated requests', async () => {
      const req = createMockRequest('GET');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetAuditLogs.mockResolvedValue({ logs: [], total: 0, limit: 50, offset: 0 });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
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

  describe('GET /api/audit-logs', () => {
    it('should return user audit logs', async () => {
      const req = createMockRequest('GET');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetAuditLogs.mockResolvedValue({
        logs: [
          { id: 'audit_1', event: 'form.created', timestamp: '2024-01-01T00:00:00Z' },
          { id: 'audit_2', event: 'form.updated', timestamp: '2024-01-02T00:00:00Z' }
        ],
        total: 2,
        limit: 50,
        offset: 0
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.logs).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('should support pagination', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/audit-logs?limit=10&offset=5');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetAuditLogs.mockResolvedValue({
        logs: [],
        total: 100,
        limit: 10,
        offset: 5
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);

      expect(mockGetAuditLogs).toHaveBeenCalledWith('user_123', 10, 5, null);
    });

    it('should enforce max limit of 100', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/audit-logs?limit=500');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetAuditLogs.mockResolvedValue({ logs: [], total: 0, limit: 100, offset: 0 });

      await handler(req, {});

      expect(mockGetAuditLogs).toHaveBeenCalledWith('user_123', 100, 0, null);
    });

    it('should support event type filtering', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/audit-logs?event=form.created');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetAuditLogs.mockResolvedValue({ logs: [], total: 0, limit: 50, offset: 0 });

      await handler(req, {});

      expect(mockGetAuditLogs).toHaveBeenCalledWith('user_123', 50, 0, 'form.created');
    });
  });

  describe('GET /api/audit-logs?formId=xxx', () => {
    it('should return form-specific audit logs', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/audit-logs?formId=vf_123');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetForm.mockResolvedValue({ id: 'vf_123', userId: 'user_123' });
      mockGetFormAuditLogs.mockResolvedValue({
        logs: [{ id: 'audit_1', event: 'form.created' }],
        total: 1
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.logs).toHaveLength(1);
    });

    it('should reject access to forms owned by others', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/audit-logs?formId=vf_123');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetForm.mockResolvedValue({ id: 'vf_123', userId: 'user_456' });

      const response = await handler(req, {});
      expect(response.status).toBe(404);

      const body = await parseResponse(response);
      expect(body.error).toContain('not found');
    });

    it('should return 404 for non-existent form', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/audit-logs?formId=vf_nonexistent');
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetForm.mockResolvedValue(null);

      const response = await handler(req, {});
      expect(response.status).toBe(404);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const req = createMockRequest('GET', 'https://example.com/api/audit-logs', {
        origin: 'http://localhost:1313'
      });
      mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
      mockGetAuditLogs.mockResolvedValue({ logs: [], total: 0, limit: 50, offset: 0 });

      const response = await handler(req, {});

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });
});
