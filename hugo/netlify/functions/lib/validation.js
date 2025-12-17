/**
 * VeilForms - Shared Validation Utilities
 * ID format validators and input sanitizers
 */

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
  uuid: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
};

/**
 * Validate form ID format
 * @param {string} id - Form ID to validate
 * @returns {boolean} Whether the ID is valid
 */
export function isValidFormId(id) {
  return typeof id === 'string' && ID_PATTERNS.form.test(id);
}

/**
 * Validate submission ID format
 * @param {string} id - Submission ID to validate
 * @returns {boolean} Whether the ID is valid
 */
export function isValidSubmissionId(id) {
  return typeof id === 'string' && ID_PATTERNS.submission.test(id);
}

/**
 * Validate user ID format
 * @param {string} id - User ID to validate
 * @returns {boolean} Whether the ID is valid
 */
export function isValidUserId(id) {
  return typeof id === 'string' && ID_PATTERNS.user.test(id);
}

/**
 * Validate API key format
 * @param {string} key - API key to validate
 * @returns {boolean} Whether the key is valid
 */
export function isValidApiKey(key) {
  return typeof key === 'string' && ID_PATTERNS.apiKey.test(key);
}

/**
 * Validate UUID format
 * @param {string} id - UUID to validate
 * @returns {boolean} Whether the UUID is valid
 */
export function isValidUuid(id) {
  return typeof id === 'string' && ID_PATTERNS.uuid.test(id);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether the email is valid
 */
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate webhook URL
 * @param {string} url - URL to validate
 * @returns {boolean} Whether the URL is valid
 */
export function isValidWebhookUrl(url) {
  if (!url || url === '') return true; // Empty is allowed
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate hex color format
 * @param {string} color - Color to validate
 * @returns {boolean} Whether the color is valid
 */
export function isValidHexColor(color) {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @param {number} options.maxLength - Maximum length
 * @param {boolean} options.trim - Whether to trim whitespace
 * @returns {string|null} Sanitized string or null if invalid
 */
export function sanitizeString(input, options = {}) {
  const { maxLength = 1000, trim = true } = options;

  if (typeof input !== 'string') return null;

  let result = input;
  if (trim) result = result.trim();
  if (maxLength && result.length > maxLength) result = result.slice(0, maxLength);

  return result;
}

/**
 * Validate form name
 * @param {string} name - Form name to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateFormName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Form name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Form name is required' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Form name must be 100 characters or less' };
  }
  return { valid: true };
}

/**
 * Validate notification recipients
 * @param {string[]} recipients - Array of email addresses
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateRecipients(recipients) {
  if (!Array.isArray(recipients)) {
    return { valid: false, error: 'Notification recipients must be an array' };
  }
  if (recipients.length > 5) {
    return { valid: false, error: 'Maximum 5 notification recipients allowed' };
  }
  for (const email of recipients) {
    if (!isValidEmail(email)) {
      return { valid: false, error: `Invalid email address: ${email}` };
    }
  }
  return { valid: true };
}

/**
 * Validate retention settings
 * @param {Object} retention - Retention settings
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateRetention(retention) {
  if (!retention) return { valid: true };
  if (retention.days && (retention.days < 1 || retention.days > 365)) {
    return { valid: false, error: 'Retention days must be between 1 and 365' };
  }
  return { valid: true };
}

/**
 * Validate branding settings
 * @param {Object} branding - Branding settings
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateBranding(branding) {
  if (!branding) return { valid: true };

  if (branding.customColor && !isValidHexColor(branding.customColor)) {
    return { valid: false, error: 'Invalid branding color format (use #RRGGBB)' };
  }

  if (branding.customLogo && branding.customLogo !== '') {
    if (branding.customLogo.length > 2048) {
      return { valid: false, error: 'Logo URL too long (max 2048 characters)' };
    }
    if (!isValidWebhookUrl(branding.customLogo)) {
      return { valid: false, error: 'Invalid logo URL format' };
    }
  }

  return { valid: true };
}

/**
 * Parse URL path to extract parts
 * @param {string} url - Full URL
 * @param {string} basePath - Base path to strip (e.g., '/api/forms/')
 * @returns {string[]} Path parts
 */
export function parseUrlPath(url, basePath) {
  const urlObj = new URL(url);
  return urlObj.pathname
    .replace(basePath, '')
    .replace(basePath.replace(/\/$/, ''), '')
    .split('/')
    .filter(Boolean);
}
