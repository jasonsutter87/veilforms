/**
 * VeilForms - Form Submission Endpoint
 * Stores encrypted submissions in Netlify Blob
 */

import { getStore } from '@netlify/blobs';
import { getForm, updateForm, getUserById } from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';

// Subscription limits
const SUBMISSION_LIMITS = {
  free: 100,
  starter: 1000,
  pro: 10000,
  enterprise: Infinity
};

export default async function handler(req, context) {
  // CORS headers - check allowed origins from form settings
  const origin = req.headers.get('origin') || '*';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  // Rate limit submissions (30 per minute per IP)
  const rateLimit = checkRateLimit(req, { keyPrefix: 'submit', maxRequests: 30 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many submissions. Please try again later.',
      retryAfter: rateLimit.retryAfter
    }), {
      status: 429,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });
  }

  try {
    const body = await req.json();
    const { formId, submissionId, payload, timestamp, meta, spamProtection } = body;

    // Validate required fields
    if (!formId || !submissionId || !payload) {
      return new Response(JSON.stringify({ error: 'Missing required fields: formId, submissionId, payload' }), {
        status: 400,
        headers
      });
    }

    // Validate formId format (prevent injection)
    if (!/^vf_[a-z0-9_]+$/i.test(formId)) {
      return new Response(JSON.stringify({ error: 'Invalid form ID format' }), {
        status: 400,
        headers
      });
    }

    // Validate submissionId format
    if (!/^(vf-[a-f0-9-]{36}|[a-f0-9]{32})$/.test(submissionId)) {
      return new Response(JSON.stringify({ error: 'Invalid submission ID format' }), {
        status: 400,
        headers
      });
    }

    // Get form and validate it exists
    const form = await getForm(formId);
    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404,
        headers
      });
    }

    // Check if form is active
    if (form.status === 'deleted' || form.status === 'paused') {
      return new Response(JSON.stringify({ error: 'Form is not accepting submissions' }), {
        status: 403,
        headers
      });
    }

    // Check origin is allowed
    if (form.settings?.allowedOrigins && !form.settings.allowedOrigins.includes('*')) {
      if (!form.settings.allowedOrigins.includes(origin)) {
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
          status: 403,
          headers
        });
      }
    }

    // SPAM PROTECTION VALIDATION

    // 1. Honeypot validation (if enabled)
    if (form.settings?.spamProtection?.honeypot) {
      const honeypotValue = spamProtection?.honeypot;

      // Honeypot field must exist and be empty
      if (honeypotValue === undefined) {
        return new Response(JSON.stringify({ error: 'Spam protection validation failed' }), {
          status: 400,
          headers
        });
      }

      if (honeypotValue !== '') {
        // Bot detected - honeypot was filled
        console.warn('[SPAM] Honeypot triggered for form:', formId);
        return new Response(JSON.stringify({ error: 'Spam detected' }), {
          status: 403,
          headers
        });
      }
    }

    // 2. reCAPTCHA validation (if enabled)
    if (form.settings?.spamProtection?.recaptcha?.enabled) {
      const recaptchaToken = spamProtection?.recaptchaToken;
      const recaptchaSecretKey = form.settings.spamProtection.recaptcha.secretKey;
      const threshold = form.settings.spamProtection.recaptcha.threshold || 0.5;

      if (!recaptchaToken) {
        return new Response(JSON.stringify({ error: 'reCAPTCHA token required' }), {
          status: 400,
          headers
        });
      }

      if (!recaptchaSecretKey) {
        console.error('[CONFIG] reCAPTCHA enabled but no secret key configured');
        return new Response(JSON.stringify({ error: 'reCAPTCHA not properly configured' }), {
          status: 500,
          headers
        });
      }

      // Verify reCAPTCHA token with Google
      const recaptchaValid = await verifyRecaptcha(recaptchaToken, recaptchaSecretKey, threshold);

      if (!recaptchaValid.success) {
        console.warn('[SPAM] reCAPTCHA verification failed:', recaptchaValid.reason);
        return new Response(JSON.stringify({
          error: 'Spam protection verification failed',
          reason: recaptchaValid.reason
        }), {
          status: 403,
          headers
        });
      }
    }

    // Check submission limits based on user's subscription
    const user = await getUserById(form.userId);
    const subscription = user?.subscription || 'free';
    const limit = SUBMISSION_LIMITS[subscription] || SUBMISSION_LIMITS.free;
    if (form.submissionCount >= limit) {
      return new Response(JSON.stringify({
        error: 'Submission limit reached for this form',
        limit,
        current: form.submissionCount,
        subscription
      }), {
        status: 402,
        headers
      });
    }

    // Validate encrypted payload structure
    // SDK sends 'key', normalize to 'encryptedKey' for consistency
    const encryptedKey = payload.encryptedKey || payload.key;
    if (!payload.encrypted || !encryptedKey || !payload.iv || !payload.version) {
      return new Response(JSON.stringify({ error: 'Invalid encrypted payload structure' }), {
        status: 400,
        headers
      });
    }

    // Normalize payload to use encryptedKey
    if (payload.key && !payload.encryptedKey) {
      payload.encryptedKey = payload.key;
      delete payload.key;
    }

    // Get blob store for this form
    const store = getStore({ name: `veilforms-${formId}`, consistency: 'strong' });

    // Build submission record
    const submission = {
      id: submissionId,
      formId,
      payload,
      timestamp: timestamp || Date.now(),
      receivedAt: Date.now(),
      meta: {
        sdkVersion: meta?.sdkVersion || 'unknown',
        formVersion: meta?.formVersion || '1',
        userAgent: req.headers.get('user-agent')?.substring(0, 200) || 'unknown',
        region: context.geo?.country || 'unknown',
        ...meta
      }
    };

    // Store submission
    await store.setJSON(submissionId, submission);

    // Update submission index
    await updateIndex(store, submissionId, submission.timestamp);

    // Increment form submission count
    await updateForm(formId, {
      submissionCount: (form.submissionCount || 0) + 1,
      lastSubmissionAt: new Date().toISOString()
    });

    // Fire webhook if configured (async, don't wait)
    if (form.settings?.webhookUrl) {
      fireWebhook(form.settings.webhookUrl, submission, form.settings.webhookSecret).catch(err => {
        console.error('Webhook failed:', err.message);
      });
    }

    return new Response(JSON.stringify({
      success: true,
      submissionId,
      timestamp: submission.timestamp
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Submission error:', error);

    return new Response(JSON.stringify({ error: 'Submission failed' }), {
      status: 500,
      headers
    });
  }
}

/**
 * Update submission index for efficient listing
 */
async function updateIndex(store, submissionId, timestamp) {
  const indexKey = '_index';

  try {
    let index = await store.get(indexKey, { type: 'json' }) || { submissions: [] };

    // Add new submission to index (newest first)
    index.submissions.unshift({
      id: submissionId,
      ts: timestamp
    });

    // Keep index manageable (last 10000 entries)
    if (index.submissions.length > 10000) {
      index.submissions = index.submissions.slice(0, 10000);
    }

    await store.setJSON(indexKey, index);
  } catch (e) {
    console.warn('Index update failed:', e);
  }
}

/**
 * Fire webhook notification (fire-and-forget)
 */
async function fireWebhook(url, submission, secret) {
  const payload = {
    event: 'submission.created',
    formId: submission.formId,
    submissionId: submission.id,
    timestamp: submission.timestamp,
    // Include encrypted payload - receiver must decrypt
    payload: submission.payload
  };

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'VeilForms-Webhook/1.0'
  };

  // Add signature if secret is configured
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

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}

/**
 * Verify reCAPTCHA v3 token with Google
 */
async function verifyRecaptcha(token, secretKey, threshold = 0.5) {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`
    });

    const data = await response.json();

    // reCAPTCHA v3 returns a score from 0.0 to 1.0
    // 1.0 is very likely a good interaction, 0.0 is very likely a bot
    if (!data.success) {
      return {
        success: false,
        reason: data['error-codes']?.join(', ') || 'Verification failed'
      };
    }

    // Check score against threshold
    const score = data.score || 0;
    if (score < threshold) {
      return {
        success: false,
        reason: `Score too low: ${score} (threshold: ${threshold})`
      };
    }

    return {
      success: true,
      score: score
    };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return {
      success: false,
      reason: 'Verification service error'
    };
  }
}

export const config = {
  path: '/api/submit'
};
