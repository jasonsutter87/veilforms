import { getEmailVerificationToken, deleteEmailVerificationToken, updateUser, getUser } from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';

// CORS: Configure allowed origins (set ALLOWED_ORIGINS env var for production)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
  const rateLimit = checkRateLimit(req, { keyPrefix: 'verify', maxRequests: 10 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter: rateLimit.retryAfter
    }), {
      status: 429,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });
  }

  try {
    // Get token from query string (GET) or body (POST)
    let token;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    } else if (req.method === 'POST') {
      const body = await req.json();
      token = body.token;
    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'Verification token is required' }), {
        status: 400,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Validate token
    const tokenData = await getEmailVerificationToken(token);
    if (!tokenData) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired verification link',
        expired: true
      }), {
        status: 400,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Get user to check if already verified
    const user = await getUser(tokenData.email);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    if (user.emailVerified) {
      // Already verified, delete token and return success
      await deleteEmailVerificationToken(token);
      return new Response(JSON.stringify({
        success: true,
        message: 'Email already verified',
        alreadyVerified: true
      }), {
        status: 200,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Mark email as verified
    await updateUser(tokenData.email, {
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString()
    });

    // Delete the used token (one-time use)
    await deleteEmailVerificationToken(token);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Email verified for ${tokenData.email}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Email verified successfully'
    }), {
      status: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });
  } catch (err) {
    console.error('Verify email error:', err);
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/verify'
};
