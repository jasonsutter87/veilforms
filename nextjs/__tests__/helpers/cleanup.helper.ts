/**
 * Test cleanup helper for Netlify Blobs
 * Cleans up test data between test runs
 */

// Test data prefix for easy identification
export const TEST_PREFIX = 'test_';

const TEST_STORES = [
  'vf-users',
  'vf-forms',
  'vf-submissions',
  'vf-api-keys',
  'vf-password-reset-tokens',
  'vf-email-verification-tokens',
  'veilforms-ratelimit',
  'vf-token-blocklist',
  'vf-audit-logs',
  'vf-idempotency',
  'vf-webhook-retry',
];

/**
 * Clean up all test data from Netlify Blobs
 * Only removes items that contain test identifiers
 */
export async function cleanupTestData(): Promise<void> {
  // Dynamic import to avoid issues in test environment
  try {
    const { getStore } = await import('@netlify/blobs');

    for (const storeName of TEST_STORES) {
      try {
        const store = getStore({ name: storeName, consistency: 'strong' });
        const { blobs } = await store.list();

        for (const blob of blobs) {
          // Only delete items with test prefixes
          if (
            blob.key.includes(TEST_PREFIX) ||
            blob.key.includes('test@') ||
            blob.key.includes('_test_')
          ) {
            await store.delete(blob.key);
          }
        }
      } catch (error) {
        // Store might not exist yet, that's fine
        console.warn(`Cleanup skipped for store ${storeName}:`, error);
      }
    }
  } catch {
    // Netlify Blobs not available in this environment
    console.warn('Netlify Blobs cleanup skipped (not available)');
  }
}

/**
 * Create isolated test store name for a specific test
 */
export function getTestStoreName(baseName: string, testId: string): string {
  return `${baseName}-test-${testId}`;
}

/**
 * Generate a unique test ID for isolation
 */
export function generateTestId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
