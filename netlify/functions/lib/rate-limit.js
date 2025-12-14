// Persistent rate limiting using Netlify Blob storage
// Survives cold starts and works across function instances

import { getStore } from '@netlify/blobs';

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 10; // 10 requests per minute
const LOCKOUT_THRESHOLD = 5; // Failed attempts before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minute lockout

// Get blob store for rate limiting data
function getRateLimitStore() {
  return getStore({ name: 'veilforms-ratelimit', consistency: 'strong' });
}

// Clean up old entries periodically
async function cleanup(store, key) {
  const now = Date.now();
  try {
    const data = await store.get(key, { type: 'json' });
    if (data && now - data.windowStart > WINDOW_MS * 2) {
      await store.delete(key);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

// Get client identifier (IP address)
function getClientId(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

// Check rate limit
export async function checkRateLimit(req, options = {}) {
  const {
    windowMs = WINDOW_MS,
    maxRequests = MAX_REQUESTS,
    keyPrefix = 'rate'
  } = options;

  const store = getRateLimitStore();
  const clientId = getClientId(req);
  const key = `${keyPrefix}:${clientId}`;
  const now = Date.now();

  // Clean up old entries for this key
  await cleanup(store, key);

  let data = await store.get(key, { type: 'json' });

  if (!data || now - data.windowStart > windowMs) {
    // New window
    data = {
      windowStart: now,
      count: 1
    };
    await store.setJSON(key, data);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  data.count++;

  if (data.count > maxRequests) {
    // Don't update store if already over limit
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((data.windowStart + windowMs - now) / 1000)
    };
  }

  await store.setJSON(key, data);
  return { allowed: true, remaining: maxRequests - data.count };
}

// Track failed login attempts for account lockout
export async function recordFailedAttempt(email) {
  const store = getRateLimitStore();
  const key = `lockout:${email.toLowerCase()}`;
  const now = Date.now();

  let data = await store.get(key, { type: 'json' });

  if (!data || now - data.firstAttempt > LOCKOUT_DURATION_MS) {
    // Reset after lockout duration
    data = {
      firstAttempt: now,
      count: 1,
      lockedUntil: null
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

export async function clearFailedAttempts(email) {
  const store = getRateLimitStore();
  await store.delete(`lockout:${email.toLowerCase()}`);
}

export async function isAccountLocked(email) {
  const store = getRateLimitStore();
  const key = `lockout:${email.toLowerCase()}`;
  const data = await store.get(key, { type: 'json' });

  if (!data || !data.lockedUntil) {
    return { locked: false };
  }

  const now = Date.now();
  if (now >= data.lockedUntil) {
    // Lockout expired
    await store.delete(key);
    return { locked: false };
  }

  return {
    locked: true,
    remainingMs: data.lockedUntil - now,
    remainingMinutes: Math.ceil((data.lockedUntil - now) / 60000)
  };
}

// Get rate limit headers for response
export function getRateLimitHeaders(result) {
  const headers = {
    'X-RateLimit-Remaining': String(result.remaining)
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}
