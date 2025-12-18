/**
 * VeilForms - Shared Validation Utilities
 * ID format validators and input sanitizers
 */

import { validatePasswordStrength } from "./auth";

// ID format patterns
const ID_PATTERNS = {
  // Form ID: vf_abc123 or vf_abc_123
  form: /^vf_[a-z0-9_]+$/i,
  // Submission ID: vf-uuid format or 32-char hex
  submission: /^(vf-[a-f0-9-]{36}|[a-f0-9]{32})$/,
  // User ID: user_abc123
  user: /^user_[a-z0-9]+$/i,
  // API Key: vf_api_abc123
  apiKey: /^vf_api_[a-z0-9]+$/i,
  // UUID format
  uuid: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
};

/**
 * Validate form ID format
 */
export function isValidFormId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERNS.form.test(id);
}

/**
 * Validate submission ID format
 */
export function isValidSubmissionId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERNS.submission.test(id);
}

/**
 * Validate user ID format
 */
export function isValidUserId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERNS.user.test(id);
}

/**
 * Validate API key format
 */
export function isValidApiKey(key: unknown): key is string {
  return typeof key === "string" && ID_PATTERNS.apiKey.test(key);
}

/**
 * Validate UUID format
 */
export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERNS.uuid.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email: unknown): email is string {
  return (
    typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

/**
 * Validate webhook URL
 */
export function isValidWebhookUrl(url: unknown): boolean {
  if (!url || url === "") return true; // Empty is allowed
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: unknown): color is string {
  return typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color);
}

interface SanitizeOptions {
  maxLength?: number;
  trim?: boolean;
}

/**
 * Sanitize string input
 */
export function sanitizeString(
  input: unknown,
  options: SanitizeOptions = {}
): string | null {
  const { maxLength = 1000, trim = true } = options;

  if (typeof input !== "string") return null;

  let result = input;
  if (trim) result = result.trim();
  if (maxLength && result.length > maxLength) result = result.slice(0, maxLength);

  return result;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate form name
 */
export function validateFormName(name: unknown): ValidationResult {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Form name is required" };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Form name is required" };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: "Form name must be 100 characters or less" };
  }
  return { valid: true };
}

/**
 * Validate notification recipients
 */
export function validateRecipients(recipients: unknown): ValidationResult {
  if (!Array.isArray(recipients)) {
    return { valid: false, error: "Notification recipients must be an array" };
  }
  if (recipients.length > 5) {
    return { valid: false, error: "Maximum 5 notification recipients allowed" };
  }
  for (const email of recipients) {
    if (!isValidEmail(email)) {
      return { valid: false, error: `Invalid email address: ${email}` };
    }
  }
  return { valid: true };
}

interface RetentionSettings {
  days?: number;
}

/**
 * Validate retention settings
 */
export function validateRetention(retention: unknown): ValidationResult {
  if (!retention) return { valid: true };
  const r = retention as RetentionSettings;
  if (r.days && (r.days < 1 || r.days > 365)) {
    return { valid: false, error: "Retention days must be between 1 and 365" };
  }
  return { valid: true };
}

interface BrandingSettings {
  customColor?: string;
  customLogo?: string;
}

/**
 * Validate branding settings
 */
export function validateBranding(branding: unknown): ValidationResult {
  if (!branding) return { valid: true };
  const b = branding as BrandingSettings;

  if (b.customColor && !isValidHexColor(b.customColor)) {
    return { valid: false, error: "Invalid branding color format (use #RRGGBB)" };
  }

  if (b.customLogo && b.customLogo !== "") {
    if (b.customLogo.length > 2048) {
      return { valid: false, error: "Logo URL too long (max 2048 characters)" };
    }
    if (!isValidWebhookUrl(b.customLogo)) {
      return { valid: false, error: "Invalid logo URL format" };
    }
  }

  return { valid: true };
}

/**
 * Validate password meets requirements
 * Delegates to the comprehensive validation in auth.ts
 *
 * Note: This is a wrapper that converts the auth.ts validation result
 * to the single-error format used by this module.
 */
export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required" };
  }

  // Use the comprehensive validation from auth.ts
  const result = validatePasswordStrength(password);

  if (!result.valid) {
    return {
      valid: false,
      error: result.errors.join(", "),
    };
  }

  return { valid: true };
}

/**
 * Parse URL path to extract parts after a prefix
 */
export function parseUrlPath(urlString: string, prefix: string): string[] {
  try {
    const url = new URL(urlString);
    const path = url.pathname;
    const prefixIndex = path.indexOf(prefix);

    if (prefixIndex === -1) {
      return [];
    }

    const remainder = path.slice(prefixIndex + prefix.length);
    return remainder.split("/").filter((p) => p.length > 0);
  } catch {
    return [];
  }
}
