/**
 * VeilForms - Netlify Function for Form Submissions
 * Stores encrypted submissions in Netlify Blob
 */

import { getStore } from '@netlify/blobs';

export default async function handler(req, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    const body = await req.json();
    const { formId, submissionId, payload, timestamp, meta } = body;

    // Validate required fields
    if (!formId || !submissionId || !payload) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers }
      );
    }

    // Validate formId format (prevent path traversal)
    if (!/^[a-zA-Z0-9_-]+$/.test(formId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid form ID' }),
        { status: 400, headers }
      );
    }

    // Get blob store for this form
    const store = getStore(`veilforms-${formId}`);

    // Build submission record
    const submission = {
      submissionId,
      payload,
      timestamp: timestamp || Date.now(),
      receivedAt: Date.now(),
      meta: {
        ...meta,
        // Add server-side metadata (non-PII)
        region: context.geo?.country || 'unknown',
      },
    };

    // Store submission (key = submissionId)
    await store.setJSON(submissionId, submission);

    // Update submission index for listing
    await updateIndex(store, submissionId, timestamp);

    return new Response(
      JSON.stringify({
        success: true,
        submissionId,
        timestamp: submission.timestamp,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Submission error:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
}

/**
 * Update submission index for efficient listing
 */
async function updateIndex(store, submissionId, timestamp) {
  const indexKey = '_index';

  try {
    let index = await store.get(indexKey, { type: 'json' }) || { submissions: [] };

    // Add new submission to index
    index.submissions.unshift({
      id: submissionId,
      ts: timestamp,
    });

    // Keep index manageable (last 10000 entries)
    if (index.submissions.length > 10000) {
      index.submissions = index.submissions.slice(0, 10000);
    }

    await store.setJSON(indexKey, index);
  } catch (e) {
    // Index update failure shouldn't block submission
    console.warn('Index update failed:', e);
  }
}

export const config = {
  path: '/api/submit',
};
