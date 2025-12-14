import { getCorsHeaders } from './lib/cors.js';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.URL}/api/auth/callback/google`;

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (!GOOGLE_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Store state in cookie for verification on callback
  const stateCookie = `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;

  // Build Google authorization URL
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'email profile',
    state: state,
    access_type: 'offline',
    prompt: 'consent'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

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
  path: '/api/auth/google'
};
