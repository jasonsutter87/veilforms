/**
 * VeilForms - Health Check Endpoint
 * GET /api/health - Basic health check for monitoring
 */

import * as response from './lib/responses.js';

export default async function handler(req, context) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return response.methodNotAllowed({ 'Content-Type': 'application/json' });
  }

  // Basic health check response
  return response.success({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'veilforms',
    version: '1.0.0'
  }, { 'Content-Type': 'application/json' });
}

export const config = {
  path: '/api/health'
};
