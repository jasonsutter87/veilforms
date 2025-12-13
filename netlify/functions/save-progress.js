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
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  // Rate limit (20 per hour per IP to prevent abuse)
  const rateLimit = checkRateLimit(req, { keyPrefix: 'save-progress', maxRequests: 20, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many save requests. Please try again later.',
      retryAfter: rateLimit.retryAfter
    }), {
      status: 429,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });
  }

  try {
    const body = await req.json();
    const { formId, partialData, email, meta } = body;

    // Validate required fields
    if (!formId || !partialData) {
      return new Response(JSON.stringify({ error: 'Missing required fields: formId, partialData' }), {
        status: 400,
        headers
      });
    }

    // Validate formId format
    if (!/^vf_[a-z0-9_]+$/i.test(formId)) {
      return new Response(JSON.stringify({ error: 'Invalid form ID format' }), {
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

    // Check if save progress is enabled for this form
    if (!form.settings?.saveProgress?.enabled) {
      return new Response(JSON.stringify({ error: 'Save progress feature not enabled for this form' }), {
        status: 403,
        headers
      });
    }

    // Validate encrypted partial data structure
    const encryptedKey = partialData.encryptedKey || partialData.key;
    if (!partialData.encrypted || !encryptedKey || !partialData.iv || !partialData.version) {
      return new Response(JSON.stringify({ error: 'Invalid encrypted payload structure' }), {
        status: 400,
        headers
      });
    }

    // Normalize payload to use encryptedKey
    if (partialData.key && !partialData.encryptedKey) {
      partialData.encryptedKey = partialData.key;
      delete partialData.key;
    }

    // Validate email if email resume is enabled and email provided
    if (email && form.settings.saveProgress.emailResume) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: 'Invalid email address' }), {
          status: 400,
          headers
        });
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

    return new Response(JSON.stringify({
      success: true,
      resumeToken,
      resumeUrl,
      expiresAt,
      emailSent
    }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Save progress error:', error);

    return new Response(JSON.stringify({ error: 'Failed to save progress' }), {
      status: 500,
      headers
    });
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
