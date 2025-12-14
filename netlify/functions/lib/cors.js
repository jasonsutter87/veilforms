/**
 * VeilForms - Shared CORS Utilities
 * Centralized CORS handling for all API endpoints
 */

// Default allowed origins for local development
const DEFAULT_ORIGINS = ['http://localhost:1313', 'http://localhost:3000'];

// Parse allowed origins from environment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : DEFAULT_ORIGINS;

/**
 * Get CORS headers for a request
 * SECURITY: Only returns CORS headers for allowed origins
 * Disallowed origins receive NO CORS headers, causing browser to block the request
 *
 * @param {string} origin - The request origin
 * @param {Object} options - Configuration options
 * @param {string[]} options.methods - Allowed HTTP methods
 * @param {string[]} options.headers - Allowed headers
 * @param {boolean} options.credentials - Allow credentials
 * @returns {Object} Headers object
 */
export function getCorsHeaders(origin, options = {}) {
  const {
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = true
  } = options;

  // SECURITY FIX: Do not set CORS headers for disallowed origins
  // This causes the browser to block the request with CORS error
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Content-Type': 'application/json'
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Headers': headers.join(', '),
    'Access-Control-Allow-Credentials': credentials ? 'true' : 'false',
    'Content-Type': 'application/json'
  };
}

/**
 * Handle OPTIONS preflight request
 * @param {Object} headers - CORS headers
 * @returns {Response} 204 No Content response
 */
export function handlePreflight(headers) {
  return new Response(null, { status: 204, headers });
}

/**
 * Check if origin is allowed
 * @param {string} origin - The origin to check
 * @returns {boolean} Whether the origin is allowed
 */
export function isOriginAllowed(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Get allowed origins list
 * @returns {string[]} Array of allowed origins
 */
export function getAllowedOrigins() {
  return [...ALLOWED_ORIGINS];
}
