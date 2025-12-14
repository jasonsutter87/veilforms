/**
 * CSRF Protection using Double Submit Cookie Pattern
 * Suitable for stateless serverless architecture
 */

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} CSRF token
 */
export function generateCsrfToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate CSRF token from request
 * Uses double-submit cookie pattern:
 * 1. Token must be present in cookie
 * 2. Token must be present in header
 * 3. Both tokens must match
 *
 * @param {Request} req - Request object
 * @returns {boolean} Whether CSRF token is valid
 */
export function validateCsrfToken(req) {
  // Get token from cookie
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/csrf-token=([^;]+)/);
  const cookieToken = cookieMatch ? cookieMatch[1] : null;

  // Get token from header
  const headerToken = req.headers.get('x-csrf-token');

  // Both must be present and match
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    mismatch |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Create CSRF cookie header
 * @param {string} token - CSRF token
 * @returns {string} Set-Cookie header value
 */
export function createCsrfCookie(token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN || '';

  const cookieParts = [
    `csrf-token=${token}`,
    'Path=/',
    'SameSite=Strict',
    'HttpOnly',
    'Max-Age=3600' // 1 hour
  ];

  if (isProduction) {
    cookieParts.push('Secure');
  }

  if (domain) {
    cookieParts.push(`Domain=${domain}`);
  }

  return cookieParts.join('; ');
}

/**
 * Get CSRF token headers for response
 * @param {string} token - CSRF token
 * @returns {Object} Headers object
 */
export function getCsrfHeaders(token) {
  return {
    'Set-Cookie': createCsrfCookie(token),
    'X-CSRF-Token': token
  };
}
