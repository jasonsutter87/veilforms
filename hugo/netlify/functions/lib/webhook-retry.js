/**
 * Webhook Retry Logic with Exponential Backoff
 *
 * Features:
 * - Exponential backoff (1s, 2s, 4s) - max 3 retries
 * - Failed webhook storage for manual retry
 * - Delivery status logging
 * - Signature verification support
 */

import { getStore } from '@netlify/blobs';

const WEBHOOK_RETRY_STORE = 'vf-webhook-retry';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // milliseconds

/**
 * Fire webhook with automatic retry logic
 */
export async function fireWebhookWithRetry(url, submission, secret = null) {
  const payload = buildWebhookPayload(submission);
  const headers = await buildWebhookHeaders(payload, secret);

  let lastError = null;
  let attempt = 0;

  // Try initial delivery + retries
  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (response.ok) {
        // Success - log delivery
        await logWebhookDelivery(submission.formId, submission.id, {
          status: 'delivered',
          attempt: attempt + 1,
          statusCode: response.status,
          timestamp: Date.now()
        });

        return { success: true, attempt: attempt + 1 };
      }

      lastError = new Error(`Webhook returned ${response.status}: ${response.statusText}`);

      // Don't retry 4xx errors (client errors - bad request, unauthorized, etc)
      if (response.status >= 400 && response.status < 500) {
        throw lastError;
      }

    } catch (error) {
      lastError = error;

      // Don't retry on client errors
      if (error.message.includes('4')) {
        break;
      }

      // If this isn't the last attempt, wait before retry
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt]);
      }
    }

    attempt++;
  }

  // All retries failed - store for manual retry
  await storeFailedWebhook(url, submission, secret, lastError.message);

  // Log final failure
  await logWebhookDelivery(submission.formId, submission.id, {
    status: 'failed',
    attempt: attempt,
    error: lastError.message,
    timestamp: Date.now()
  });

  return {
    success: false,
    error: lastError.message,
    attempt
  };
}

/**
 * Build webhook payload
 */
function buildWebhookPayload(submission) {
  return {
    event: 'submission.created',
    formId: submission.formId,
    submissionId: submission.id,
    timestamp: submission.timestamp,
    // Include encrypted payload - receiver must decrypt
    payload: submission.payload
  };
}

/**
 * Build webhook headers with optional signature
 */
async function buildWebhookHeaders(payload, secret) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'VeilForms-Webhook/1.0'
  };

  // Add HMAC signature if secret is configured
  if (secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(JSON.stringify(payload))
    );
    headers['X-VeilForms-Signature'] = btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  return headers;
}

/**
 * Store failed webhook for manual retry
 */
async function storeFailedWebhook(url, submission, secret, error) {
  const store = getStore({ name: WEBHOOK_RETRY_STORE, consistency: 'strong' });

  const failedWebhook = {
    id: `${submission.formId}_${submission.id}_${Date.now()}`,
    url,
    submission,
    secret,
    error,
    failedAt: new Date().toISOString(),
    retries: MAX_RETRIES,
    status: 'pending_manual_retry'
  };

  await store.setJSON(failedWebhook.id, failedWebhook);

  // Add to index for listing failed webhooks
  await addToFailedIndex(submission.formId, failedWebhook.id);

  return failedWebhook;
}

/**
 * Add to failed webhook index
 */
async function addToFailedIndex(formId, webhookId) {
  const store = getStore({ name: WEBHOOK_RETRY_STORE, consistency: 'strong' });
  const indexKey = `failed_index_${formId}`;

  try {
    let index = await store.get(indexKey, { type: 'json' }) || { failed: [] };

    index.failed.unshift({
      id: webhookId,
      ts: Date.now()
    });

    // Keep index manageable (last 1000 entries)
    if (index.failed.length > 1000) {
      index.failed = index.failed.slice(0, 1000);
    }

    await store.setJSON(indexKey, index);
  } catch (e) {
    console.warn('Failed webhook index update error:', e);
  }
}

/**
 * Log webhook delivery status
 */
async function logWebhookDelivery(formId, submissionId, details) {
  const store = getStore({ name: WEBHOOK_RETRY_STORE, consistency: 'strong' });
  const logKey = `log_${formId}_${submissionId}`;

  try {
    let log = await store.get(logKey, { type: 'json' }) || { deliveries: [] };

    log.deliveries.push(details);

    // Keep last 10 delivery attempts
    if (log.deliveries.length > 10) {
      log.deliveries = log.deliveries.slice(-10);
    }

    await store.setJSON(logKey, log);
  } catch (e) {
    console.warn('Webhook delivery log error:', e);
  }
}

/**
 * Get failed webhooks for a form
 */
export async function getFailedWebhooks(formId, limit = 50) {
  const store = getStore({ name: WEBHOOK_RETRY_STORE, consistency: 'strong' });
  const indexKey = `failed_index_${formId}`;

  try {
    const index = await store.get(indexKey, { type: 'json' }) || { failed: [] };

    const slice = index.failed.slice(0, limit);
    const webhooks = await Promise.all(
      slice.map(item => store.get(item.id, { type: 'json' }))
    );

    return webhooks.filter(w => w !== null);
  } catch (e) {
    return [];
  }
}

/**
 * Retry a failed webhook manually
 */
export async function retryFailedWebhook(webhookId) {
  const store = getStore({ name: WEBHOOK_RETRY_STORE, consistency: 'strong' });

  try {
    const webhook = await store.get(webhookId, { type: 'json' });
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    // Try to deliver
    const result = await fireWebhookWithRetry(
      webhook.url,
      webhook.submission,
      webhook.secret
    );

    if (result.success) {
      // Remove from failed list
      await store.delete(webhookId);
      return { success: true, message: 'Webhook delivered successfully' };
    }

    return { success: false, error: result.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get webhook delivery log
 */
export async function getWebhookDeliveryLog(formId, submissionId) {
  const store = getStore({ name: WEBHOOK_RETRY_STORE, consistency: 'strong' });
  const logKey = `log_${formId}_${submissionId}`;

  try {
    return await store.get(logKey, { type: 'json' }) || { deliveries: [] };
  } catch (e) {
    return { deliveries: [] };
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
