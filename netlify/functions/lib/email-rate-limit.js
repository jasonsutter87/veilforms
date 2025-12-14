/**
 * Email Rate Limiting
 *
 * Prevents abuse of email sending endpoints:
 * - Verification emails: max 5 per email per hour
 * - Password reset emails: max 3 per email per hour
 *
 * Uses Netlify Blob for persistence across function invocations
 */

import { getStore } from '@netlify/blobs';

const EMAIL_RATE_LIMIT_STORE = 'vf-email-rate-limits';
const ONE_HOUR = 60 * 60 * 1000; // milliseconds

// Rate limit configurations
const LIMITS = {
  verification: {
    max: 5,
    window: ONE_HOUR,
    message: 'Too many verification emails. Please wait before requesting another.'
  },
  passwordReset: {
    max: 3,
    window: ONE_HOUR,
    message: 'Too many password reset requests. Please wait before trying again.'
  }
};

/**
 * Check if email sending is allowed for a given type
 *
 * @param {string} email - Email address
 * @param {string} type - 'verification' or 'passwordReset'
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number, retryAfter?: number}>}
 */
export async function checkEmailRateLimit(email, type) {
  const limit = LIMITS[type];
  if (!limit) {
    throw new Error(`Invalid email rate limit type: ${type}`);
  }

  const store = getStore({ name: EMAIL_RATE_LIMIT_STORE, consistency: 'strong' });
  const key = `${type}_${email.toLowerCase()}`;

  try {
    // Get existing rate limit data
    let data = await store.get(key, { type: 'json' });
    const now = Date.now();

    // If no data or window expired, create new
    if (!data || now >= data.resetAt) {
      data = {
        count: 0,
        resetAt: now + limit.window,
        attempts: []
      };
    }

    // Remove old attempts outside the window
    data.attempts = data.attempts.filter(timestamp => now - timestamp < limit.window);

    // Check if limit exceeded
    if (data.attempts.length >= limit.max) {
      const oldestAttempt = Math.min(...data.attempts);
      const retryAfter = Math.ceil((oldestAttempt + limit.window - now) / 1000); // seconds

      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestAttempt + limit.window,
        retryAfter,
        message: limit.message
      };
    }

    // Record this attempt
    data.attempts.push(now);
    data.count = data.attempts.length;

    // Save updated data
    await store.setJSON(key, data);

    return {
      allowed: true,
      remaining: limit.max - data.count,
      resetAt: data.resetAt
    };
  } catch (error) {
    console.error('Email rate limit check error:', error);

    // On error, allow the request (fail open)
    // but log for monitoring
    return {
      allowed: true,
      remaining: limit.max,
      resetAt: Date.now() + limit.window,
      error: 'Rate limit check failed'
    };
  }
}

/**
 * Get rate limit headers for responses
 */
export function getEmailRateLimitHeaders(result, type) {
  const limit = LIMITS[type];

  return {
    'X-RateLimit-Limit': limit.max.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    ...(result.retryAfter && {
      'Retry-After': result.retryAfter.toString()
    })
  };
}

/**
 * Reset rate limit for an email (admin function)
 */
export async function resetEmailRateLimit(email, type) {
  const store = getStore({ name: EMAIL_RATE_LIMIT_STORE, consistency: 'strong' });
  const key = `${type}_${email.toLowerCase()}`;

  try {
    await store.delete(key);
    return { success: true, message: 'Rate limit reset successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current rate limit status (for debugging/admin)
 */
export async function getEmailRateLimitStatus(email, type) {
  const limit = LIMITS[type];
  const store = getStore({ name: EMAIL_RATE_LIMIT_STORE, consistency: 'strong' });
  const key = `${type}_${email.toLowerCase()}`;

  try {
    const data = await store.get(key, { type: 'json' });
    const now = Date.now();

    if (!data || now >= data.resetAt) {
      return {
        email,
        type,
        count: 0,
        limit: limit.max,
        remaining: limit.max,
        resetAt: null
      };
    }

    // Filter valid attempts
    const validAttempts = data.attempts.filter(ts => now - ts < limit.window);

    return {
      email,
      type,
      count: validAttempts.length,
      limit: limit.max,
      remaining: Math.max(0, limit.max - validAttempts.length),
      resetAt: data.resetAt,
      attempts: validAttempts.map(ts => new Date(ts).toISOString())
    };
  } catch (error) {
    return {
      email,
      type,
      count: 0,
      limit: limit.max,
      remaining: limit.max,
      resetAt: null,
      error: error.message
    };
  }
}
