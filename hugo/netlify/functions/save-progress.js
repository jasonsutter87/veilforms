/**
 * VeilForms - Save Progress Endpoint
 * POST /api/save-progress - Save partial form submission for later
 *
 * Stores encrypted partial submission data with a unique resume token.
 * Optionally sends resume link via email if requested.
 */

import { getStore } from '@netlify/blobs';
import { getForm } from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { sendResumeEmail } from './lib/email.js';
import * as response from './lib/responses.js';
import { isValidFormId, isValidEmail } from './lib/validation.js';

// Store for partial submissions
const PARTIAL_SUBMISSIONS_STORE = 'vf-partial-submissions';

// Maximum storage per form (prevent abuse)
const MAX_PARTIAL_SUBMISSIONS = 1000;

/**
 * Generate a secure resume token
 */
function generateResumeToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate expiry timestamp
 */
function calculateExpiry(expiryHours) {
  if (!expiryHours || expiryHours === 0) {
    return null; // No expiry
  }
  return Date.now() + (expiryHours * 60 * 60 * 1000);
}

export default async function handler(req, context) {
  // CORS headers
  const origin = req.headers.get('origin') || '*';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  // Rate limit (20 per hour per IP to prevent abuse)
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'save-progress', maxRequests: 20, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests(
      { ...headers, ...getRateLimitHeaders(rateLimit) },
      rateLimit.retryAfter
    );
  }

  try {
    const body = await req.json();
    const { formId, partialData, email, meta } = body;

    // Validate required fields
    if (!formId || !partialData) {
      return response.badRequest('Missing required fields: formId, partialData', headers);
    }

    // Validate formId format
    if (!isValidFormId(formId)) {
      return response.badRequest('Invalid form ID format', headers);
    }

    // Get form and validate it exists
    const form = await getForm(formId);
    if (!form) {
      return response.notFound('Form not found', headers);
    }

    // Check if form is active
    if (form.status === 'deleted' || form.status === 'paused') {
      return response.forbidden('Form is not accepting submissions', headers);
    }

    // Check if save progress is enabled for this form
    if (!form.settings?.saveProgress?.enabled) {
      return response.forbidden('Save progress feature not enabled for this form', headers);
    }

    // Validate encrypted partial data structure
    const encryptedKey = partialData.encryptedKey || partialData.key;
    if (!partialData.encrypted || !encryptedKey || !partialData.iv || !partialData.version) {
      return response.badRequest('Invalid encrypted payload structure', headers);
    }

    // Normalize payload to use encryptedKey
    if (partialData.key && !partialData.encryptedKey) {
      partialData.encryptedKey = partialData.key;
      delete partialData.key;
    }

    // Validate email if email resume is enabled and email provided
    if (email && form.settings.saveProgress.emailResume) {
      if (!isValidEmail(email)) {
        return response.badRequest('Invalid email address', headers);
      }
    }

    // Get partial submissions store
    const store = getStore({ name: PARTIAL_SUBMISSIONS_STORE, consistency: 'strong' });

    // Generate unique resume token
    const resumeToken = generateResumeToken();

    // Calculate expiry
    const expiryHours = form.settings.saveProgress.expiryHours || 72;
    const expiresAt = calculateExpiry(expiryHours);

    // Build partial submission record
    const partialSubmission = {
      resumeToken,
      formId,
      partialData, // Already encrypted by SDK
      email: email || null,
      createdAt: Date.now(),
      expiresAt,
      meta: {
        sdkVersion: meta?.sdkVersion || 'unknown',
        userAgent: req.headers.get('user-agent')?.substring(0, 200) || 'unknown',
        region: context.geo?.country || 'unknown',
        ...meta
      }
    };

    // Store partial submission
    await store.setJSON(resumeToken, partialSubmission);

    // Update index for this form (for cleanup)
    await updatePartialIndex(store, formId, resumeToken);

    // Generate resume URL
    const baseUrl = process.env.URL || 'https://veilforms.com';
    const resumeUrl = `${baseUrl}/resume/${resumeToken}`;

    // Send resume email if email provided and enabled
    let emailSent = false;
    if (email && form.settings.saveProgress.emailResume) {
      try {
        await sendResumeEmail(email, resumeUrl, form.name, expiryHours);
        emailSent = true;
      } catch (err) {
        console.error('Failed to send resume email:', err.message);
        // Don't fail the request if email fails
      }
    }

    return response.success({
      success: true,
      resumeToken,
      resumeUrl,
      expiresAt,
      emailSent
    }, headers);
  } catch (error) {
    console.error('Save progress error:', error);

    return response.serverError(headers, 'Failed to save progress');
  }
}

/**
 * Update partial submission index for cleanup
 */
async function updatePartialIndex(store, formId, resumeToken) {
  const indexKey = `_index_${formId}`;

  try {
    let index = await store.get(indexKey, { type: 'json' }) || { tokens: [] };

    // Add new token to index
    index.tokens.unshift({
      token: resumeToken,
      ts: Date.now()
    });

    // Keep index manageable and enforce limits
    if (index.tokens.length > MAX_PARTIAL_SUBMISSIONS) {
      // Remove oldest tokens
      const tokensToRemove = index.tokens.slice(MAX_PARTIAL_SUBMISSIONS);
      for (const item of tokensToRemove) {
        await store.delete(item.token).catch(() => {});
      }
      index.tokens = index.tokens.slice(0, MAX_PARTIAL_SUBMISSIONS);
    }

    await store.setJSON(indexKey, index);
  } catch (e) {
    console.warn('Partial index update failed:', e);
  }
}

export const config = {
  path: '/api/save-progress'
};
