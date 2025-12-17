/**
 * VeilForms - Email Service
 * Send transactional emails via Resend
 */

// Note: Install resend with `npm install resend` when ready to use
// import { Resend } from 'resend';

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@veilforms.com";
const FROM_NAME = "VeilForms";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";

interface EmailResult {
  provider: string;
  id: string;
}

/**
 * Send email verification
 */
export async function sendEmailVerification(
  email: string,
  verifyUrl: string
): Promise<EmailResult> {
  // TODO: Implement with Resend when API key is configured
  console.log(`[DEV] Would send verification email to ${email}`);
  console.log(`[DEV] Verify URL: ${verifyUrl}`);
  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<EmailResult> {
  // TODO: Implement with Resend when API key is configured
  console.log(`[DEV] Would send password reset email to ${email}`);
  console.log(`[DEV] Reset URL: ${resetUrl}`);
  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  email: string
): Promise<EmailResult | null> {
  // TODO: Implement with Resend when API key is configured
  console.log(`[DEV] Would send welcome email to ${email}`);
  return { provider: "dev", id: "dev-" + Date.now() };
}

export { FROM_EMAIL, FROM_NAME, BASE_URL };
