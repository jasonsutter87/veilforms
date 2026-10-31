/**
 * VeilForms - Form Submission Signature Verification
 * SECURITY FIX (VULN-002): Prevents unauthorized submissions and quota exhaustion attacks
 */

import crypto from 'crypto';

/**
 * Verify HMAC signature for form submission
 *
 * @param {Request} req - The request object
 * @param {string} body - Raw request body (JSON string)
 * @param {string} secret - Form's webhook secret (used as HMAC key)
 * @returns {Object} - { valid: boolean, reason: string, code: string }
 */
export async function verifySubmissionSignature(req, body, secret) {
  const signature = req.headers.get('x-veilforms-signature');
  const timestamp = req.headers.get('x-veilforms-timestamp');

  if (!signature || !timestamp) {
    return {
      valid: false,
      reason: 'Missing signature headers',
      code: 'SIGNATURE_MISSING'
    };
  }

  // Prevent replay attacks - reject requests older than 5 minutes
  const requestTime = parseInt(timestamp);
  const currentTime = Date.now();
  const MAX_AGE_MS = 300000; // 5 minutes

  if (isNaN(requestTime)) {
    return {
      valid: false,
      reason: 'Invalid timestamp format',
      code: 'TIMESTAMP_INVALID'
    };
  }

  if (currentTime - requestTime > MAX_AGE_MS) {
    return {
      valid: false,
      reason: 'Signature expired (max age: 5 minutes)',
      code: 'SIGNATURE_EXPIRED'
    };
  }

  // Prevent future-dated requests
  if (requestTime > currentTime + 60000) {
    return {
      valid: false,
      reason: 'Timestamp is in the future',
      code: 'TIMESTAMP_FUTURE'
    };
  }

  // Generate expected signature
  // Format: HMAC-SHA256(secret, timestamp + "." + body)
  const signaturePayload = `${timestamp}.${body}`;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret || 'default-webhook-secret')
      .update(signaturePayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = constantTimeCompare(signature, expectedSignature);

    if (!isValid) {
      return {
        valid: false,
        reason: 'Invalid signature',
        code: 'SIGNATURE_INVALID'
      };
    }

    return { valid: true, reason: null };
  } catch (error) {
    console.error('Signature verification error:', error);
    return {
      valid: false,
      reason: 'Signature verification failed',
      code: 'SIGNATURE_ERROR'
    };
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate signature for client SDK
 * This helper shows how clients should sign requests
 */
export function generateSubmissionSignature(body, secret) {
  const timestamp = Date.now();
  const signaturePayload = `${timestamp}.${JSON.stringify(body)}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return {
    signature,
    timestamp,
    headers: {
      'X-VeilForms-Signature': signature,
      'X-VeilForms-Timestamp': timestamp.toString()
    }
  };
}
