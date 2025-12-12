import { verifyPassword, createToken } from './lib/auth.js';
import { getUser } from './lib/storage.js';
import {
  checkRateLimit,
  getRateLimitHeaders,
  recordFailedAttempt,
  clearFailedAttempts,
  isAccountLocked
} from './lib/rate-limit.js';

// CORS: Configure allowed origins (set ALLOWED_ORIGINS env var for production)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  // Check rate limit
  const rateLimit = checkRateLimit(req, { keyPrefix: 'login' });
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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Check account lockout
    const lockout = isAccountLocked(email);
    if (lockout.locked) {
      return new Response(JSON.stringify({
        error: `Account temporarily locked. Try again in ${lockout.remainingMinutes} minutes.`,
        lockedMinutes: lockout.remainingMinutes
      }), {
        status: 423,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Get user
    const user = await getUser(email);
    if (!user) {
      // Record failed attempt (even for non-existent users to prevent enumeration)
      recordFailedAttempt(email);
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempt = recordFailedAttempt(email);
      const remaining = 5 - attempt.count;

      return new Response(JSON.stringify({
        error: 'Invalid credentials',
        ...(remaining > 0 && remaining <= 3 ? { attemptsRemaining: remaining } : {})
      }), {
        status: 401,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Success - clear any failed attempts
    clearFailedAttempts(email);

    // Create JWT token
    const token = createToken({ id: user.id, email: user.email });

    return new Response(JSON.stringify({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription
      }
    }), {
      status: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });
  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/login'
};
