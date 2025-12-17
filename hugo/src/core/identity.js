/**
 * VeilForms - Identity Module
 * Anonymous submission IDs without PII
 * Based on ZTA.io Zero Trust principles
 */

/**
 * Create a one-way hash for anonymous submission identification
 * Combines form ID + timestamp + random entropy - no PII involved
 * @param {string} formId - The form identifier
 * @param {object} options - Optional config
 * @returns {Promise<string>} - Anonymous hash ID
 */
export async function createIdentityHash(formId, options = {}) {
  const timestamp = Date.now();
  const entropy = generateEntropy(32);
  const salt = options.salt || 'veilforms-v1';

  // Combine non-PII elements
  const payload = `${salt}:${formId}:${timestamp}:${entropy}`;

  // Use Web Crypto API for secure hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    id: hashHex.substring(0, 32), // Truncate for usability
    timestamp,
    formId,
    // Never include: IP, email, name, user agent fingerprint
  };
}

/**
 * Generate cryptographically secure random entropy
 * @param {number} length - Number of random bytes
 * @returns {string} - Hex-encoded random string
 */
function generateEntropy(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a simple anonymous ID (sync version)
 * For cases where async isn't practical
 * @param {string} formId - The form identifier
 * @returns {string} - Anonymous UUID-style ID
 */
export function createAnonymousId(formId) {
  return 'vf-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Verify a submission ID format is valid (not tampered)
 * @param {string} id - The submission ID to verify
 * @returns {boolean} - True if valid format
 */
export function isValidSubmissionId(id) {
  // Must be 32 hex characters (from createIdentityHash)
  // or UUID format (from createAnonymousId)
  const hashPattern = /^[a-f0-9]{32}$/;
  const uuidPattern = /^vf-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

  return hashPattern.test(id) || uuidPattern.test(id);
}
