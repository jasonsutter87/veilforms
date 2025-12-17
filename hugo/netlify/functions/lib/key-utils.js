/**
 * VeilForms - Key Management Utilities
 * Helper functions for validating and handling encryption keys
 */

import { ErrorCodes, errorResponse } from './errors.js';

/**
 * Validate JWK (JSON Web Key) format
 * @param {Object} key - The key to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateJWK(key) {
  if (!key || typeof key !== 'object') {
    return {
      valid: false,
      error: 'Key must be a valid object',
    };
  }

  // Check for required JWK fields
  const requiredFields = ['kty', 'n', 'e'];
  for (const field of requiredFields) {
    if (!key[field]) {
      return {
        valid: false,
        error: `Missing required JWK field: ${field}`,
      };
    }
  }

  // Validate key type
  if (key.kty !== 'RSA') {
    return {
      valid: false,
      error: 'Only RSA keys are supported (kty must be "RSA")',
    };
  }

  return { valid: true, error: null };
}

/**
 * Validate key export password
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateKeyPassword(password) {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      error: 'Password is required',
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters long',
    };
  }

  // Optional: Add more password strength checks
  // - Contains uppercase
  // - Contains lowercase
  // - Contains number
  // - Contains special character

  return { valid: true, error: null };
}

/**
 * Create error response for key-related errors
 * @param {string} errorCode - Error code from ErrorCodes
 * @param {Object} headers - Response headers
 * @param {Object} options - Additional error options
 * @returns {Response} - Error response
 */
export function keyErrorResponse(errorCode, headers, options = {}) {
  return errorResponse(errorCode, headers, options);
}

/**
 * Validate encrypted key bundle format
 * @param {Object} bundle - The encrypted key bundle
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateKeyBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    return {
      valid: false,
      error: 'Bundle must be a valid object',
    };
  }

  const requiredFields = ['version', 'algorithm', 'iterations', 'salt', 'iv', 'ciphertext'];
  for (const field of requiredFields) {
    if (!bundle[field]) {
      return {
        valid: false,
        error: `Missing required bundle field: ${field}`,
      };
    }
  }

  // Validate version
  if (bundle.version !== '1.0') {
    return {
      valid: false,
      error: `Unsupported bundle version: ${bundle.version}`,
    };
  }

  // Validate algorithm
  if (bundle.algorithm !== 'PBKDF2-AES-GCM-256') {
    return {
      valid: false,
      error: `Unsupported encryption algorithm: ${bundle.algorithm}`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Example usage in an endpoint:
 *
 * import { validateJWK, keyErrorResponse } from './lib/key-utils.js';
 * import { ErrorCodes } from './lib/errors.js';
 *
 * // Validate a public key
 * const validation = validateJWK(publicKey);
 * if (!validation.valid) {
 *   return keyErrorResponse(ErrorCodes.KEY_FORMAT_ERROR, headers, {
 *     details: validation.error
 *   });
 * }
 */
