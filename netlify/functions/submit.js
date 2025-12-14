/**
 * VeilForms - Form Submission Endpoint
 * Stores encrypted submissions in Netlify Blob
 */

import { getStore } from '@netlify/blobs';
import { getForm, updateForm, getUserById } from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { fireWebhookWithRetry } from './lib/webhook-retry.js';
import { checkIdempotencyKey, storeIdempotencyKey, getIdempotencyKeyFromRequest, getIdempotencyHeaders } from './lib/idempotency.js';
import * as response from './lib/responses.js';
import { isValidFormId, isValidSubmissionId } from './lib/validation.js';
import { errorResponse, ErrorCodes } from './lib/errors.js';

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
    'Access-Control-Allow-Headers': 'Content-Type, X-Idempotency-Key, Idempotency-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  // Rate limit submissions (30 per minute per IP)
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'submit', maxRequests: 30 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests(
      { ...headers, ...getRateLimitHeaders(rateLimit) },
      rateLimit.retryAfter
    );
  }

  // SECURITY: Check payload size before parsing (1MB limit)
  const contentLength = req.headers.get('content-length');
  const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
    return response.error('Payload too large. Maximum size is 1MB', headers, 413);
  }

  try {
    // Read body with size validation
    const rawBody = await req.text();

    // Double-check actual size in case Content-Length header was missing/wrong
    const bodySize = new TextEncoder().encode(rawBody).length;
    if (bodySize > MAX_PAYLOAD_SIZE) {
      return response.error('Payload too large. Maximum size is 1MB', headers, 413);
    }

    const body = JSON.parse(rawBody);
    const { formId, submissionId, payload, timestamp, meta, spamProtection } = body;

    // Validate required fields
    if (!formId || !submissionId || !payload) {
      return errorResponse(ErrorCodes.VALIDATION_MISSING_FIELD, headers, {
        details: { required: ['formId', 'submissionId', 'payload'] }
      });
    }

    // Validate formId format (prevent injection)
    if (!isValidFormId(formId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, headers, {
        field: 'formId',
        hint: 'Form ID must be a valid UUID format.'
      });
    }

    // Check for idempotency key (prevents duplicate submissions)
    const idempotencyKey = getIdempotencyKeyFromRequest(req);
    if (idempotencyKey) {
      try {
        const idempotencyCheck = await checkIdempotencyKey(idempotencyKey, formId);
        if (idempotencyCheck.exists) {
          // Return cached response - this is a duplicate request
          const idempotencyHeaders = {
            ...headers,
            ...getIdempotencyHeaders(idempotencyCheck)
          };
          return new Response(
            JSON.stringify(idempotencyCheck.response),
            {
              status: 200,
              headers: idempotencyHeaders
            }
          );
        }
      } catch (idempotencyError) {
        // Invalid idempotency key format
        return response.badRequest(idempotencyError.message, headers);
      }
    }

    // Validate submissionId format
    if (!isValidSubmissionId(submissionId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, headers, {
        field: 'submissionId',
        hint: 'Submission ID must be a valid UUID format.'
      });
    }

    // Get form and validate it exists
    const form = await getForm(formId);
    if (!form) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, headers, {
        message: 'Form not found',
        hint: 'The form ID may be incorrect or the form has been deleted. Please check your integration code.'
      });
    }

    // Check if form is active
    if (form.status === 'deleted' || form.status === 'paused') {
      return errorResponse(ErrorCodes.RESOURCE_FORBIDDEN, headers, {
        message: 'Form is not accepting submissions',
        hint: form.status === 'deleted' ? 'This form has been deleted.' : 'This form is currently paused. Contact the form owner to enable it.'
      });
    }

    // Check origin is allowed
    if (form.settings?.allowedOrigins && !form.settings.allowedOrigins.includes('*')) {
      if (!form.settings.allowedOrigins.includes(origin)) {
        return response.forbidden('Origin not allowed', headers);
      }
    }

    // SPAM PROTECTION VALIDATION

    // 1. Honeypot validation (if enabled)
    if (form.settings?.spamProtection?.honeypot) {
      const honeypotValue = spamProtection?.honeypot;

      // Honeypot field must exist and be empty
      if (honeypotValue === undefined) {
        return response.badRequest('Spam protection validation failed', headers);
      }

      if (honeypotValue !== '') {
        // Bot detected - honeypot was filled
        console.warn('[SPAM] Honeypot triggered for form:', formId);
        return response.forbidden('Spam detected', headers);
      }
    }

    // 2. reCAPTCHA validation (if enabled)
    if (form.settings?.spamProtection?.recaptcha?.enabled) {
      const recaptchaToken = spamProtection?.recaptchaToken;
      const recaptchaSecretKey = form.settings.spamProtection.recaptcha.secretKey;
      const threshold = form.settings.spamProtection.recaptcha.threshold || 0.5;

      if (!recaptchaToken) {
        return response.badRequest('reCAPTCHA token required', headers);
      }

      if (!recaptchaSecretKey) {
        console.error('[CONFIG] reCAPTCHA enabled but no secret key configured');
        return response.serverError(headers, 'reCAPTCHA not properly configured');
      }

      // Verify reCAPTCHA token with Google
      const recaptchaValid = await verifyRecaptcha(recaptchaToken, recaptchaSecretKey, threshold);

      if (!recaptchaValid.success) {
        console.warn('[SPAM] reCAPTCHA verification failed:', recaptchaValid.reason);
        return response.error('Spam protection verification failed', headers, 403, {
          reason: recaptchaValid.reason
        });
      }
    }

    // Check submission limits based on user's subscription
    const user = await getUserById(form.userId);
    const subscription = user?.subscription || 'free';
    const limit = SUBMISSION_LIMITS[subscription] || SUBMISSION_LIMITS.free;
    if (form.submissionCount >= limit) {
      return errorResponse(ErrorCodes.QUOTA_EXCEEDED, headers, {
        message: 'Submission limit reached for this form',
        hint: 'The form owner has reached their plan limit. They need to upgrade their subscription or wait for the next billing cycle.',
        details: {
          limit,
          current: form.submissionCount,
          subscription
        }
      });
    }

    // Validate encrypted payload structure
    // SDK sends 'key', normalize to 'encryptedKey' for consistency
    const encryptedKey = payload.encryptedKey || payload.key;
    if (!payload.encrypted || !encryptedKey || !payload.iv || !payload.version) {
      return errorResponse(ErrorCodes.ENCRYPTION_INVALID_KEY, headers, {
        message: 'Invalid encrypted payload structure',
        hint: 'The submission must be encrypted using the VeilForms SDK. Ensure all required encryption fields are present.',
        details: { required: ['encrypted', 'encryptedKey', 'iv', 'version'] }
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
    // Uses retry logic with exponential backoff
    if (form.settings?.webhookUrl) {
      fireWebhookWithRetry(form.settings.webhookUrl, submission, form.settings.webhookSecret).catch(err => {
        console.error('Webhook delivery error:', err.message);
      });
    }

    // Prepare success response
    const successResponse = {
      success: true,
      submissionId,
      timestamp: submission.timestamp
    };

    // Store idempotency key if provided (24hr TTL)
    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyKey, formId, successResponse);
    }

    return response.success(successResponse, headers);
  } catch (error) {
    console.error('Submission error:', error);

    return errorResponse(ErrorCodes.SERVER_ERROR, headers, {
      message: 'Submission failed'
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
