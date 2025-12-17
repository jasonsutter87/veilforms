/**
 * VeilForms - CSRF Token Endpoint
 * GET /api/csrf-token - Get CSRF token for authenticated requests
 */

import { authenticateRequest } from './lib/auth.js';
import { getCorsHeaders } from './lib/cors.js';
import { generateCsrfToken, getCsrfHeaders } from './lib/csrf.js';
import * as response from './lib/responses.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  if (req.method !== 'GET') {
    return response.methodNotAllowed(headers);
  }

  // Authenticate - only authenticated users can get CSRF tokens
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return response.error(auth.error, headers, auth.status);
  }

  // Generate new CSRF token
  const token = generateCsrfToken();
  const csrfHeaders = getCsrfHeaders(token);

  return response.success(
    {
      csrfToken: token,
      expiresIn: 3600 // 1 hour in seconds
    },
    { ...headers, ...csrfHeaders }
  );
}

export const config = {
  path: '/api/csrf-token'
};
