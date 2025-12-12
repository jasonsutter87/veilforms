import { verifyToken, getTokenFromHeader } from './lib/auth.js';

// CORS: Configure allowed origins (set ALLOWED_ORIGINS env var for production)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// In-memory token blacklist (resets on cold start)
// For production, use Redis or database
const tokenBlacklist = new Set();

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    const token = getTokenFromHeader(req.headers);

    if (!token) {
      return new Response(JSON.stringify({ error: 'No token provided' }), {
        status: 401,
        headers
      });
    }

    // Verify token is valid before blacklisting
    const decoded = verifyToken(token);
    if (!decoded) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers
      });
    }

    // Add to blacklist
    tokenBlacklist.add(token);

    // Clean up blacklist periodically (keep max 10000 entries)
    if (tokenBlacklist.size > 10000) {
      const entries = Array.from(tokenBlacklist);
      entries.slice(0, 5000).forEach(t => tokenBlacklist.delete(t));
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('Logout error:', err);
    return new Response(JSON.stringify({ error: 'Logout failed' }), {
      status: 500,
      headers
    });
  }
}

// Export blacklist check for use in other endpoints
export function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

export const config = {
  path: '/api/auth/logout'
};
