// Simple in-memory rate limiting for serverless functions
// Note: This resets on cold starts. For production, consider using Redis or Netlify Blob

const rateLimitStore = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 10; // 10 requests per minute
const LOCKOUT_THRESHOLD = 5; // Failed attempts before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minute lockout

// Clean up old entries periodically
function cleanup() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}

// Get client identifier (IP address)
function getClientId(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

// Check rate limit
export function checkRateLimit(req, options = {}) {
  const {
    windowMs = WINDOW_MS,
    maxRequests = MAX_REQUESTS,
    keyPrefix = 'rate'
  } = options;

  cleanup();

  const clientId = getClientId(req);
  const key = `${keyPrefix}:${clientId}`;
  const now = Date.now();

  let data = rateLimitStore.get(key);

  if (!data || now - data.windowStart > windowMs) {
    // New window
    data = {
      windowStart: now,
      count: 1
    };
    rateLimitStore.set(key, data);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  data.count++;

  if (data.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((data.windowStart + windowMs - now) / 1000)
    };
  }

  return { allowed: true, remaining: maxRequests - data.count };
}

// Track failed login attempts for account lockout
const failedAttempts = new Map();

export function recordFailedAttempt(email) {
  const key = `lockout:${email.toLowerCase()}`;
  const now = Date.now();

  let data = failedAttempts.get(key);

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

  failedAttempts.set(key, data);
  return data;
}

export function clearFailedAttempts(email) {
  failedAttempts.delete(`lockout:${email.toLowerCase()}`);
}

export function isAccountLocked(email) {
  const key = `lockout:${email.toLowerCase()}`;
  const data = failedAttempts.get(key);

  if (!data || !data.lockedUntil) {
    return { locked: false };
  }

  const now = Date.now();
  if (now >= data.lockedUntil) {
    // Lockout expired
    failedAttempts.delete(key);
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
