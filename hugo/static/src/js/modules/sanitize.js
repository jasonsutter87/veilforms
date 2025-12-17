/**
 * VeilForms - Sanitization Utilities
 * XSS protection using DOMPurify with strict CSP-compatible configuration
 */

// Use global DOMPurify loaded from CDN (see baseof.html)
const DOMPurify = window.DOMPurify;

/**
 * Configure DOMPurify with strict security settings for VeilForms
 * - No javascript: URLs
 * - No event handlers (onclick, onerror, etc.)
 * - No forms (to prevent form hijacking)
 * - No scripts
 * - CSP-compatible output
 */
const SANITIZE_CONFIG = {
  // Allow only safe HTML tags
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'u', 's', 'strike',
    'p', 'br', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a', 'abbr', 'acronym',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'dl', 'dt', 'dd',
    'small', 'sub', 'sup'
  ],

  // Allow only safe attributes
  ALLOWED_ATTR: [
    'class', 'id',
    'href', 'title', 'target',
    'colspan', 'rowspan',
    'style' // Limited to safe CSS only
  ],

  // Allow only safe URL schemes
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

  // Forbid tags that can execute scripts
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'link', 'meta', 'form', 'input', 'textarea', 'button', 'select'],

  // Forbid attributes that can execute scripts
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseenter', 'onfocus', 'onblur', 'onchange', 'oninput'],

  // Keep all HTML entities intact
  KEEP_CONTENT: true,

  // Return a safe string (not DOM)
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,

  // Don't allow unknown protocols
  ALLOW_UNKNOWN_PROTOCOLS: false,

  // Enforce safe HTML
  SAFE_FOR_TEMPLATES: true,

  // Force body context
  FORCE_BODY: false,

  // Sanitize in place
  IN_PLACE: false
};

/**
 * Strict configuration for user-generated content display
 * Even more restrictive - only allows basic text formatting
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'code'],
  ALLOWED_ATTR: ['class'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'link', 'meta', 'form', 'input', 'textarea', 'button', 'select', 'a'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseenter', 'onfocus', 'onblur', 'onchange', 'oninput', 'href', 'src'],
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true,
  RETURN_DOM: false
};

/**
 * Plain text configuration - strips all HTML
 */
const PLAIN_TEXT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  RETURN_DOM: false
};

/**
 * Sanitize HTML content with DOMPurify
 * @param {string} dirty - Potentially unsafe HTML string
 * @param {Object} config - Optional DOMPurify configuration (defaults to SANITIZE_CONFIG)
 * @returns {string} - Sanitized HTML string
 */
export function sanitizeHtml(dirty, config = SANITIZE_CONFIG) {
  if (dirty === null || dirty === undefined) return '';
  if (typeof dirty !== 'string') dirty = String(dirty);

  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitize HTML with strict settings (for user submissions)
 * @param {string} dirty - Potentially unsafe HTML string
 * @returns {string} - Sanitized HTML string with minimal allowed tags
 */
export function sanitizeStrict(dirty) {
  return sanitizeHtml(dirty, STRICT_CONFIG);
}

/**
 * Strip all HTML tags and return plain text
 * @param {string} dirty - HTML string
 * @returns {string} - Plain text with HTML entities decoded
 */
export function sanitizePlainText(dirty) {
  return sanitizeHtml(dirty, PLAIN_TEXT_CONFIG);
}

/**
 * Sanitize JSON for display (prevents XSS in JSON output)
 * @param {any} data - Data to sanitize
 * @param {number} indent - Indentation level for JSON.stringify
 * @returns {string} - Sanitized JSON string safe for display in HTML
 */
export function sanitizeJson(data, indent = 2) {
  if (data === null || data === undefined) return '';

  try {
    // Convert to JSON string
    const jsonString = JSON.stringify(data, null, indent);

    // Escape HTML special characters in the JSON string
    // This prevents any HTML/script injection if JSON contains malicious strings
    return jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  } catch (err) {
    console.error('Failed to sanitize JSON:', err);
    return 'Invalid data';
  }
}

/**
 * Sanitize a URL to prevent javascript: and data: URIs
 * @param {string} url - URL to sanitize
 * @returns {string} - Safe URL or empty string if invalid
 */
export function sanitizeUrl(url) {
  if (!url) return '';

  const trimmed = url.trim();

  // Check for dangerous protocols
  const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
  if (dangerousProtocols.test(trimmed)) {
    console.warn('Blocked dangerous URL protocol:', trimmed);
    return '';
  }

  // Allow only safe protocols
  const safeProtocols = /^(https?|mailto|tel|sms):/i;
  if (trimmed.includes(':') && !safeProtocols.test(trimmed)) {
    console.warn('Blocked unsafe URL protocol:', trimmed);
    return '';
  }

  return trimmed;
}

/**
 * Sanitize user input for attribute values
 * @param {string} value - Attribute value to sanitize
 * @returns {string} - Sanitized attribute value
 */
export function sanitizeAttribute(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Create a safe innerHTML setter that automatically sanitizes
 * @param {HTMLElement} element - DOM element
 * @param {string} html - HTML content to set
 * @param {Object} config - Optional sanitization config
 */
export function setSafeInnerHTML(element, html, config = SANITIZE_CONFIG) {
  if (!element) return;
  element.innerHTML = sanitizeHtml(html, config);
}

/**
 * Create a safe innerHTML setter for strict content (submissions)
 * @param {HTMLElement} element - DOM element
 * @param {string} html - HTML content to set
 */
export function setSafeInnerHTMLStrict(element, html) {
  if (!element) return;
  element.innerHTML = sanitizeStrict(html);
}

// Export DOMPurify instance for advanced usage
export { DOMPurify };

// Export configurations for custom usage
export const configs = {
  DEFAULT: SANITIZE_CONFIG,
  STRICT: STRICT_CONFIG,
  PLAIN_TEXT: PLAIN_TEXT_CONFIG
};
