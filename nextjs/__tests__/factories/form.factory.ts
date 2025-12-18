let formCounter = 0;

export interface FormSettings {
  encryption: boolean;
  piiStrip: boolean;
  webhookUrl: string | null;
  allowedOrigins: string[];
  spamProtection: {
    honeypot: boolean;
    recaptcha: {
      enabled: boolean;
      siteKey: string;
      secretKey: string;
      threshold: number;
    };
  };
}

export interface TestForm {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  settings: FormSettings;
  submissionCount: number;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  deletedAt?: string;
}

interface CreateFormOptions {
  userId?: string;
  name?: string;
  settings?: Partial<FormSettings>;
  submissionCount?: number;
}

/**
 * Create a test form object
 */
export function createTestForm(options: CreateFormOptions = {}): TestForm {
  formCounter++;
  const id = `vf_test_${Date.now()}_${formCounter}`;

  return {
    id,
    userId: options.userId || `test_user_${Date.now()}`,
    name: options.name || `Test Form ${formCounter}`,
    publicKey: JSON.stringify({ kty: 'RSA', test: true }),
    settings: {
      encryption: true,
      piiStrip: options.settings?.piiStrip || false,
      webhookUrl: options.settings?.webhookUrl || null,
      allowedOrigins: options.settings?.allowedOrigins || ['*'],
      spamProtection: {
        honeypot: true,
        recaptcha: {
          enabled: false,
          siteKey: '',
          secretKey: '',
          threshold: 0.5,
        },
        ...options.settings?.spamProtection,
      },
      ...options.settings,
    },
    submissionCount: options.submissionCount || 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a test form with webhook configured
 */
export function createTestFormWithWebhook(webhookUrl: string): TestForm {
  return createTestForm({
    settings: { webhookUrl },
  });
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetFormCounter(): void {
  formCounter = 0;
}
