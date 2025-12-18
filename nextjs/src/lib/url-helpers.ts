/**
 * VeilForms - URL Building Helpers
 * Centralized utilities for building URLs (verification, reset, etc.)
 */

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
}

/**
 * Build a token-based URL (for email verification, password reset)
 */
export function buildTokenUrl(path: string, token: string): string {
  return `${getBaseUrl()}/${path}?token=${token}`;
}

/**
 * Build verification email URL
 */
export function buildVerificationUrl(token: string): string {
  return buildTokenUrl("verify", token);
}

/**
 * Build password reset URL
 */
export function buildResetUrl(token: string): string {
  return buildTokenUrl("reset", token);
}
