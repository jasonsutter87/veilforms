/**
 * VeilForms - Token Blocklist
 *
 * Provides persistent token revocation using Netlify Blob storage.
 * Tokens are stored with TTL that matches their remaining validity period.
 */

import { getStore } from "@netlify/blobs";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";

const STORE_NAME = "vf-token-blocklist";

interface BlocklistEntry {
  revokedAt: string;
  expiresAt: string;
}

interface RevokeResult {
  success: boolean;
  reason?: string;
  error?: string;
}

interface CleanupResult {
  success: boolean;
  checked?: number;
  removed?: number;
  error?: string;
}

interface StatsResult {
  success: boolean;
  total?: number;
  active?: number;
  expired?: number;
  error?: string;
}

/**
 * Get the token blocklist store
 */
function getBlocklistStore() {
  return getStore(STORE_NAME);
}

/**
 * Calculate remaining seconds until token expiry
 */
function getRemainingTTL(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded || !decoded.exp) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = decoded.exp - now;

    return remainingSeconds > 0 ? remainingSeconds : null;
  } catch {
    return null;
  }
}

/**
 * Create a hash of the token for storage
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Revoke a token by adding it to the blocklist
 */
export async function revokeToken(token: string): Promise<RevokeResult> {
  if (!token) {
    return { success: false, error: "Token is required" };
  }

  try {
    const ttl = getRemainingTTL(token);

    if (ttl === null) {
      return { success: true, reason: "token_already_expired" };
    }

    const tokenHash = hashToken(token);
    const store = getBlocklistStore();

    await store.setJSON(
      tokenHash,
      {
        revokedAt: new Date().toISOString(),
        expiresAt: new Date((Date.now() / 1000 + ttl) * 1000).toISOString(),
      } as BlocklistEntry,
      { metadata: { ttl: String(ttl) } }
    );

    return { success: true };
  } catch (err) {
    console.error("Token revocation error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Check if a token has been revoked
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  try {
    const tokenHash = hashToken(token);
    const store = getBlocklistStore();
    const entry = await store.get(tokenHash);

    return entry !== null;
  } catch (err) {
    console.error("Blocklist check error:", err);
    return false;
  }
}

/**
 * Clean up expired entries manually
 */
export async function cleanupExpiredTokens(): Promise<CleanupResult> {
  try {
    const store = getBlocklistStore();
    const { blobs } = await store.list();

    let checked = 0;
    let removed = 0;

    for (const blob of blobs) {
      checked++;
      const entry = (await store.get(blob.key, {
        type: "json",
      })) as BlocklistEntry | null;

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
    console.error("Cleanup error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get blocklist statistics
 */
export async function getBlocklistStats(): Promise<StatsResult> {
  try {
    const store = getBlocklistStore();
    const { blobs } = await store.list();

    let total = 0;
    let expired = 0;
    let active = 0;

    const now = new Date();

    for (const blob of blobs) {
      total++;
      const entry = (await store.get(blob.key, {
        type: "json",
      })) as BlocklistEntry | null;

      if (entry && entry.expiresAt) {
        const expiresAt = new Date(entry.expiresAt);
        if (expiresAt < now) {
          expired++;
        } else {
          active++;
        }
      }
    }

    return { success: true, total, active, expired };
  } catch (err) {
    console.error("Stats error:", err);
    return { success: false, error: (err as Error).message };
  }
}
