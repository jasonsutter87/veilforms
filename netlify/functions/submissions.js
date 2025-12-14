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
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';
import { isValidFormId, isValidSubmissionId, parseUrlPath } from './lib/validation.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin, { methods: ['GET', 'DELETE', 'OPTIONS'] });

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  // Rate limit
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'submissions-api', maxRequests: 60 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests({ ...headers, ...getRateLimitHeaders(rateLimit) }, rateLimit.retryAfter);
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return response.error(auth.error, headers, auth.status);
  }

  // Parse URL to get formId and optional submissionId
  const pathParts = parseUrlPath(req.url, '/api/submissions/');
  const formId = pathParts[0];
  const submissionId = pathParts[1];

  // Validate formId
  if (!isValidFormId(formId)) {
    return response.badRequest('Valid formId required', headers);
  }

  // Get form and verify ownership
  const form = await getForm(formId);
  if (!form) {
    return response.notFound('Form not found', headers);
  }

  if (form.userId !== auth.user.id) {
    return response.forbidden('Access denied', headers);
  }

  try {
    // Route based on method
    if (req.method === 'GET') {
      return submissionId
        ? handleGetSingle(formId, submissionId, headers)
        : handleList(formId, new URL(req.url).searchParams, headers);
    }

    if (req.method === 'DELETE') {
      return submissionId
        ? handleDeleteSingle(formId, submissionId, form, headers)
        : handleDeleteAll(formId, form, headers);
    }

    return response.methodNotAllowed(headers);
  } catch (err) {
    console.error('Submissions error:', err);
    return response.serverError(headers);
  }
}

/**
 * GET single submission
 */
async function handleGetSingle(formId, submissionId, headers) {
  // Validate submissionId format
  if (!isValidSubmissionId(submissionId)) {
    return response.badRequest('Invalid submission ID format', headers);
  }

  const submission = await getSubmission(formId, submissionId);
  if (!submission) {
    return response.notFound('Submission not found', headers);
  }

  return response.success({ submission }, headers);
}

/**
 * GET list of submissions with pagination and filtering
 */
async function handleList(formId, params, headers) {
  const limit = Math.min(parseInt(params.get('limit') || '50', 10), 100);
  const offset = parseInt(params.get('offset') || '0', 10);
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

  return response.success({
    formId,
    submissions: result.submissions,
    pagination: { total: result.total, limit, offset, hasMore, nextCursor }
  }, headers);
}

/**
 * DELETE single submission
 */
async function handleDeleteSingle(formId, submissionId, form, headers) {
  // Validate submissionId format
  if (!isValidSubmissionId(submissionId)) {
    return response.badRequest('Invalid submission ID format', headers);
  }

  // Check submission exists
  const submission = await getSubmission(formId, submissionId);
  if (!submission) {
    return response.notFound('Submission not found', headers);
  }

  await deleteSubmission(formId, submissionId);

  // Decrement form submission count
  await updateForm(formId, {
    submissionCount: Math.max((form.submissionCount || 1) - 1, 0)
  });

  return response.success({ success: true, deleted: submissionId }, headers);
}

/**
 * DELETE all submissions for a form
 */
async function handleDeleteAll(formId, form, headers) {
  const deletedCount = await deleteAllSubmissions(formId);

  // Reset form submission count
  await updateForm(formId, { submissionCount: 0 });

  return response.success({ success: true, deletedCount }, headers);
}

export const config = {
  path: '/api/submissions/*'
};
