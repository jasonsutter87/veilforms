import crypto from 'crypto';
import { getUser, createEmailVerificationToken, getEmailVerificationTokenByEmail, deleteEmailVerificationToken } from './lib/storage.js';
import { sendEmailVerification } from './lib/email.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
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

  // Strict rate limit for resend (2 per minute)
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'resend-verify', maxRequests: 2 });
  if (!rateLimit.allowed) {
    return response.error(
      'Too many requests. Please wait before requesting another verification email.',
      { ...headers, ...getRateLimitHeaders(rateLimit) },
      429,
      { retryAfter: rateLimit.retryAfter }
    );
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return response.badRequest('Email is required', { ...headers, ...getRateLimitHeaders(rateLimit) });
    }

    // Check email-specific rate limit (5 per hour per email)
    const emailRateLimit = await checkEmailRateLimit(email, 'verification');
    if (!emailRateLimit.allowed) {
      const emailRateLimitHeaders = {
        ...headers,
        ...getRateLimitHeaders(rateLimit),
        ...getEmailRateLimitHeaders(emailRateLimit, 'verification')
      };
      return response.error(
        emailRateLimit.message,
        emailRateLimitHeaders,
        429,
        {
          retryAfter: emailRateLimit.retryAfter,
          resetAt: new Date(emailRateLimit.resetAt).toISOString()
        }
      );
    }

    // Always return success to prevent email enumeration
    const successResponse = () => response.success({
      success: true,
      message: 'If an unverified account exists, we sent a new verification email.'
    }, { ...headers, ...getRateLimitHeaders(rateLimit) });

    // Get user
    const user = await getUser(email);
    if (!user) {
      return successResponse();
    }

    // Check if already verified
    if (user.emailVerified) {
      return response.success({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true
      }, { ...headers, ...getRateLimitHeaders(rateLimit) });
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
    return response.serverError(headers, 'An error occurred');
  }
}

export const config = {
  path: '/api/auth/resend-verification'
};
