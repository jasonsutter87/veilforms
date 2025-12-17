import { jest } from '@jest/globals';

// Mock dependencies
const mockAuthenticateRequest = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockGetRateLimitHeaders = jest.fn();
const mockGetForm = jest.fn();
const mockUpdateForm = jest.fn();
const mockGetUser = jest.fn();
const mockLogAudit = jest.fn();

jest.unstable_mockModule('../lib/auth.js', () => ({
  authenticateRequest: mockAuthenticateRequest
}));

jest.unstable_mockModule('../lib/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitHeaders: mockGetRateLimitHeaders
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  getForm: mockGetForm,
  updateForm: mockUpdateForm,
  getUser: mockGetUser
}));

jest.unstable_mockModule('../lib/audit.js', () => ({
  logAudit: mockLogAudit,
  AuditEvents: {
    FORM_UPDATED: 'form.updated'
  }
}));

// Helper to create mock Request
function createMockRequest(method, url = 'https://example.com/api/forms/vf_123', body = null, headers = {}) {
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

describe('Forms Validation Tests', () => {
  let handler;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetRateLimitHeaders.mockReturnValue({});
    mockAuthenticateRequest.mockReturnValue({ user: { id: 'user_123' } });
    mockGetUser.mockResolvedValue({ id: 'user_123', subscription: 'pro' });
    mockGetForm.mockResolvedValue({
      id: 'vf_123',
      userId: 'user_123',
      name: 'Test Form',
      settings: {}
    });
    mockUpdateForm.mockImplementation((id, data) => Promise.resolve({ id, ...data }));
    const module = await import('../forms.js');
    handler = module.default;
  });

  describe('Branding Settings Validation', () => {
    describe('customLogo URL validation', () => {
      it('should accept valid HTTPS logo URL', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: 'https://example.com/logo.png'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(200);
      });

      it('should accept valid HTTP logo URL', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: 'http://example.com/logo.png'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(200);
      });

      it('should accept empty string for logo URL', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: ''
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(200);
      });

      it('should reject logo URL with invalid protocol (javascript:)', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: 'javascript:alert(1)'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(400);

        const body = await parseResponse(response);
        expect(body.error).toContain('protocol');
      });

      it('should reject logo URL with data: protocol', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: 'data:image/png;base64,iVBORw0KGgo='
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(400);

        const body = await parseResponse(response);
        expect(body.error).toContain('protocol');
      });

      it('should reject logo URL with file: protocol', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: 'file:///etc/passwd'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(400);

        const body = await parseResponse(response);
        expect(body.error).toContain('protocol');
      });

      it('should reject logo URL that exceeds max length (2048 chars)', async () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(2030);
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: longUrl
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(400);

        const body = await parseResponse(response);
        expect(body.error).toContain('too long');
      });

      it('should accept logo URL at max length limit', async () => {
        const validUrl = 'https://example.com/' + 'a'.repeat(2018); // Exactly 2048 chars
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: validUrl
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(200);
      });

      it('should reject invalid URL format', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: 'not-a-valid-url'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(400);

        const body = await parseResponse(response);
        expect(body.error).toContain('Invalid logo URL');
      });

      it('should reject URL with only protocol', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              customLogo: 'https://'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(400);
      });
    });

    describe('primaryColor validation', () => {
      it('should accept valid hex color', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              primaryColor: '#FF5733'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(200);
      });

      it('should accept short hex color', async () => {
        const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
          settings: {
            branding: {
              primaryColor: '#F53'
            }
          }
        });

        const response = await handler(req, {});
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Retention Settings Validation', () => {
    it('should accept valid retention settings', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        settings: {
          retention: {
            enabled: true,
            days: 30
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
    });

    it('should accept retention disabled', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        settings: {
          retention: {
            enabled: false
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
    });

    it('should accept minimum retention days (1)', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        settings: {
          retention: {
            enabled: true,
            days: 1
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
    });

    it('should accept maximum retention days (365)', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        settings: {
          retention: {
            enabled: true,
            days: 365
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
    });
  });

  describe('Notification Settings Validation', () => {
    it('should accept valid email notification settings', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        settings: {
          notifications: {
            email: true,
            emailAddress: 'test@example.com'
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
    });

    it('should accept webhook notification settings', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        settings: {
          notifications: {
            webhook: true,
            webhookUrl: 'https://api.example.com/webhook'
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
    });
  });

  describe('Form Update Authorization', () => {
    it('should reject update for form owned by another user', async () => {
      mockGetForm.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_456', // Different user
        name: 'Test Form'
      });

      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        name: 'Updated Name'
      });

      const response = await handler(req, {});
      expect(response.status).toBe(404);
    });

    it('should reject update for non-existent form', async () => {
      mockGetForm.mockResolvedValue(null);

      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_nonexistent', {
        name: 'Updated Name'
      });

      const response = await handler(req, {});
      expect(response.status).toBe(404);
    });

    it('should reject update for deleted form', async () => {
      mockGetForm.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_123',
        status: 'deleted'
      });

      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        name: 'Updated Name'
      });

      const response = await handler(req, {});
      expect(response.status).toBe(404);
    });
  });

  describe('Combined Settings Update', () => {
    it('should accept update with multiple valid settings', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        name: 'Updated Form',
        settings: {
          branding: {
            customLogo: 'https://example.com/logo.png',
            primaryColor: '#007BFF',
            showBranding: false
          },
          retention: {
            enabled: true,
            days: 90
          },
          notifications: {
            email: true,
            emailAddress: 'notify@example.com'
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(200);
    });

    it('should reject if any setting is invalid', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        name: 'Updated Form',
        settings: {
          branding: {
            customLogo: 'javascript:alert(1)', // Invalid
            primaryColor: '#007BFF'
          },
          retention: {
            enabled: true,
            days: 30
          }
        }
      });

      const response = await handler(req, {});
      expect(response.status).toBe(400);
    });
  });

  describe('Audit Logging', () => {
    it('should log audit event on successful update', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        name: 'Updated Name'
      });

      await handler(req, {});

      expect(mockLogAudit).toHaveBeenCalledWith(
        'user_123',
        'form.updated',
        expect.objectContaining({
          formId: 'vf_123'
        })
      );
    });

    it('should not log audit event on validation failure', async () => {
      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        settings: {
          branding: {
            customLogo: 'javascript:alert(1)'
          }
        }
      });

      await handler(req, {});

      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should reject rate limited requests', async () => {
      mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 60 });
      mockGetRateLimitHeaders.mockReturnValue({ 'X-RateLimit-Remaining': '0' });

      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        name: 'Updated'
      });

      const response = await handler(req, {});
      expect(response.status).toBe(429);
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      mockAuthenticateRequest.mockReturnValue({ error: 'Unauthorized', status: 401 });

      const req = createMockRequest('PATCH', 'https://example.com/api/forms/vf_123', {
        name: 'Updated'
      });

      const response = await handler(req, {});
      expect(response.status).toBe(401);
    });
  });

  describe('OPTIONS preflight', () => {
    it('should return 204 for OPTIONS requests', async () => {
      const req = createMockRequest('OPTIONS');

      const response = await handler(req, {});
      expect(response.status).toBe(204);
    });
  });
});
