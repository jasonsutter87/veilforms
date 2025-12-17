/**
 * VeilForms - Standardized Response Utilities
 * Provides consistent JSON response formatting across all endpoints
 */

/**
 * Create a successful JSON response
 * @param {Object} data - Response payload
 * @param {Object} headers - CORS headers
 * @param {number} status - HTTP status code (default 200)
 * @returns {Response}
 */
export function success(data, headers, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

/**
 * Create an error JSON response
 * @param {string} message - Error message
 * @param {Object} headers - CORS headers
 * @param {number} status - HTTP status code (default 400)
 * @param {Object} extra - Additional error data
 * @returns {Response}
 */
export function error(message, headers, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers
  });
}

/**
 * Create a 400 Bad Request response
 * @param {string} message - Error message
 * @param {Object} headers - CORS headers
 * @returns {Response}
 */
export function badRequest(message, headers) {
  return error(message, headers, 400);
}

/**
 * Create a 401 Unauthorized response
 * @param {string} message - Error message
 * @param {Object} headers - CORS headers
 * @returns {Response}
 */
export function unauthorized(message = 'Authentication required', headers) {
  return error(message, headers, 401);
}

/**
 * Create a 403 Forbidden response
 * @param {string} message - Error message
 * @param {Object} headers - CORS headers
 * @returns {Response}
 */
export function forbidden(message = 'Access denied', headers) {
  return error(message, headers, 403);
}

/**
 * Create a 404 Not Found response
 * @param {string} message - Error message
 * @param {Object} headers - CORS headers
 * @returns {Response}
 */
export function notFound(message = 'Not found', headers) {
  return error(message, headers, 404);
}

/**
 * Create a 405 Method Not Allowed response
 * @param {Object} headers - CORS headers
 * @returns {Response}
 */
export function methodNotAllowed(headers) {
  return error('Method not allowed', headers, 405);
}

/**
 * Create a 429 Too Many Requests response
 * @param {Object} headers - CORS headers (should include rate limit headers)
 * @param {number} retryAfter - Seconds until retry is allowed
 * @returns {Response}
 */
export function tooManyRequests(headers, retryAfter) {
  return error('Too many requests. Please try again later.', headers, 429, { retryAfter });
}

/**
 * Create a 500 Internal Server Error response
 * @param {Object} headers - CORS headers
 * @param {string} message - Error message
 * @returns {Response}
 */
export function serverError(headers, message = 'Internal server error') {
  return error(message, headers, 500);
}

/**
 * Create a 201 Created response
 * @param {Object} data - Created resource data
 * @param {Object} headers - CORS headers
 * @returns {Response}
 */
export function created(data, headers) {
  return success(data, headers, 201);
}

/**
 * Create a 204 No Content response (typically for OPTIONS)
 * @param {Object} headers - CORS headers
 * @returns {Response}
 */
export function noContent(headers) {
  return new Response(null, { status: 204, headers });
}
