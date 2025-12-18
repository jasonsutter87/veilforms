let submissionCounter = 0;

export interface TestSubmission {
  id: string;
  formId: string;
  encryptedData: string;
  metadata: {
    submittedAt: string;
    userAgent: string;
    ip: string;
    [key: string]: unknown;
  };
  createdAt: string;
}

interface CreateSubmissionOptions {
  formId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generate a UUID-like string for submission IDs
 */
function generateUuid(): string {
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else {
      uuid += hex[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

/**
 * Create a test submission object
 */
export function createTestSubmission(options: CreateSubmissionOptions = {}): TestSubmission {
  submissionCounter++;
  const id = `vf-${generateUuid()}`;

  return {
    id,
    formId: options.formId || `vf_test_${Date.now()}`,
    encryptedData: Buffer.from(JSON.stringify({ test: 'data', counter: submissionCounter })).toString('base64'),
    metadata: {
      submittedAt: new Date().toISOString(),
      userAgent: 'Test User Agent / Vitest',
      ip: '127.0.0.1',
      ...options.metadata,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create multiple test submissions for a form
 */
export function createBulkSubmissions(count: number, formId: string): TestSubmission[] {
  return Array.from({ length: count }, () => createTestSubmission({ formId }));
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetSubmissionCounter(): void {
  submissionCounter = 0;
}
