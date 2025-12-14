/**
 * VeilForms - Audit Logs Endpoint
 * GET /api/audit-logs - List user's audit logs
 * GET /api/audit-logs?formId=xxx - List form-specific logs
 */

import { authenticateRequest } from './lib/auth.js';
import { getAuditLogs, getFormAuditLogs } from './lib/audit.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { getForm } from './lib/storage.js';
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin, {
    methods: ['GET', 'OPTIONS']
  });

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  if (req.method !== 'GET') {
    return response.methodNotAllowed(headers);
  }

  // Rate limit
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'audit-logs', maxRequests: 30 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests(
      { ...headers, ...getRateLimitHeaders(rateLimit) },
      rateLimit.retryAfter
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return response.error(auth.error, headers, auth.status);
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
        return response.notFound('Form not found or access denied', headers);
      }

      const result = await getFormAuditLogs(auth.user.id, formId, limit);
      return response.success(result, headers);
    }

    // Get all audit logs for user
    const result = await getAuditLogs(auth.user.id, limit, offset, eventType);

    return response.success(result, headers);
  } catch (err) {
    console.error('Audit logs error:', err);
    return response.serverError(headers);
  }
}

export const config = {
  path: '/api/audit-logs'
};
