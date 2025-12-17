/**
 * VeilForms - Rate Limiting
 * Persistent rate limiting using Netlify Blob storage
 */

import { getStore } from "@netlify/blobs";
import { NextRequest } from "next/server";

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 10; // 10 requests per minute
const LOCKOUT_THRESHOLD = 5; // Failed attempts before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minute lockout

interface RateLimitData {
  windowStart: number;
  count: number;
}

interface LockoutData {
  firstAttempt: number;
  count: number;
  lockedUntil: number | null;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

interface LockoutResult {
  locked: boolean;
  remainingMs?: number;
  remainingMinutes?: number;
}

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

/**
 * Get blob store for rate limiting data
 */
function getRateLimitStore() {
  return getStore({ name: "veilforms-ratelimit", consistency: "strong" });
}

/**
 * Clean up old entries periodically
 */
async function cleanup(
  store: ReturnType<typeof getStore>,
  key: string
): Promise<void> {
  const now = Date.now();
  try {
    const data = (await store.get(key, { type: "json" })) as RateLimitData | null;
    if (data && now - data.windowStart > WINDOW_MS * 2) {
      await store.delete(key);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get client identifier (IP address)
 */
function getClientId(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check rate limit
 */
export async function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    windowMs = WINDOW_MS,
    maxRequests = MAX_REQUESTS,
    keyPrefix = "rate",
  } = options;

  const store = getRateLimitStore();
  const clientId = getClientId(req);
  const key = `${keyPrefix}:${clientId}`;
  const now = Date.now();

  // Clean up old entries for this key
  await cleanup(store, key);

  let data = (await store.get(key, { type: "json" })) as RateLimitData | null;

  if (!data || now - data.windowStart > windowMs) {
    // New window
    data = {
      windowStart: now,
      count: 1,
    };
    await store.setJSON(key, data);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  data.count++;

  if (data.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((data.windowStart + windowMs - now) / 1000),
    };
  }

  await store.setJSON(key, data);
  return { allowed: true, remaining: maxRequests - data.count };
}

/**
 * Track failed login attempts for account lockout
 */
export async function recordFailedAttempt(email: string): Promise<LockoutData> {
  const store = getRateLimitStore();
  const key = `lockout:${email.toLowerCase()}`;
  const now = Date.now();

  let data = (await store.get(key, { type: "json" })) as LockoutData | null;

  if (!data || now - data.firstAttempt > LOCKOUT_DURATION_MS) {
    data = {
      firstAttempt: now,
      count: 1,
      lockedUntil: null,
    };
  } else {
    data.count++;
    if (data.count >= LOCKOUT_THRESHOLD) {
      data.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
  }

  await store.setJSON(key, data);
  return data;
}

/**
 * Clear failed attempts after successful login
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const store = getRateLimitStore();
  await store.delete(`lockout:${email.toLowerCase()}`);
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(email: string): Promise<LockoutResult> {
  const store = getRateLimitStore();
  const key = `lockout:${email.toLowerCase()}`;
  const data = (await store.get(key, { type: "json" })) as LockoutData | null;

  if (!data || !data.lockedUntil) {
    return { locked: false };
  }

  const now = Date.now();
  if (now >= data.lockedUntil) {
    await store.delete(key);
    return { locked: false };
  }

  return {
    locked: true,
    remainingMs: data.lockedUntil - now,
    remainingMinutes: Math.ceil((data.lockedUntil - now) / 60000),
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(result.remaining),
  };

  if (result.retryAfter) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}
