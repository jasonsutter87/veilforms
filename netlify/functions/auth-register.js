import crypto from 'crypto';
import { hashPassword, createToken, validatePassword, PASSWORD_REQUIREMENTS } from './lib/auth.js';
import { createUser, getUser, createEmailVerificationToken } from './lib/storage.js';
import { sendEmailVerification } from './lib/email.js';

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

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers
      });
    }

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return new Response(JSON.stringify({
        error: 'Password does not meet requirements',
        details: passwordCheck.errors,
        requirements: PASSWORD_REQUIREMENTS
      }), {
        status: 400,
        headers
      });
    }

    // Check if user exists
    const existing = await getUser(email);
    if (existing) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
        status: 409,
        headers
      });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);

    // Create email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await createEmailVerificationToken(email, verificationToken);

    // Build verification URL
    const baseUrl = process.env.URL || 'https://veilforms.com';
    const verifyUrl = `${baseUrl}/verify/?token=${verificationToken}`;

    // Send verification email (don't await - fire and forget)
    sendEmailVerification(email, verifyUrl).catch(err => {
      console.error('Verification email failed:', err);
    });

    // Create JWT token (user can still get token, but login will check verification)
    const token = createToken({ id: user.id, email: user.email });

    return new Response(JSON.stringify({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription,
        emailVerified: false
      },
      message: 'Please check your email to verify your account'
    }), {
      status: 201,
      headers
    });
  } catch (err) {
    console.error('Register error:', err);
    return new Response(JSON.stringify({ error: 'Registration failed' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/register'
};
