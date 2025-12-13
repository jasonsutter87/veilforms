import { jest } from '@jest/globals';

// Mock dependencies
const mockGetStore = jest.fn();
const mockLogAudit = jest.fn();

// Mock store instances
const mockFormsStore = {
  list: jest.fn(),
  get: jest.fn(),
  setJSON: jest.fn()
};

const mockSubmissionsStore = {
  get: jest.fn(),
  setJSON: jest.fn(),
  delete: jest.fn()
};

jest.unstable_mockModule('@netlify/blobs', () => ({
  getStore: mockGetStore
}));

jest.unstable_mockModule('../lib/audit.js', () => ({
  logAudit: mockLogAudit,
  AuditEvents: {
    SUBMISSIONS_BULK_DELETED: 'submissions.bulk_deleted'
  }
}));

// Helper to parse Response
async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

describe('Retention Cleanup Function', () => {
  let handler;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup store mocks
    mockGetStore.mockImplementation(({ name }) => {
      if (name === 'vf-forms') return mockFormsStore;
      return mockSubmissionsStore;
    });

    const module = await import('../retention-cleanup.js');
    handler = module.default;
  });

  describe('Basic execution', () => {
    it('should return success with no forms', async () => {
      mockFormsStore.list.mockResolvedValue({ blobs: [], cursor: null });

      const response = await handler({}, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.success).toBe(true);
      expect(body.formsProcessed).toBe(0);
      expect(body.totalDeleted).toBe(0);
    });

    it('should skip user_forms_ index keys', async () => {
      mockFormsStore.list.mockResolvedValue({
        blobs: [
          { key: 'user_forms_user_123' },
          { key: 'id_user_123' }
        ],
        cursor: null
      });

      const response = await handler({}, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.formsProcessed).toBe(0);
    });

    it('should skip forms without retention enabled', async () => {
      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_123' }],
        cursor: null
      });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_123',
        settings: { retention: { enabled: false } }
      });

      const response = await handler({}, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.formsProcessed).toBe(0);
    });

    it('should skip deleted forms', async () => {
      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_123' }],
        cursor: null
      });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_123',
        status: 'deleted',
        settings: { retention: { enabled: true, days: 30 } }
      });

      const response = await handler({}, {});
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.formsProcessed).toBe(0);
    });
  });

  describe('Retention policy enforcement', () => {
    it('should delete submissions older than retention period', async () => {
      const now = Date.now();
      const oldTimestamp = now - (31 * 24 * 60 * 60 * 1000); // 31 days ago
      const recentTimestamp = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago

      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_123' }],
        cursor: null
      });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_123',
        submissionCount: 2,
        settings: { retention: { enabled: true, days: 30 } }
      });
      mockSubmissionsStore.get.mockResolvedValue({
        submissions: [
          { id: 'sub_old', ts: oldTimestamp },
          { id: 'sub_recent', ts: recentTimestamp }
        ]
      });

      const response = await handler({}, {});
      expect(response.status).toBe(200);

      // Should delete the old submission
      expect(mockSubmissionsStore.delete).toHaveBeenCalledWith('sub_old');
      expect(mockSubmissionsStore.delete).not.toHaveBeenCalledWith('sub_recent');

      const body = await parseResponse(response);
      expect(body.totalDeleted).toBe(1);
      expect(body.formsProcessed).toBe(1);
    });

    it('should update form submission count after deletion', async () => {
      const now = Date.now();
      const oldTimestamp = now - (100 * 24 * 60 * 60 * 1000);

      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_123' }],
        cursor: null
      });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_123',
        submissionCount: 5,
        settings: { retention: { enabled: true, days: 30 } }
      });
      mockSubmissionsStore.get.mockResolvedValue({
        submissions: [
          { id: 'sub_1', ts: oldTimestamp },
          { id: 'sub_2', ts: oldTimestamp }
        ]
      });

      await handler({}, {});

      // Should update form with new count
      expect(mockFormsStore.setJSON).toHaveBeenCalledWith(
        'vf_123',
        expect.objectContaining({
          submissionCount: 3 // 5 - 2 deleted
        })
      );
    });

    it('should log audit event for bulk deletion', async () => {
      const now = Date.now();
      const oldTimestamp = now - (100 * 24 * 60 * 60 * 1000);

      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_123' }],
        cursor: null
      });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_123',
        submissionCount: 1,
        settings: { retention: { enabled: true, days: 30 } }
      });
      mockSubmissionsStore.get.mockResolvedValue({
        submissions: [{ id: 'sub_1', ts: oldTimestamp }]
      });

      await handler({}, {});

      expect(mockLogAudit).toHaveBeenCalledWith(
        'user_123',
        'submissions.bulk_deleted',
        expect.objectContaining({
          formId: 'vf_123',
          count: 1,
          reason: 'retention_policy',
          retentionDays: 30
        })
      );
    });

    it('should not call delete if no submissions to delete', async () => {
      const now = Date.now();
      const recentTimestamp = now - (10 * 24 * 60 * 60 * 1000);

      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_123' }],
        cursor: null
      });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_123',
        settings: { retention: { enabled: true, days: 30 } }
      });
      mockSubmissionsStore.get.mockResolvedValue({
        submissions: [{ id: 'sub_recent', ts: recentTimestamp }]
      });

      await handler({}, {});

      expect(mockSubmissionsStore.delete).not.toHaveBeenCalled();
      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('should handle paginated form listing', async () => {
      mockFormsStore.list
        .mockResolvedValueOnce({
          blobs: Array(50).fill({ key: 'vf_form' }),
          cursor: 'next_cursor'
        })
        .mockResolvedValueOnce({
          blobs: [{ key: 'vf_last' }],
          cursor: null
        });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_form',
        settings: { retention: { enabled: false } }
      });

      await handler({}, {});

      // Should call list twice due to pagination
      expect(mockFormsStore.list).toHaveBeenCalledTimes(2);
      expect(mockFormsStore.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: 'next_cursor' })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle form processing errors gracefully', async () => {
      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_error' }, { key: 'vf_success' }],
        cursor: null
      });
      mockFormsStore.get
        .mockRejectedValueOnce(new Error('Storage error'))
        .mockResolvedValueOnce({
          id: 'vf_success',
          settings: { retention: { enabled: false } }
        });

      const response = await handler({}, {});
      expect(response.status).toBe(200);

      // Should continue despite error
      const body = await parseResponse(response);
      expect(body.success).toBe(true);
    });

    it('should return 500 on critical error', async () => {
      mockFormsStore.list.mockRejectedValue(new Error('Critical error'));

      const response = await handler({}, {});
      expect(response.status).toBe(500);

      const body = await parseResponse(response);
      expect(body.error).toBe('Cleanup failed');
    });
  });

  describe('Submission count edge cases', () => {
    it('should not go below zero for submission count', async () => {
      const now = Date.now();
      const oldTimestamp = now - (100 * 24 * 60 * 60 * 1000);

      mockFormsStore.list.mockResolvedValue({
        blobs: [{ key: 'vf_123' }],
        cursor: null
      });
      mockFormsStore.get.mockResolvedValue({
        id: 'vf_123',
        userId: 'user_123',
        submissionCount: 0, // Already zero
        settings: { retention: { enabled: true, days: 30 } }
      });
      mockSubmissionsStore.get.mockResolvedValue({
        submissions: [{ id: 'sub_1', ts: oldTimestamp }]
      });

      await handler({}, {});

      // Should clamp to 0
      expect(mockFormsStore.setJSON).toHaveBeenCalledWith(
        'vf_123',
        expect.objectContaining({
          submissionCount: 0
        })
      );
    });
  });
});
