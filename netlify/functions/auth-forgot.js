import crypto from 'crypto';
import { getUser, createPasswordResetToken } from './lib/storage.js';
import { sendPasswordResetEmail } from './lib/email.js';
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

  // Stricter rate limit for password reset (3 per minute)
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'forgot', maxRequests: 3 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests({ ...headers, ...getRateLimitHeaders(rateLimit) }, rateLimit.retryAfter);
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return response.badRequest('Email is required', { ...headers, ...getRateLimitHeaders(rateLimit) });
    }

    // Check email-specific rate limit (3 per hour per email for password resets)
    const emailRateLimit = await checkEmailRateLimit(email, 'passwordReset');
    if (!emailRateLimit.allowed) {
      const emailRateLimitHeaders = {
        ...headers,
        ...getRateLimitHeaders(rateLimit),
        ...getEmailRateLimitHeaders(emailRateLimit, 'passwordReset')
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
      message: 'If an account with that email exists, we sent a password reset link.'
    }, { ...headers, ...getRateLimitHeaders(rateLimit) });

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
    return response.serverError(headers, 'An error occurred');
  }
}

export const config = {
  path: '/api/auth/forgot'
};
