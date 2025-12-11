/**
 * VeilForms - Netlify Function for Listing/Reading Submissions
 * Requires API key authentication
 */

import { getStore } from '@netlify/blobs';

export default async function handler(req, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  // Authenticate
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'API key required' }),
      { status: 401, headers }
    );
  }

  // Validate API key against stored keys (simple check for MVP)
  const validKey = await validateApiKey(apiKey);
  if (!validKey) {
    return new Response(
      JSON.stringify({ error: 'Invalid API key' }),
      { status: 403, headers }
    );
  }

  try {
    const url = new URL(req.url);
    const formId = url.searchParams.get('formId');
    const submissionId = url.searchParams.get('id');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    if (!formId || !/^[a-zA-Z0-9_-]+$/.test(formId)) {
      return new Response(
        JSON.stringify({ error: 'Valid formId required' }),
        { status: 400, headers }
      );
    }

    // Check tenant has access to this form
    if (!validKey.forms.includes(formId) && !validKey.forms.includes('*')) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this form' }),
        { status: 403, headers }
      );
    }

    const store = getStore(`veilforms-${formId}`);

    // Single submission lookup
    if (submissionId) {
      const submission = await store.get(submissionId, { type: 'json' });

      if (!submission) {
        return new Response(
          JSON.stringify({ error: 'Submission not found' }),
          { status: 404, headers }
        );
      }

      return new Response(
        JSON.stringify({ submission }),
        { status: 200, headers }
      );
    }

    // List submissions
    const index = await store.get('_index', { type: 'json' }) || { submissions: [] };
    const total = index.submissions.length;
    const slice = index.submissions.slice(offset, offset + limit);

    // Fetch full submissions
    const submissions = await Promise.all(
      slice.map(async ({ id }) => {
        const sub = await store.get(id, { type: 'json' });
        return sub;
      })
    );

    return new Response(
      JSON.stringify({
        formId,
        submissions: submissions.filter(Boolean),
        total,
        limit,
        offset,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('List error:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
}

/**
 * Validate API key and return tenant info
 * MVP: Uses environment variable, upgrade to DB later
 */
async function validateApiKey(apiKey) {
  // For MVP, store keys in env as JSON
  // Format: { "key123": { "tenantId": "tenant1", "forms": ["form1", "form2"] } }
  const keysJson = process.env.VEILFORMS_API_KEYS || '{}';

  try {
    const keys = JSON.parse(keysJson);
    return keys[apiKey] || null;
  } catch {
    return null;
  }
}

export const config = {
  path: '/api/submissions',
};
