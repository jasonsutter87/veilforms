/**
 * VeilForms - Submissions Management Endpoint
 * GET /api/submissions/:formId - List submissions
 * GET /api/submissions/:formId/:id - Get single submission
 * DELETE /api/submissions/:formId/:id - Delete submission
 * DELETE /api/submissions/:formId - Bulk delete all
 */

import { authenticateRequest } from './lib/auth.js';
import { getForm, getSubmissions, getSubmission, deleteSubmission, deleteAllSubmissions, updateForm } from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';

// CORS headers
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Rate limit
  const rateLimit = checkRateLimit(req, { keyPrefix: 'submissions-api', maxRequests: 60 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter: rateLimit.retryAfter
    }), {
      status: 429,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });
  }

  // Authenticate
  const auth = authenticateRequest(req);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers
    });
  }

  // Parse URL to get formId and optional submissionId
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/api/submissions/', '').split('/').filter(Boolean);
  const formId = pathParts[0];
  const submissionId = pathParts[1];

  // Validate formId
  if (!formId || !/^vf_[a-z0-9_]+$/i.test(formId)) {
    return new Response(JSON.stringify({ error: 'Valid formId required' }), {
      status: 400,
      headers
    });
  }

  // Get form and verify ownership
  const form = await getForm(formId);
  if (!form) {
    return new Response(JSON.stringify({ error: 'Form not found' }), {
      status: 404,
      headers
    });
  }

  if (form.userId !== auth.user.id) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers
    });
  }

  try {
    // Route based on method
    if (req.method === 'GET') {
      return submissionId
        ? handleGetSingle(formId, submissionId, headers)
        : handleList(formId, url.searchParams, headers);
    }

    if (req.method === 'DELETE') {
      return submissionId
        ? handleDeleteSingle(formId, submissionId, form, headers)
        : handleDeleteAll(formId, form, headers);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  } catch (err) {
    console.error('Submissions error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers
    });
  }
}

/**
 * GET single submission
 */
async function handleGetSingle(formId, submissionId, headers) {
  // Validate submissionId format
  if (!/^(vf-[a-f0-9-]{36}|[a-f0-9]{32})$/.test(submissionId)) {
    return new Response(JSON.stringify({ error: 'Invalid submission ID format' }), {
      status: 400,
      headers
    });
  }

  const submission = await getSubmission(formId, submissionId);
  if (!submission) {
    return new Response(JSON.stringify({ error: 'Submission not found' }), {
      status: 404,
      headers
    });
  }

  return new Response(JSON.stringify({ submission }), {
    status: 200,
    headers
  });
}

/**
 * GET list of submissions with pagination and filtering
 */
async function handleList(formId, params, headers) {
  const limit = Math.min(parseInt(params.get('limit') || '50', 10), 100);
  const offset = parseInt(params.get('offset') || '0', 10);
  const cursor = params.get('cursor'); // For cursor-based pagination
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');

  let result = await getSubmissions(formId, limit + 1, offset); // Fetch one extra to check for more

  // Apply date filtering if specified
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Infinity;

    result.submissions = result.submissions.filter(s => {
      const ts = s.timestamp || s.receivedAt;
      return ts >= start && ts <= end;
    });
  }

  // Determine if there are more results
  const hasMore = result.submissions.length > limit;
  if (hasMore) {
    result.submissions = result.submissions.slice(0, limit);
  }

  // Generate next cursor
  const nextCursor = hasMore && result.submissions.length > 0
    ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString('base64')
    : null;

  return new Response(JSON.stringify({
    formId,
    submissions: result.submissions,
    pagination: {
      total: result.total,
      limit,
      offset,
      hasMore,
      nextCursor
    }
  }), {
    status: 200,
    headers
  });
}

/**
 * DELETE single submission
 */
async function handleDeleteSingle(formId, submissionId, form, headers) {
  // Validate submissionId format
  if (!/^(vf-[a-f0-9-]{36}|[a-f0-9]{32})$/.test(submissionId)) {
    return new Response(JSON.stringify({ error: 'Invalid submission ID format' }), {
      status: 400,
      headers
    });
  }

  // Check submission exists
  const submission = await getSubmission(formId, submissionId);
  if (!submission) {
    return new Response(JSON.stringify({ error: 'Submission not found' }), {
      status: 404,
      headers
    });
  }

  await deleteSubmission(formId, submissionId);

  // Decrement form submission count
  await updateForm(formId, {
    submissionCount: Math.max((form.submissionCount || 1) - 1, 0)
  });

  return new Response(JSON.stringify({
    success: true,
    deleted: submissionId
  }), {
    status: 200,
    headers
  });
}

/**
 * DELETE all submissions for a form
 */
async function handleDeleteAll(formId, form, headers) {
  const deletedCount = await deleteAllSubmissions(formId);

  // Reset form submission count
  await updateForm(formId, {
    submissionCount: 0
  });

  return new Response(JSON.stringify({
    success: true,
    deletedCount
  }), {
    status: 200,
    headers
  });
}

export const config = {
  path: '/api/submissions/*'
};
