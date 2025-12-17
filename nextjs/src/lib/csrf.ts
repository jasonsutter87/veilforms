/**
 * VeilForms - CSRF Protection
 * Double Submit Cookie Pattern for stateless serverless architecture
 */

import { NextRequest } from "next/server";

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Validate CSRF token from request
 * Uses double-submit cookie pattern
 */
export function validateCsrfToken(req: NextRequest): boolean {
  // Get token from cookie
  const cookieToken = req.cookies.get("csrf-token")?.value;

  // Get token from header
  const headerToken = req.headers.get("x-csrf-token");

  // Both must be present
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
 * Create CSRF cookie value for Set-Cookie header
 */
export function createCsrfCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN || "";

  const cookieParts = [
    `csrf-token=${token}`,
    "Path=/",
    "SameSite=Strict",
    "HttpOnly",
    "Max-Age=3600", // 1 hour
  ];

  if (isProduction) {
    cookieParts.push("Secure");
  }

  if (domain) {
    cookieParts.push(`Domain=${domain}`);
  }

  return cookieParts.join("; ");
}

/**
 * Get CSRF headers for response
 */
export function getCsrfHeaders(token: string): Record<string, string> {
  return {
    "Set-Cookie": createCsrfCookie(token),
    "X-CSRF-Token": token,
  };
}
