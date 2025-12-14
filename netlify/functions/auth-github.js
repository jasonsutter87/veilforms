import { getCorsHeaders } from './lib/cors.js';

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `${process.env.URL}/api/auth/callback/github`;

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (!GITHUB_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'GitHub OAuth not configured' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Store state in cookie for verification on callback
  const stateCookie = `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;

  // Build GitHub authorization URL
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'user:email',
    state: state
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params}`;

  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      'Location': authUrl,
      'Set-Cookie': stateCookie
    }
  });
}

export const config = {
  path: '/api/auth/github'
};
