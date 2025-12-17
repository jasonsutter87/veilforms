/**
 * VeilForms - Standardized Response Utilities for Next.js
 * Provides consistent JSON response formatting across all API routes
 */

import { NextResponse } from "next/server";

/**
 * Create a successful JSON response
 */
export function success<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Create an error JSON response
 */
export function error(
  message: string,
  status = 400,
  extra: Record<string, unknown> = {}
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Create a 400 Bad Request response
 */
export function badRequest(message: string): NextResponse {
  return error(message, 400);
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorized(
  message = "Authentication required"
): NextResponse {
  return error(message, 401);
}

/**
 * Create a 403 Forbidden response
 */
export function forbidden(message = "Access denied"): NextResponse {
  return error(message, 403);
}

/**
 * Create a 404 Not Found response
 */
export function notFound(message = "Not found"): NextResponse {
  return error(message, 404);
}

/**
 * Create a 405 Method Not Allowed response
 */
export function methodNotAllowed(): NextResponse {
  return error("Method not allowed", 405);
}

/**
 * Create a 429 Too Many Requests response
 */
export function tooManyRequests(retryAfter?: number): NextResponse {
  return error("Too many requests. Please try again later.", 429, {
    retryAfter,
  });
}

/**
 * Create a 500 Internal Server Error response
 */
export function serverError(message = "Internal server error"): NextResponse {
  return error(message, 500);
}

/**
 * Create a 201 Created response
 */
export function created<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 });
}

/**
 * Create a 204 No Content response
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
