import crypto from 'crypto';
import { getUser, createEmailVerificationToken, getEmailVerificationTokenByEmail, deleteEmailVerificationToken } from './lib/storage.js';
import { sendEmailVerification } from './lib/email.js';
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

  // Strict rate limit for resend (2 per minute)
  const rateLimit = checkRateLimit(req, { keyPrefix: 'resend-verify', maxRequests: 2 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many requests. Please wait before requesting another verification email.',
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
      message: 'If an unverified account exists, we sent a new verification email.'
    }), {
      status: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });

    // Get user
    const user = await getUser(email);
    if (!user) {
      return successResponse();
    }

    // Check if already verified
    if (user.emailVerified) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true
      }), {
        status: 200,
        headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
      });
    }

    // Delete existing token if any
    const existingToken = await getEmailVerificationTokenByEmail(email);
    if (existingToken) {
      await deleteEmailVerificationToken(existingToken.token);
    }

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    await createEmailVerificationToken(email, token);

    // Build verification URL
    const baseUrl = process.env.URL || 'https://veilforms.com';
    const verifyUrl = `${baseUrl}/verify/?token=${token}`;

    // Send email
    try {
      await sendEmailVerification(email, verifyUrl);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    return successResponse();
  } catch (err) {
    console.error('Resend verification error:', err);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/resend-verification'
};
