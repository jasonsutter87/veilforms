/**
 * VeilForms - Audit Logs Endpoint
 * GET /api/audit-logs - List user's audit logs
 * GET /api/audit-logs?formId=xxx - List form-specific logs
 */

import { authenticateRequest } from './lib/auth.js';
import { getAuditLogs, getFormAuditLogs } from './lib/audit.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { getForm } from './lib/storage.js';

// CORS headers
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  // Rate limit
  const rateLimit = checkRateLimit(req, { keyPrefix: 'audit-logs', maxRequests: 30 });
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

  try {
    const url = new URL(req.url);
    const formId = url.searchParams.get('formId');
    const eventType = url.searchParams.get('event');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // If formId specified, verify ownership
    if (formId) {
      const form = await getForm(formId);
      if (!form || form.userId !== auth.user.id) {
        return new Response(JSON.stringify({ error: 'Form not found or access denied' }), {
          status: 404,
          headers
        });
      }

      const result = await getFormAuditLogs(auth.user.id, formId, limit);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers
      });
    }

    // Get all audit logs for user
    const result = await getAuditLogs(auth.user.id, limit, offset, eventType);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/audit-logs'
};
