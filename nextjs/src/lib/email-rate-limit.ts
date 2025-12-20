/**
 * VeilForms - Email Rate Limiting
 * Prevents abuse of email sending endpoints
 */

import { getStore } from "@netlify/blobs";

const EMAIL_RATE_LIMIT_STORE = "vf-email-rate-limits";
const ONE_HOUR = 60 * 60 * 1000;

interface LimitConfig {
  max: number;
  window: number;
  message: string;
}

const LIMITS: Record<string, LimitConfig> = {
  verification: {
    max: 5,
    window: ONE_HOUR,
    message: "Too many verification emails. Please wait before requesting another.",
  },
  passwordReset: {
    max: 3,
    window: ONE_HOUR,
    message: "Too many password reset requests. Please wait before trying again.",
  },
  submissionNotification: {
    max: 100,
    window: ONE_HOUR,
    message: "Too many submission notification emails. Rate limit reached.",
  },
};

interface RateLimitData {
  count: number;
  resetAt: number;
  attempts: number[];
}

interface EmailRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  message?: string;
  error?: string;
}

/**
 * Check if email sending is allowed for a given type
 */
export async function checkEmailRateLimit(
  email: string,
  type: "verification" | "passwordReset" | "submissionNotification"
): Promise<EmailRateLimitResult> {
  const limit = LIMITS[type];
  if (!limit) {
    throw new Error(`Invalid email rate limit type: ${type}`);
  }

  const store = getStore({ name: EMAIL_RATE_LIMIT_STORE, consistency: "strong" });
  const key = `${type}_${email.toLowerCase()}`;

  try {
    let data = (await store.get(key, { type: "json" })) as RateLimitData | null;
    const now = Date.now();

    if (!data || now >= data.resetAt) {
      data = {
        count: 0,
        resetAt: now + limit.window,
        attempts: [],
      };
    }

    // Remove old attempts outside the window
    data.attempts = data.attempts.filter(
      (timestamp) => now - timestamp < limit.window
    );

    // Check if limit exceeded
    if (data.attempts.length >= limit.max) {
      const oldestAttempt = Math.min(...data.attempts);
      const retryAfter = Math.ceil((oldestAttempt + limit.window - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestAttempt + limit.window,
        retryAfter,
        message: limit.message,
      };
    }

    // Record this attempt
    data.attempts.push(now);
    data.count = data.attempts.length;

    await store.setJSON(key, data);

    return {
      allowed: true,
      remaining: limit.max - data.count,
      resetAt: data.resetAt,
    };
  } catch (error) {
    console.error("Email rate limit check error:", error);
    return {
      allowed: true,
      remaining: limit.max,
      resetAt: Date.now() + limit.window,
      error: "Rate limit check failed",
    };
  }
}

/**
 * Get rate limit headers for responses
 */
export function getEmailRateLimitHeaders(
  result: EmailRateLimitResult,
  type: "verification" | "passwordReset" | "submissionNotification"
): Record<string, string> {
  const limit = LIMITS[type];
  const maxLimit = limit?.max ?? 3;

  return {
    "X-RateLimit-Limit": maxLimit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
    ...(result.retryAfter && {
      "Retry-After": result.retryAfter.toString(),
    }),
  };
}

/**
 * Reset rate limit for an email
 */
export async function resetEmailRateLimit(
  email: string,
  type: "verification" | "passwordReset" | "submissionNotification"
): Promise<{ success: boolean; message?: string; error?: string }> {
  const store = getStore({ name: EMAIL_RATE_LIMIT_STORE, consistency: "strong" });
  const key = `${type}_${email.toLowerCase()}`;

  try {
    await store.delete(key);
    return { success: true, message: "Rate limit reset successfully" };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
