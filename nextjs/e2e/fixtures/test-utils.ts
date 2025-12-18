/**
 * VeilForms - E2E Test Utilities
 * Helpers for generating test data and common test operations
 */

/**
 * Generate a unique test email address
 * Each test run gets a unique timestamp to avoid conflicts
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@veilforms-e2e.test`;
}

/**
 * Generate test user credentials
 */
export function generateTestCredentials() {
  return {
    email: generateTestEmail(),
    password: 'TestPassword123!', // Meets all requirements: 12+ chars, uppercase, lowercase, number
  };
}

/**
 * Common test data for form creation
 */
export const testFormData = {
  basic: {
    name: 'Test Contact Form',
    piiStrip: false,
    webhook: '',
  },
  withPII: {
    name: 'Test Form with PII Detection',
    piiStrip: true,
    webhook: '',
  },
  withWebhook: {
    name: 'Test Form with Webhook',
    piiStrip: false,
    webhook: 'https://webhook.site/test-webhook',
  },
};

/**
 * Wait for navigation to complete
 * Useful for handling client-side routing transitions
 */
export async function waitForNavigation(page: any, url: string) {
  await page.waitForURL(url, { timeout: 10000 });
}

/**
 * Login helper for tests that need authenticated state
 */
export async function login(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await waitForNavigation(page, '/dashboard');
}

/**
 * Register helper for tests
 */
export async function register(page: any, email: string, password: string) {
  await page.goto('/register');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}

/**
 * Get stored auth token from localStorage
 */
export async function getAuthToken(page: any): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('veilforms_token');
  });
}

/**
 * Clear all stored auth data
 */
export async function clearAuthData(page: any) {
  await page.evaluate(() => {
    localStorage.removeItem('veilforms_token');
    localStorage.removeItem('veilforms_pending_email');
  });
}
