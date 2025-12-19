/**
 * VeilForms - Preview Token Management
 * Generates and validates temporary preview tokens for form preview mode
 */

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export interface PreviewTokenPayload {
  formId: string;
  userId: string;
  type: "preview";
}

/**
 * Generate a preview token for a form
 * @param formId - The form ID to generate a preview token for
 * @param userId - The user ID who owns the form
 * @returns The preview token (JWT)
 */
export function generatePreviewToken(formId: string, userId: string): string {
  const payload: PreviewTokenPayload = {
    formId,
    userId,
    type: "preview",
  };

  // Token expires in 24 hours
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "24h",
    audience: "veilforms-preview",
    issuer: "veilforms",
  });
}

/**
 * Verify and decode a preview token
 * @param token - The preview token to verify
 * @returns The decoded payload if valid, null otherwise
 */
export function verifyPreviewToken(token: string): PreviewTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      audience: "veilforms-preview",
      issuer: "veilforms",
    }) as PreviewTokenPayload;

    // Verify token type
    if (decoded.type !== "preview") {
      return null;
    }

    return decoded;
  } catch (err) {
    // Token invalid or expired
    console.error("Preview token verification failed:", err);
    return null;
  }
}

/**
 * Generate a shareable preview URL
 * @param formId - The form ID
 * @param token - The preview token
 * @param baseUrl - The base URL of the application (optional)
 * @returns The preview URL
 */
export function generatePreviewUrl(
  formId: string,
  token: string,
  baseUrl?: string
): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  return `${base}/preview/${formId}?token=${token}`;
}
