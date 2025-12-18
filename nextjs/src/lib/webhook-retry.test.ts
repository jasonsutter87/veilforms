/**
 * Webhook Retry Logic Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fireWebhookWithRetry,
  getFailedWebhooks,
  retryFailedWebhook,
} from './webhook-retry';

// Mock @netlify/blobs
const mockStore = {
  get: vi.fn(),
  setJSON: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => mockStore),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console to avoid cluttering test output
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('webhook-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleWarnSpy.mockClear();
  });

  const mockSubmission = {
    id: 'sub_123',
    formId: 'form_456',
    payload: { name: 'Test User', email: 'test@example.com' },
    timestamp: Date.now(),
  };

  describe('fireWebhookWithRetry', () => {
    it('should deliver webhook successfully on first attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'VeilForms-Webhook/1.0',
          }),
          body: expect.stringContaining('submission.created'),
        })
      );
    });

    it('should retry on server error (5xx)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(1000);

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client error (4xx)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const result = await fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      // Advance through first retry (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      // Advance through second retry (2000ms)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should store failed webhook after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      // Advance through all retry delays (1000 + 2000 + 4000)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.attempt).toBe(4); // Initial + 3 retries
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        expect.stringContaining('form_456'),
        expect.objectContaining({
          url: 'https://example.com/webhook',
          submission: mockSubmission,
          error: expect.stringContaining('503'),
          status: 'pending_manual_retry',
          retries: 3,
        })
      );
    });

    it('should include HMAC signature when secret is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission,
        'test-secret'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-VeilForms-Signature': expect.any(String),
          }),
        })
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(2);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(2);
    });

    it('should log delivery status on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await fireWebhookWithRetry('https://example.com/webhook', mockSubmission);

      expect(mockStore.setJSON).toHaveBeenCalledWith(
        expect.stringContaining('log_'),
        expect.objectContaining({
          deliveries: expect.arrayContaining([
            expect.objectContaining({
              status: 'delivered',
              attempt: 1,
              statusCode: 200,
            }),
          ]),
        })
      );
    });

    it('should log delivery status on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      expect(mockStore.setJSON).toHaveBeenCalledWith(
        expect.stringContaining('log_'),
        expect.objectContaining({
          deliveries: expect.arrayContaining([
            expect.objectContaining({
              status: 'failed',
              attempt: 4,
              error: expect.stringContaining('500'),
            }),
          ]),
        })
      );
    });

    it('should build correct webhook payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await fireWebhookWithRetry('https://example.com/webhook', mockSubmission);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body).toEqual({
        event: 'submission.created',
        formId: 'form_456',
        submissionId: 'sub_123',
        timestamp: mockSubmission.timestamp,
        payload: mockSubmission.payload,
      });
    });

    it('should add failed webhook to index', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      // Check that index was updated
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        'failed_index_form_456',
        expect.objectContaining({
          failed: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              ts: expect.any(Number),
            }),
          ]),
        })
      );
    });
  });

  describe('getFailedWebhooks', () => {
    it('should retrieve failed webhooks for a form', async () => {
      const failedWebhook = {
        id: 'failed_1',
        url: 'https://example.com/webhook',
        submission: mockSubmission,
        secret: null,
        error: 'Connection refused',
        failedAt: new Date().toISOString(),
        retries: 3,
        status: 'pending_manual_retry',
      };

      mockStore.get
        .mockResolvedValueOnce({
          failed: [{ id: 'failed_1', ts: Date.now() }],
        })
        .mockResolvedValueOnce(failedWebhook);

      const result = await getFailedWebhooks('form_456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(failedWebhook);
    });

    it('should return empty array if no failed webhooks', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await getFailedWebhooks('form_456');

      expect(result).toEqual([]);
    });

    it('should limit results to specified limit', async () => {
      const index = {
        failed: Array.from({ length: 100 }, (_, i) => ({
          id: `failed_${i}`,
          ts: Date.now() - i * 1000,
        })),
      };

      mockStore.get.mockImplementation((key) => {
        if (key === 'failed_index_form_456') return Promise.resolve(index);
        return Promise.resolve({
          id: key,
          url: 'https://example.com/webhook',
        });
      });

      const result = await getFailedWebhooks('form_456', 10);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should filter out null webhooks', async () => {
      mockStore.get
        .mockResolvedValueOnce({
          failed: [
            { id: 'failed_1', ts: Date.now() },
            { id: 'failed_2', ts: Date.now() },
          ],
        })
        .mockResolvedValueOnce({ id: 'failed_1' })
        .mockResolvedValueOnce(null);

      const result = await getFailedWebhooks('form_456');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('failed_1');
    });

    it('should handle storage errors gracefully', async () => {
      mockStore.get.mockRejectedValue(new Error('Storage error'));

      const result = await getFailedWebhooks('form_456');

      expect(result).toEqual([]);
    });
  });

  describe('retryFailedWebhook', () => {
    it('should retry and succeed', async () => {
      const failedWebhook = {
        id: 'failed_1',
        url: 'https://example.com/webhook',
        submission: mockSubmission,
        secret: null,
        error: 'Connection refused',
        failedAt: new Date().toISOString(),
        retries: 3,
        status: 'pending_manual_retry',
      };

      mockStore.get.mockResolvedValue(failedWebhook);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.setJSON.mockResolvedValue(undefined);
      mockStore.delete.mockResolvedValue(undefined);

      const result = await retryFailedWebhook('failed_1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Webhook delivered successfully');
      expect(mockStore.delete).toHaveBeenCalledWith('failed_1');
    });

    it('should return error if webhook not found', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await retryFailedWebhook('invalid_id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook not found');
    });

    it('should return error if retry fails', async () => {
      const failedWebhook = {
        id: 'failed_1',
        url: 'https://example.com/webhook',
        submission: mockSubmission,
        secret: null,
        error: 'Connection refused',
        failedAt: new Date().toISOString(),
        retries: 3,
        status: 'pending_manual_retry',
      };

      mockStore.get.mockResolvedValue(failedWebhook);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = retryFailedWebhook('failed_1');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
      expect(mockStore.delete).not.toHaveBeenCalled();
    });

    it('should handle exceptions', async () => {
      mockStore.get.mockRejectedValue(new Error('Storage error'));

      const result = await retryFailedWebhook('failed_1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should preserve webhook secret on retry', async () => {
      const failedWebhook = {
        id: 'failed_1',
        url: 'https://example.com/webhook',
        submission: mockSubmission,
        secret: 'secret-key',
        error: 'Connection refused',
        failedAt: new Date().toISOString(),
        retries: 3,
        status: 'pending_manual_retry',
      };

      mockStore.get.mockResolvedValue(failedWebhook);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.setJSON.mockResolvedValue(undefined);
      mockStore.delete.mockResolvedValue(undefined);

      await retryFailedWebhook('failed_1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-VeilForms-Signature': expect.any(String),
          }),
        })
      );
    });
  });

  describe('webhook payload building', () => {
    it('should build correct event type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await fireWebhookWithRetry('https://example.com/webhook', mockSubmission);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('submission.created');
    });

    it('should include all submission data', async () => {
      const complexSubmission = {
        id: 'sub_789',
        formId: 'form_abc',
        payload: {
          name: 'John Doe',
          email: 'john@example.com',
          nested: { key: 'value' },
          array: [1, 2, 3],
        },
        timestamp: 1234567890,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockResolvedValue(undefined);

      await fireWebhookWithRetry('https://example.com/webhook', complexSubmission);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toMatchObject({
        event: 'submission.created',
        formId: 'form_abc',
        submissionId: 'sub_789',
        timestamp: 1234567890,
        payload: complexSubmission.payload,
      });
    });
  });

  describe('logging', () => {
    it('should keep last 10 delivery attempts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      // Existing log with 9 entries
      const existingLog = {
        deliveries: Array.from({ length: 9 }, (_, i) => ({
          status: 'delivered',
          attempt: 1,
          timestamp: Date.now() - i * 1000,
        })),
      };

      mockStore.get.mockResolvedValue(existingLog);
      mockStore.setJSON.mockResolvedValue(undefined);

      await fireWebhookWithRetry('https://example.com/webhook', mockSubmission);

      const setJSONCall = mockStore.setJSON.mock.calls.find((call) =>
        call[0].startsWith('log_')
      );
      expect(setJSONCall[1].deliveries).toHaveLength(10);
    });

    it('should handle logging errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockRejectedValue(new Error('Storage full'));

      // Should not throw
      await expect(
        fireWebhookWithRetry('https://example.com/webhook', mockSubmission)
      ).resolves.toMatchObject({
        success: true,
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('index management', () => {
    it('should keep index manageable at 1000 entries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Existing index with 1000 entries
      const existingIndex = {
        failed: Array.from({ length: 1000 }, (_, i) => ({
          id: `failed_${i}`,
          ts: Date.now() - i * 1000,
        })),
      };

      mockStore.get.mockResolvedValue(existingIndex);
      mockStore.setJSON.mockResolvedValue(undefined);

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      const indexCall = mockStore.setJSON.mock.calls.find((call) =>
        call[0].startsWith('failed_index_')
      );
      expect(indexCall[1].failed).toHaveLength(1000);
    });

    it('should handle index errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      mockStore.get.mockResolvedValue(null);
      mockStore.setJSON.mockImplementation((key) => {
        if (key.startsWith('failed_index_')) {
          return Promise.reject(new Error('Index error'));
        }
        return Promise.resolve();
      });

      const promise = fireWebhookWithRetry(
        'https://example.com/webhook',
        mockSubmission
      );

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      // Should not throw
      await expect(promise).resolves.toMatchObject({
        success: false,
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});
