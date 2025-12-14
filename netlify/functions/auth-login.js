import { verifyPassword, createToken } from './lib/auth.js';
import { getUser } from './lib/storage.js';
import {
  checkRateLimit,
  getRateLimitHeaders,
  recordFailedAttempt,
  clearFailedAttempts,
  isAccountLocked
} from './lib/rate-limit.js';
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';
import { errorResponse, ErrorCodes } from './lib/errors.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'login' });
  if (!rateLimit.allowed) {
    return response.tooManyRequests({ ...headers, ...getRateLimitHeaders(rateLimit) }, rateLimit.retryAfter);
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse(ErrorCodes.VALIDATION_MISSING_FIELD, { ...headers, ...getRateLimitHeaders(rateLimit) }, {
        details: { required: ['email', 'password'] }
      });
    }

    // Check account lockout
    const lockout = await isAccountLocked(email);
    if (lockout.locked) {
      return response.error(
        `Account temporarily locked. Try again in ${lockout.remainingMinutes} minutes.`,
        { ...headers, ...getRateLimitHeaders(rateLimit) },
        423,
        { lockedMinutes: lockout.remainingMinutes }
      );
    }

    // Get user
    const user = await getUser(email);
    if (!user) {
      // Record failed attempt (even for non-existent users to prevent enumeration)
      await recordFailedAttempt(email);
      return errorResponse(ErrorCodes.AUTH_INVALID_CREDENTIALS, { ...headers, ...getRateLimitHeaders(rateLimit) });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempt = await recordFailedAttempt(email);
      const remaining = 5 - attempt.count;

      return errorResponse(ErrorCodes.AUTH_INVALID_CREDENTIALS, { ...headers, ...getRateLimitHeaders(rateLimit) }, {
        details: remaining > 0 && remaining <= 3 ? { attemptsRemaining: remaining } : {}
      });
    }

    // Success - clear any failed attempts
    await clearFailedAttempts(email);

    // Check email verification status
    if (!user.emailVerified) {
      return errorResponse(ErrorCodes.AUTH_EMAIL_NOT_VERIFIED, { ...headers, ...getRateLimitHeaders(rateLimit) }, {
        details: { email: user.email }
      });
    }

    // Create JWT token
    const token = createToken({ id: user.id, email: user.email });

    return response.success({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription,
        emailVerified: user.emailVerified
      }
    }, { ...headers, ...getRateLimitHeaders(rateLimit) });
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse(ErrorCodes.SERVER_ERROR, headers, {
      message: 'Login failed'
    });
  }
}

export const config = {
  path: '/api/auth/login'
};
