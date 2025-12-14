import { getStore } from '@netlify/blobs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

/**
 * VeilForms - Token Blocklist
 *
 * Provides persistent token revocation using Netlify Blob storage.
 * Tokens are stored with TTL that matches their remaining validity period,
 * ensuring automatic cleanup when tokens expire naturally.
 */

const STORE_NAME = 'vf-token-blocklist';

/**
 * Get the token blocklist store
 * @returns {Object} Netlify Blob store instance
 */
function getBlocklistStore() {
  return getStore(STORE_NAME);
}

/**
 * Calculate remaining seconds until token expiry
 * @param {string} token - JWT token
 * @returns {number|null} Seconds until expiry, or null if token is invalid/expired
 */
function getRemainingTTL(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = decoded.exp - now;

    // If token is already expired, return null
    return remainingSeconds > 0 ? remainingSeconds : null;
  } catch (err) {
    return null;
  }
}

/**
 * Create a hash of the token for storage
 * Uses SHA-256 to avoid storing actual tokens
 * @param {string} token - JWT token
 * @returns {string} Hex-encoded hash
 */
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Revoke a token by adding it to the blocklist
 * The token is stored with a TTL matching its remaining validity period,
 * ensuring automatic cleanup when the token would expire naturally.
 *
 * @param {string} token - JWT token to revoke
 * @returns {Promise<Object>} Result object with success status
 */
export async function revokeToken(token) {
  if (!token) {
    return { success: false, error: 'Token is required' };
  }

  try {
    // Calculate remaining TTL
    const ttl = getRemainingTTL(token);

    if (ttl === null) {
      // Token is already expired or invalid, no need to blocklist
      return { success: true, reason: 'token_already_expired' };
    }

    // Hash the token for privacy (don't store actual tokens)
    const tokenHash = hashToken(token);

    // Store in blocklist with TTL
    const store = getBlocklistStore();
    await store.setJSON(tokenHash, {
      revokedAt: new Date().toISOString(),
      expiresAt: new Date((Date.now() / 1000 + ttl) * 1000).toISOString()
    }, {
      metadata: { ttl }
    });

    return { success: true };
  } catch (err) {
    console.error('Token revocation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Check if a token has been revoked
 *
 * @param {string} token - JWT token to check
 * @returns {Promise<boolean>} True if token is revoked, false otherwise
 */
export async function isTokenRevoked(token) {
  if (!token) {
    return false;
  }

  try {
    const tokenHash = hashToken(token);
    const store = getBlocklistStore();
    const entry = await store.get(tokenHash);

    // If entry exists, token is revoked
    return entry !== null;
  } catch (err) {
    // On error, fail open (allow the token) to prevent blocking all requests
    // The JWT verification will still catch invalid tokens
    console.error('Blocklist check error:', err);
    return false;
  }
}

/**
 * Clean up expired entries manually (optional - TTL handles this automatically)
 * This is mainly for testing or maintenance purposes
 *
 * @returns {Promise<Object>} Cleanup statistics
 */
export async function cleanupExpiredTokens() {
  try {
    const store = getBlocklistStore();
    const { blobs } = await store.list();

    let checked = 0;
    let removed = 0;

    for (const blob of blobs) {
      checked++;
      const entry = await store.getJSON(blob.key);

      if (entry && entry.expiresAt) {
        const expiresAt = new Date(entry.expiresAt);
        if (expiresAt < new Date()) {
          await store.delete(blob.key);
          removed++;
        }
      }
    }

    return { success: true, checked, removed };
  } catch (err) {
    console.error('Cleanup error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get blocklist statistics (for admin/monitoring)
 *
 * @returns {Promise<Object>} Statistics about the blocklist
 */
export async function getBlocklistStats() {
  try {
    const store = getBlocklistStore();
    const { blobs } = await store.list();

    let total = 0;
    let expired = 0;
    let active = 0;

    const now = new Date();

    for (const blob of blobs) {
      total++;
      const entry = await store.getJSON(blob.key);

      if (entry && entry.expiresAt) {
        const expiresAt = new Date(entry.expiresAt);
        if (expiresAt < now) {
          expired++;
        } else {
          active++;
        }
      }
    }

    return {
      success: true,
      total,
      active,
      expired
    };
  } catch (err) {
    console.error('Stats error:', err);
    return { success: false, error: err.message };
  }
}
