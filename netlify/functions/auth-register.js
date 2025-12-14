import crypto from 'crypto';
import { hashPassword, createToken, validatePassword, PASSWORD_REQUIREMENTS } from './lib/auth.js';
import { createUser, getUser, createEmailVerificationToken } from './lib/storage.js';
import { sendEmailVerification } from './lib/email.js';
import { checkEmailRateLimit, getEmailRateLimitHeaders } from './lib/email-rate-limit.js';
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return response.badRequest('Email and password required', headers);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return response.badRequest('Invalid email format', headers);
    }

    // Check email rate limit (5 verification emails per hour)
    const rateLimit = await checkEmailRateLimit(email, 'verification');
    if (!rateLimit.allowed) {
      const rateLimitHeaders = {
        ...headers,
        ...getEmailRateLimitHeaders(rateLimit, 'verification')
      };
      return response.error(
        rateLimit.message,
        rateLimitHeaders,
        429,
        {
          retryAfter: rateLimit.retryAfter,
          resetAt: new Date(rateLimit.resetAt).toISOString()
        }
      );
    }

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return response.error(
        'Password does not meet requirements',
        headers,
        400,
        { details: passwordCheck.errors, requirements: PASSWORD_REQUIREMENTS }
      );
    }

    // Check if user exists
    const existing = await getUser(email);
    if (existing) {
      return response.error('Email already registered', headers, 409);
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

    return response.created({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription,
        emailVerified: false
      },
      message: 'Please check your email to verify your account'
    }, headers);
  } catch (err) {
    console.error('Register error:', err);
    return response.serverError(headers, 'Registration failed');
  }
}

export const config = {
  path: '/api/auth/register'
};
