/**
 * VeilForms - Health Check Endpoint
 * GET /api/health - Basic health check for monitoring
 */

export default async function handler(req, context) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Basic health check response
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'veilforms',
    version: '1.0.0'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const config = {
  path: '/api/health'
};
