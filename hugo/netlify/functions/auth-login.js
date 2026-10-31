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

    // SECURITY FIX (VULN-003): Constant-time authentication
    // Prevents username enumeration via timing attacks
    const user = await getUser(email);

    let isValid = false;

    if (user) {
      // User exists - verify password (bcrypt takes ~250ms)
      isValid = await verifyPassword(password, user.passwordHash);
    } else {
      // User doesn't exist - perform dummy hash to maintain constant time
      // Use a known dummy hash to ensure consistent timing
      const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdY5aUFq3n/qXZq';
      await verifyPassword(password, DUMMY_HASH);
    }

    // Always record failed attempt (even for non-existent users)
    if (!isValid) {
      const attempt = await recordFailedAttempt(email);
      const remaining = 5 - attempt.count;

      // Generic error - don't reveal if user exists
      return errorResponse(ErrorCodes.AUTH_INVALID_CREDENTIALS, {
        ...headers,
        ...getRateLimitHeaders(rateLimit)
      }, {
        details: remaining > 0 && remaining <= 3 ? { attemptsRemaining: remaining } : {}
      });
    }

    // Clear failed attempts only on successful login
    await clearFailedAttempts(email);

    // SECURITY FIX (VULN-007): Enforce email verification
    // Prevents account takeover and bot registrations. Only once verification
    // emails can actually be sent (RESEND_API_KEY, as in lib/email.js): without
    // it nobody could ever verify, so enforcing would lock every account out.
    if (process.env.RESEND_API_KEY && !user.emailVerified) {
      return errorResponse(ErrorCodes.AUTH_EMAIL_NOT_VERIFIED, {
        ...headers,
        ...getRateLimitHeaders(rateLimit)
      }, {
        details: {
          email: user.email,
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.'
        }
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
