import crypto from 'crypto';
import { getUser, createPasswordResetToken } from './lib/storage.js';
import { sendPasswordResetEmail } from './lib/email.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';

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

  // Stricter rate limit for password reset (3 per minute)
  const rateLimit = checkRateLimit(req, { keyPrefix: 'forgot', maxRequests: 3 });
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
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Always return success to prevent email enumeration
    const successResponse = () => new Response(JSON.stringify({
      success: true,
      message: 'If an account with that email exists, we sent a password reset link.'
    }), {
      status: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });

    // Check if user exists (silently)
    const user = await getUser(email);
    if (!user) {
      // Return success even if user doesn't exist (security)
      return successResponse();
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Store token
    await createPasswordResetToken(email, token);

    // Build reset URL
    const baseUrl = process.env.URL || 'https://veilforms.com';
    const resetUrl = `${baseUrl}/reset/?token=${token}`;

    // Send email
    try {
      await sendPasswordResetEmail(email, resetUrl);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Password reset email sent to ${email}`);
      }
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Still return success to prevent enumeration
    }

    return successResponse();
  } catch (err) {
    console.error('Forgot password error:', err);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/forgot'
};
