import { getEmailVerificationToken, deleteEmailVerificationToken, updateUser, getUser } from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  // Rate limit
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'verify', maxRequests: 10 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests({ ...headers, ...getRateLimitHeaders(rateLimit) }, rateLimit.retryAfter);
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
      return response.methodNotAllowed(headers);
    }

    if (!token) {
      return response.badRequest('Verification token is required', { ...headers, ...getRateLimitHeaders(rateLimit) });
    }

    // Validate token
    const tokenData = await getEmailVerificationToken(token);
    if (!tokenData) {
      return response.error(
        'Invalid or expired verification link',
        { ...headers, ...getRateLimitHeaders(rateLimit) },
        400,
        { expired: true }
      );
    }

    // Get user to check if already verified
    const user = await getUser(tokenData.email);
    if (!user) {
      return response.notFound('User not found', { ...headers, ...getRateLimitHeaders(rateLimit) });
    }

    if (user.emailVerified) {
      // Already verified, delete token and return success
      await deleteEmailVerificationToken(token);
      return response.success({
        success: true,
        message: 'Email already verified',
        alreadyVerified: true
      }, { ...headers, ...getRateLimitHeaders(rateLimit) });
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

    return response.success({
      success: true,
      message: 'Email verified successfully'
    }, { ...headers, ...getRateLimitHeaders(rateLimit) });
  } catch (err) {
    console.error('Verify email error:', err);
    return response.serverError(headers, 'Verification failed');
  }
}

export const config = {
  path: '/api/auth/verify'
};
